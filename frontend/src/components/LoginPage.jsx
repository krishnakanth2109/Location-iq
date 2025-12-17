import React, { useState } from 'react';
import { login, register } from '../services/api';

const LoginPage = ({ onLogin }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            let data;
            if (isLogin) {
                // Login Flow
                data = await login({ email, password });
            } else {
                // Register Flow
                data = await register({ name, email, password });
            }
            
            // Both Login and Register return { token: "..." }
            if (data && data.token) {
                onLogin(data.token);
            } else {
                setError("Registration successful, but no token received. Please login.");
                setIsLogin(true);
            }

        } catch (err) {
            console.error("Auth Error:", err);
            // Display the error message from the API or a default one
            setError(err.message || 'Authentication failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-form">
                <h2>{isLogin ? 'Employee Login' : 'Employee Registration'}</h2>
                <form onSubmit={handleSubmit}>
                    {!isLogin && (
                        <input 
                            type="text" 
                            placeholder="Full Name" 
                            value={name} 
                            onChange={(e) => setName(e.target.value)} 
                            required 
                        />
                    )}
                    <input 
                        type="email" 
                        placeholder="Email Address" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        required 
                    />
                    <input 
                        type="password" 
                        placeholder="Password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        required 
                    />
                    
                    {error && <p className="error-msg" style={{color: 'red'}}>{error}</p>}
                    
                    <button type="submit" disabled={loading}>
                        {loading ? 'Processing...' : (isLogin ? 'Login' : 'Create Account')}
                    </button>
                </form>
                <p 
                    onClick={() => { setIsLogin(!isLogin); setError(''); }} 
                    className="toggle-auth"
                    style={{cursor: 'pointer', color: 'blue', marginTop: '10px'}}
                >
                    {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
                </p>
            </div>
        </div>
    );
};

export default LoginPage;
