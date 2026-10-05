'use client';
// src/app/(auth)/login/page.tsx
// Login page — supports Google Sign-In and Email/Password.

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

type Mode = 'signin' | 'signup';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const { success, error: toastError } = useToast();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [inviteRole, setInviteRole] = useState<string | null>(null);

  // Detect invitation query params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const isInvite = params.get('invite') === 'true' || params.has('role');
      const roleParam = params.get('role');
      if (isInvite) {
        setMode('signup');
        if (roleParam) {
          setInviteRole(roleParam);
          document.cookie = `kira_invite_role=${encodeURIComponent(roleParam)}; path=/; max-age=86400; SameSite=Lax`;
        }
      }
    }
  }, []);

  // If already authenticated on this device, stay logged in and go to dashboard immediately
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, authLoading, router]);

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!email) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email';
    if (!password) errors.password = 'Password is required';
    else if (password.length < 6) errors.password = 'Password must be at least 6 characters';
    if (mode === 'signup' && !displayName.trim()) errors.displayName = 'Name is required';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleEmailAuth(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email, password, displayName);
        success('Account created! Welcome to KIRA Agency Manager.');
      } else {
        await signInWithEmail(email, password);
        success('Welcome back!');
      }
      router.push('/dashboard');
    } catch (err) {
      const msg = (err as { message?: string }).message ?? 'Authentication failed';
      toastError(friendlyFirebaseError(msg));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      success('Signed in with Google!');
      router.push('/dashboard');
    } catch (err) {
      const code = (err as { code?: string }).code || '';
      const msg = (err as { message?: string }).message ?? 'Google sign-in failed';

      // Normal user cancellation: user closed or dismissed the popup window
      if (code === 'auth/popup-closed-by-user' || msg.includes('popup-closed-by-user')) {
        console.info('[Google Sign-In] Popup closed before completion.');
        return;
      }

      // Concurrent popup requests cancelled
      if (code === 'auth/cancelled-popup-request' || msg.includes('cancelled-popup-request')) {
        console.info('[Google Sign-In] Previous popup request cancelled.');
        return;
      }

      console.error('[Google Sign-In Error]', err);
      toastError(friendlyFirebaseError(code || msg));
    } finally {
      setGoogleLoading(false);
    }
  }

  function friendlyFirebaseError(msg: string): string {
    const lower = msg.toLowerCase();
    if (lower.includes('user-not-found') || lower.includes('wrong-password') || lower.includes('invalid-credential'))
      return 'Invalid email or password.';
    if (lower.includes('email-already-in-use')) return 'An account with this email already exists.';
    if (lower.includes('too-many-requests')) return 'Too many attempts. Please wait a moment.';
    if (lower.includes('popup-blocked')) return 'Popup was blocked by your browser. Please allow popups for localhost:3000.';
    if (lower.includes('cancelled-popup-request')) return 'Another sign-in request is already in progress.';
    if (lower.includes('popup-closed')) return 'Sign-in was cancelled or the popup was closed before completing.';
    if (lower.includes('unauthorized-domain')) return 'Domain not authorized in Firebase Console (Authentication > Settings > Authorized domains).';
    if (lower.includes('network-request-failed')) return 'Network error. Check your connection.';
    return msg;
  }

  if (authLoading || user) {
    return (
      <div className="relative min-h-dvh flex items-center justify-center bg-black px-4 py-8 overflow-hidden">
        {/* Background Image */}
        <div className="fixed inset-0 z-0 select-none pointer-events-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/kira-bg.jpg"
            alt="KIRA Background"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/75 to-black/85 backdrop-blur-[2px]" />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-3">
          <div className="animate-spin w-8 h-8 border-3 border-[rgb(var(--primary))] border-t-transparent rounded-full" />
          <p className="text-xs text-neutral-300">Resuming session…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh flex items-center justify-center bg-black px-4 py-8 overflow-hidden">
      {/* Background Graphic */}
      <div className="fixed inset-0 z-0 select-none pointer-events-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/kira-bg.jpg"
          alt="KIRA Background"
          className="w-full h-full object-cover object-center"
        />
        {/* Dark Vignette Overlay for optimal contrast and readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/65 to-black/80 backdrop-blur-[1.5px]" />
      </div>

      <div className="relative z-10 w-full max-w-[440px] flex flex-col gap-6">
        {/* Brand */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center border border-white/15 bg-black/70 shadow-2xl ring-2 ring-violet-500/30 backdrop-blur-md">
            <img src="/logo.png" alt="KIRA Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight drop-shadow-md">KIRA Agency Manager</h1>
            <p className="text-sm text-neutral-300 mt-1 drop-shadow-xs">
              {mode === 'signin' ? 'Sign in to your account' : 'Create your account'}
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="card p-7 sm:p-8 flex flex-col gap-5 shadow-2xl border border-white/10 bg-neutral-950/85 backdrop-blur-xl rounded-2xl">
          {inviteRole && (
            <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-200 text-xs flex items-center gap-2.5">
              <span className="p-1 rounded-lg bg-purple-500/20 text-purple-300">✨</span>
              <div>
                <p className="font-semibold text-white">Agency Invitation</p>
                <p className="text-[11px] text-purple-300/90 mt-0.5">
                  You have been invited to join KIRA as a <span className="font-bold uppercase tracking-wider text-purple-200">{inviteRole}</span>. Sign up below to join.
                </p>
              </div>
            </div>
          )}

          {/* Google */}
          <Button
            variant="secondary"
            onClick={handleGoogle}
            loading={googleLoading}
            className="w-full h-11 text-sm font-medium"
            icon={
              !googleLoading && (
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )
            }
          >
            Continue with Google
          </Button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[rgb(var(--border))]" />
            <span className="text-xs uppercase tracking-wider text-[rgb(var(--text-muted))]">or</span>
            <div className="flex-1 h-px bg-[rgb(var(--border))]" />
          </div>

          {/* Email form */}
          <form onSubmit={handleEmailAuth} className="flex flex-col gap-4" noValidate>
            {mode === 'signup' && (
              <Input
                id="displayName"
                label="Full Name"
                type="text"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                error={fieldErrors.displayName}
                autoComplete="name"
              />
            )}
            <Input
              id="email"
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldErrors.email}
              autoComplete="email"
            />
            <Input
              id="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-secondary))] self-start -mt-1 transition-colors px-2.5 py-1 rounded-full hover:bg-[rgb(var(--bg-subtle))]"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
              {showPassword ? 'Hide' : 'Show'} password
            </button>

            <Button type="submit" loading={loading} className="w-full h-11 text-sm font-semibold mt-2">
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>
        </div>

        {/* Mode toggle */}
        <p className="text-center text-sm text-neutral-300 drop-shadow-xs">
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setFieldErrors({}); }}
            className="text-violet-400 hover:text-violet-300 font-semibold transition-colors px-2.5 py-1 rounded-full hover:bg-violet-500/20 inline-flex items-center"
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
