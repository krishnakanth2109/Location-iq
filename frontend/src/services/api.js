// --- CONFIGURATION ---
// We point this to your Render Backend URL
const API_URL = 'https://location-node.onrender.com/api'; 
// const API_URL = 'http://localhost:5000/api'; // Keep this commented out for local testing
// ---------------------

const request = async (endpoint, options = {}) => {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    if (token) {
        headers['x-auth-token'] = token;
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
        const data = await response.json();
        
        if (!response.ok) {
            // Throw a more descriptive error so the UI can handle it
            throw new Error(data.msg || 'An API error occurred');
        }
        return data;
    } catch (error) {
        console.error("API Call Failed:", error);
        throw error;
    }
};

export const login = (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
export const register = (userData) => request('/auth/register', { method: 'POST', body: JSON.stringify(userData) });
export const startTrip = () => request('/trips/start', { method: 'POST' });
export const stopTrip = (tripData) => request('/trips/stop', { method: 'POST', body: JSON.stringify(tripData) });

// Admin specific API calls
export const getEmployees = () => request('/admin/employees');
export const getTripsForEmployee = (employeeId) => request(`/admin/trips/${employeeId}`);
