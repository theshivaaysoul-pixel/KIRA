import { useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      return res.user;
    } catch (err) {
      console.error('Sign-in with Google error:', err.message);
      throw err;
    }
  };

  const signInWithEmail = async (email, password) => {
    try {
      const res = await signInWithEmailAndPassword(auth, email, password);
      return res.user;
    } catch (err) {
      console.error('Sign-in with email error:', err.message);
      throw err;
    }
  };

  const signUpWithEmail = async (email, password, displayName) => {
    try {
      const res = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName && res.user) {
        await updateProfile(res.user, { displayName });
        // Force refresh user state so displayName is immediately visible
        setUser({ ...res.user, displayName });
      }
      return res.user;
    } catch (err) {
      console.error('Sign-up with email error:', err.message);
      throw err;
    }
  };

  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      console.error('Password reset error:', err.message);
      throw err;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.error('Sign-out error:', err.message);
      throw err;
    }
  };

  return {
    user,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    signOut,
  };
}

