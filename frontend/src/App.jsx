import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

import LoginPage from './components/LoginPage';
import EmployeeDashboard from './components/EmployeeDashboard';
import AdminDashboard from './components/AdminDashboard';
import './App.css'; // Your brilliant CSS file

const App = () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true); // Prevent flicker on load
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const decodedUser = jwtDecode(token);
                // Check if the token is expired
                if (decodedUser.exp * 1000 < Date.now()) {
                    localStorage.removeItem('token');
                    setUser(null);
                } else {
                    setUser(decodedUser.user);
                }
            } catch (error) {
                // Handle cases where the token is invalid
                localStorage.removeItem('token');
                setUser(null);
            }
        }
        setLoading(false);
    }, []);

    const handleLogin = (token) => {
        localStorage.setItem('token', token);
        const decodedUser = jwtDecode(token);
        setUser(decodedUser.user);
        // This is the correct way to handle post-login redirection
        const targetPath = decodedUser.user.role === 'admin' ? '/admin' : '/dashboard';
        navigate(targetPath);
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        setUser(null);
        navigate('/login');
    };
    
    // Display a loading indicator to prevent UI flicker while checking the token
    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
    }

    return (
        <Routes>
            {/* If the user is logged in, redirect from /login to their dashboard */}
            <Route 
                path="/login" 
                element={!user ? <LoginPage onLogin={handleLogin} /> : <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />} 
            />
            
            {/* Protected route for Employees */}
            <Route 
                path="/dashboard" 
                element={user && user.role === 'employee' ? <EmployeeDashboard onLogout={handleLogout} /> : <Navigate to="/login" replace />} 
            />
            
            {/* Protected route for Admins */}
            <Route 
                path="/admin" 
                element={user && user.role === 'admin' ? <AdminDashboard onLogout={handleLogout} /> : <Navigate to="/login" replace />} 
            />
            
            {/* Redirect any other path to the correct location */}
            <Route 
                path="*" 
                element={<Navigate to={user ? (user.role === 'admin' ? '/admin' : '/dashboard') : '/login'} replace />} 
            />
        </Routes>
    );
};

export default App;