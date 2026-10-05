/**
 * LoginPage — User authentication screen supporting:
 *  - Email & Password Sign In
 *  - Email & Password Account Registration (with display name)
 *  - Google OAuth Sign In
 *  - Direct Firebase account details management
 */
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  const formatFirebaseError = (err) => {
    const code = err.code || '';
    if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')) {
      return 'Invalid email or password. Please check and try again.';
    }
    if (code.includes('email-already-in-use')) {
      return 'An account already exists with this email address.';
    }
    if (code.includes('weak-password')) {
      return 'Password is too weak. Please use at least 6 characters.';
    }
    if (code.includes('invalid-email')) {
      return 'Please enter a valid email address.';
    }
    if (code.includes('popup-closed-by-user')) {
      return 'Google sign-in was cancelled.';
    }
    return err.message || 'Authentication failed. Please try again.';
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (mode === 'signup') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email.trim(), password);
      } else {
        await signUpWithEmail(email.trim(), password, displayName.trim());
      }
    } catch (err) {
      setError(formatFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(formatFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo-ring" style={{ overflow: 'hidden', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src="/logo.png" alt="KIRA Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <h1 className="login-title">KIRA Storage</h1>
        <p className="login-subtitle">
          5 TB Cloud Storage quota powered by your backend, with private per-user accounts.
        </p>

        {/* Tab switcher: Sign In vs Create Account */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'signin' ? 'active' : ''}`}
            onClick={() => { setMode('signin'); setError(null); }}
            id="tab-signin"
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => { setMode('signup'); setError(null); }}
            id="tab-signup"
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success" style={{ marginBottom: '1.25rem' }}>
            ✓ {success}
          </div>
        )}

        {/* Email & Password Form */}
        <form onSubmit={handleEmailAuth} noValidate>
          {mode === 'signup' && (
            <div className="form-group">
              <label className="form-label" htmlFor="auth-name">Full Name</label>
              <input
                id="auth-name"
                type="text"
                className="form-input"
                placeholder="Jane Doe"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="auth-email">Email / ID</label>
            <input
              id="auth-email"
              type="email"
              className="form-input"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </div>

          {mode === 'signup' && (
            <div className="form-group">
              <label className="form-label" htmlFor="auth-confirm-password">Confirm Password</label>
              <input
                id="auth-confirm-password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.75rem', marginTop: '0.25rem', fontSize: '0.95rem' }}
            disabled={loading}
            id="auth-submit-btn"
          >
            {loading ? (
              <span className="spinner" />
            ) : mode === 'signin' ? (
              'Sign In with Password'
            ) : (
              'Create Firebase Account'
            )}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        {/* Google Sign In option */}
        <button
          id="google-signin-btn"
          type="button"
          className="btn-google"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--color-text-subtle)', lineHeight: 1.5 }}>
          All user files are stored securely in your 5 TB storage.
          <br />Accounts and sessions managed by Firebase Auth.
        </p>
      </div>
    </div>
  );
}
