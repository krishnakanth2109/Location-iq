const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// --- App Initialization ---
const app = express();

// --- Production-Ready CORS Configuration ---
// Define the list of allowed domains for CORS.
// It's recommended to pull this from environment variables.
// **MODIFIED**: Added your new Vercel URL to the default list.
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [
    'https://location-iq.vercel.app' // Fallback for when .env is not configured
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
};

// Use the configured CORS options.
app.use(cors(corsOptions));
app.use(express.json());

const PORT = process.env.PORT || 5000;

// --- Database Connection ---
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Connected...'))
.catch(err => console.error('MongoDB Connection Error:', err));

// --- Mongoose Schemas (Data Models) ---

// MODIFIED: User Schema now includes a 'role' field.
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['employee', 'admin'], // Role can only be one of these two values
    default: 'employee'          // New users are employees by default
  }
});
const User = mongoose.model('User', UserSchema);

// UNCHANGED: Trip Schema remains the same.
const TripSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  path: { type: Array, default: [] },
  stops: { type: Array, default: [] },
});
const Trip = mongoose.model('Trip', TripSchema);


// --- Authentication & Authorization Middlewares ---

// This middleware checks if a user is logged in by verifying their token.
const authMiddleware = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user; // Adds user payload { id, role } to the request
    next();
  } catch (err) { 
    res.status(401).json({ msg: 'Token is not valid' }); 
  }
};

// NEW: This middleware checks if the logged-in user has the 'admin' role.
const adminMiddleware = (req, res, next) => {
  // This middleware should run AFTER authMiddleware
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({ msg: 'Access denied. Admin privileges required.' });
  }
};


// --- API ROUTES ---

// **NEW**: Root route to check if the server is running.
app.get('/', (req, res) => {
  res.json({ msg: 'Welcome to the Location Tracker API. Server is running.' });
});

// --- Authentication Routes (Public) ---
const authRouter = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new employee (admins are created separately)
authRouter.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ msg: 'User with this email already exists' });

    user = new User({ name, email, password }); // Role defaults to 'employee'

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();

    const payload = { user: { id: user.id, role: user.role } };
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' }, (err, token) => {
      if (err) throw err;
      res.status(201).json({ token });
    });
  } catch (err) {
    console.error(err.message);
    // **FIXED**: Respond with JSON on error
    res.status(500).json({ msg: 'Server error during registration' });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate any user (admin or employee) & get token
authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    let user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    // MODIFIED: Payload now includes the user's role, which is critical for the frontend.
    const payload = { user: { id: user.id, role: user.role } }; 

    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' }, (err, token) => {
      if (err) throw err;
      res.json({ token });
    });
  } catch (err) {
    console.error(err.message);
    // **FIXED**: Respond with JSON on error
    res.status(500).json({ msg: 'Server error during login' });
  }
});
app.use('/api/auth', authRouter);


// --- Employee Trip Routes (Protected for any logged-in user) ---
const tripRouter = express.Router();
tripRouter.use(authMiddleware); // Apply auth middleware to all routes in this router

// @route   POST /api/trips/start
tripRouter.post('/start', async (req, res) => {
  try {
    const newTrip = new Trip({ user: req.user.id, startTime: new Date() });
    const trip = await newTrip.save();
    res.json({ tripId: trip.id });
  } catch (err) {
    console.error(err.message);
    // **FIXED**: Respond with JSON on error
    res.status(500).json({ msg: 'Server Error on starting trip' });
  }
});

// @route   POST /api/trips/stop
tripRouter.post('/stop', async (req, res) => {
  const { tripId, path, stops } = req.body;
  try {
    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ msg: 'Trip not found' });
    if (trip.user.toString() !== req.user.id) {
        return res.status(401).json({ msg: 'User not authorized for this trip' });
    }
    trip.endTime = new Date();
    trip.path = path;
    trip.stops = stops;
    await trip.save();
    res.json({ msg: 'Trip saved successfully', trip });
  } catch (err) {
    console.error(err.message);
    // **FIXED**: Respond with JSON on error
    res.status(500).json({ msg: 'Server Error on stopping trip' });
  }
});
app.use('/api/trips', tripRouter);


// --- NEW: Admin Routes (Protected for Admins Only) ---
const adminRouter = express.Router();
// IMPORTANT: Routes in this router first check for login, then check for admin role.
adminRouter.use(authMiddleware, adminMiddleware);

// @route   GET /api/admin/employees
// @desc    Get a list of all users with the 'employee' role.
adminRouter.get('/employees', async (req, res) => {
  try {
    const employees = await User.find({ role: 'employee' }).select('-password'); // Exclude password from result
    res.json(employees);
  } catch (err) { 
    console.error(err.message);
    // **FIXED**: Respond with JSON on error
    res.status(500).json({ msg: 'Server Error fetching employees' }); 
  }
});

// @route   GET /api/admin/trips/:employeeId
// @desc    Get all trips for a specific employee, sorted by most recent.
adminRouter.get('/trips/:employeeId', async (req, res) => {
  try {
    const trips = await Trip.find({ user: req.params.employeeId }).sort({ startTime: -1 });
    res.json(trips);
  } catch (err) { 
    console.error(err.message);
    // **FIXED**: Respond with JSON on error
    res.status(500).json({ msg: 'Server Error fetching trips' }); 
  }
});
app.use('/api/admin', adminRouter);


// --- Start Server ---
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
