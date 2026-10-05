/**
 * Navbar component — sticky top navigation bar
 * Displays app brand, user profile with avatar fallback,
 * Firebase account details modal, and sign out button.
 */
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export function Navbar() {
  const { user, signOut } = useAuth();
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);

  const getInitials = () => {
    if (!user) return '?';
    if (user.displayName) return user.displayName.charAt(0).toUpperCase();
    if (user.email) return user.email.charAt(0).toUpperCase();
    return 'U';
  };

  const copyUid = async () => {
    if (!user?.uid) return;
    try {
      await navigator.clipboard.writeText(user.uid);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
    } catch {
      // ignore
    }
  };

  const providerId = user?.providerData?.[0]?.providerId || 'password';

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="navbar-logo" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <img src="/logo.png" alt="KIRA" style={{ width: 24, height: 24, borderRadius: 6, objectFit: 'cover' }} />
              KIRA
            </span>
            <span className="badge-tag">5 TB Cloud</span>
          </div>

          {user && (
            <div className="navbar-user">
              {/* Account Pill — clicks to show account modal */}
              <button
                className="account-pill-btn"
                onClick={() => setShowAccountModal(true)}
                title="View Firebase account details"
                id="account-details-btn"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="avatar"
                    className="navbar-avatar"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="navbar-avatar-fallback">
                    {getInitials()}
                  </div>
                )}
                <span className="navbar-email">
                  {user.displayName || user.email}
                </span>
              </button>

              <button className="btn btn-ghost" onClick={signOut} id="signout-btn">
                Sign out
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Firebase Account Details Modal */}
      {showAccountModal && user && (
        <div className="modal-overlay" onClick={() => setShowAccountModal(false)}>
          <div
            className="account-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="avatar"
                    className="navbar-avatar"
                    referrerPolicy="no-referrer"
                    style={{ width: 40, height: 40 }}
                  />
                ) : (
                  <div className="navbar-avatar-fallback" style={{ width: 40, height: 40, fontSize: '1.1rem' }}>
                    {getInitials()}
                  </div>
                )}
                <div>
                  <h3 style={{ margin: 0 }}>Firebase Account</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Active User Profile
                  </span>
                </div>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setShowAccountModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <div className="detail-row">
                <span className="detail-label">Display Name</span>
                <span className="detail-val">{user.displayName || '—'}</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Email / User ID</span>
                <span className="detail-val">{user.email || '—'}</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Firebase UID</span>
                <span className="detail-val" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem' }}>{user.uid.slice(0, 16)}…</span>
                  <button
                    className="btn btn-ghost"
                    onClick={copyUid}
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                    title="Copy full UID"
                  >
                    {copiedUid ? '✓ Copied' : 'Copy'}
                  </button>
                </span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Auth Provider</span>
                <span className="detail-val">
                  <span className="badge-tag">
                    {providerId === 'google.com' ? 'Google OAuth' : 'Email & Password'}
                  </span>
                </span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Email Verified</span>
                <span className="detail-val" style={{ color: user.emailVerified ? 'var(--color-success)' : 'var(--color-warning)' }}>
                  {user.emailVerified ? '✓ Verified' : 'Unverified'}
                </span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Created At</span>
                <span className="detail-val">
                  {user.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : '—'}
                </span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Storage Backend</span>
                <span className="detail-val">
                  <span className="badge-tag" style={{ background: 'rgba(34, 211, 238, 0.15)', color: '#22d3ee', borderColor: 'rgba(34, 211, 238, 0.3)' }}>
                    Shared 5 TB Quota
                  </span>
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowAccountModal(false)}>
                Close
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  setShowAccountModal(false);
                  signOut();
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
