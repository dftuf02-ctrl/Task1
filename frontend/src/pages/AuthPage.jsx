import React, { useState } from 'react';

/**
 * Combined Login / Signup screen shown when no user is authenticated.
 */
const AuthPage = ({ onLogin, onSignup }) => {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const isLogin = mode === 'login';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isLogin) {
        await onLogin(email, password);
      } else {
        await onSignup(email, password);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = () => {
    setMode(isLogin ? 'signup' : 'login');
    setError(null);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="header-logo">T</div>
          <h1 className="auth-title">TaskFlow</h1>
        </div>
        <p className="auth-subtitle">
          {isLogin ? 'Sign in to your account' : 'Create a new account'}
        </p>

        {error && <div className="auth-error" id="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="form-label" htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            type="email"
            className="form-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <label className="form-label" htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            type="password"
            className="form-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isLogin ? 'Your password' : 'At least 8 characters'}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            minLength={isLogin ? undefined : 8}
            required
          />

          <button type="submit" className="btn-primary auth-submit" disabled={submitting} id="auth-submit-btn">
            {submitting ? 'Please wait…' : isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <p className="auth-switch">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button type="button" className="auth-switch-btn" onClick={switchMode} id="auth-switch-btn">
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
