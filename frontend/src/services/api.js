const API_URL = 'https://location-iq-2.onrender.com/api';

const request = async (endpoint, options = {}) => {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    if (token) {
        headers['x-auth-token'] = token;
    }

    const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.msg || 'An API error occurred');
    }
    return data;
};

export const login = (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
export const register = (userData) => request('/auth/register', { method: 'POST', body: JSON.stringify(userData) });
export const startTrip = () => request('/trips/start', { method: 'POST' });
export const stopTrip = (tripData) => request('/trips/stop', { method: 'POST', body: JSON.stringify(tripData) });

// Admin specific API calls
export const getEmployees = () => request('/admin/employees');
export const getTripsForEmployee = (employeeId) => request(`/admin/trips/${employeeId}`);
