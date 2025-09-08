import React, { useState } from 'react';
import { login, register } from '../services/api';

const LoginPage = ({ onLogin }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            let data;
            if (isLogin) {
                data = await login({ email, password });
            } else {
                data = await register({ name, email, password });
                // Automatically log in after successful registration
                data = await login({ email, password });
            }
            onLogin(data.token);
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-form">
                <h2>{isLogin ? 'Employee Login' : 'Employee Registration'}</h2>
                <form onSubmit={handleSubmit}>
                    {!isLogin && (
                        <input type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} required />
                    )}
                    <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    {error && <p className="error-msg">{error}</p>}
                    <button type="submit">{isLogin ? 'Login' : 'Create Account'}</button>
                </form>
                <p onClick={() => { setIsLogin(!isLogin); setError(''); }} className="toggle-auth">
                    {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
                </p>
            </div>
        </div>
    );
};

export default LoginPage;