'use client';
// src/contexts/AuthContext.tsx
// Firebase Auth context — wraps the app and provides the auth state to all components.
// Business logic stays here; UI components only consume what they need.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  setPersistence,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  type User as FirebaseUser,
} from 'firebase/auth';
import { getClientAuth, getGoogleProvider } from '@/lib/auth/firebase-client';
import type { AuthState, User } from '@/lib/types';

interface AuthContextValue extends AuthState {
  signInWithGoogle: () => Promise<User>;
  signInWithEmail: (email: string, password: string) => Promise<User>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<User>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mapFirebaseUser(firebaseUser: FirebaseUser): User {
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
    emailVerified: firebaseUser.emailVerified,
  };
}

async function recordAuthActivity(action: 'LOGIN' | 'LOGOUT', token?: string | null) {
  try {
    if (!token) return;
    await fetch('/api/auth/activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action }),
    });
  } catch {
    // Non-blocking activity log
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const auth = getClientAuth();
    // Enforce long-lived device-level persistence
    setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.warn('[Auth] setPersistence warning:', err);
    });

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setState({
          user: firebaseUser ? mapFirebaseUser(firebaseUser) : null,
          loading: false,
          error: null,
        });
      },
      (err) => {
        console.error('[Auth] onAuthStateChanged error:', err);
        setState({ user: null, loading: false, error: err.message });
      }
    );
    return unsubscribe;
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<User> => {
    const auth = getClientAuth();
    const provider = getGoogleProvider();
    const result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
    const token = await result.user.getIdToken();
    recordAuthActivity('LOGIN', token);
    return mapFirebaseUser(result.user);
  }, []);

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<User> => {
      const auth = getClientAuth();
      await setPersistence(auth, browserLocalPersistence).catch(() => {});
      const result = await signInWithEmailAndPassword(auth, email, password);
      const token = await result.user.getIdToken();
      recordAuthActivity('LOGIN', token);
      return mapFirebaseUser(result.user);
    },
    []
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string, displayName: string): Promise<User> => {
      const auth = getClientAuth();
      await setPersistence(auth, browserLocalPersistence).catch(() => {});
      const result = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateProfile(result.user, { displayName });
      }
      const token = await result.user.getIdToken();
      recordAuthActivity('LOGIN', token);
      return mapFirebaseUser(result.user);
    },
    []
  );

  const resetPassword = useCallback(async (email: string): Promise<void> => {
    const auth = getClientAuth();
    await sendPasswordResetEmail(auth, email);
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    const auth = getClientAuth();
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    if (token) {
      await recordAuthActivity('LOGOUT', token);
    }
    await firebaseSignOut(auth);
    setState({ user: null, loading: false, error: null });
  }, []);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    const auth = getClientAuth();
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        resetPassword,
        signOut,
        getIdToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>');
  }
  return ctx;
}
