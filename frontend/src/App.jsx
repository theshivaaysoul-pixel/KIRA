/**
 * App.jsx — Root component
 * Handles auth state routing:
 *  - Loading spinner while Firebase checks auth
 *  - LoginPage for unauthenticated users
 *  - Dashboard for authenticated users
 */
import './index.css';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './components/LoginPage';
import { Dashboard } from './components/Dashboard';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-page">
        <span className="loading-logo" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <img src="/logo.png" alt="KIRA" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />
          KIRA
        </span>
        <span className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    );
  }

  return user ? <Dashboard /> : <LoginPage />;
}

export default App;
