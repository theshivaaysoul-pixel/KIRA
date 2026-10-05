// Firebase client-side configuration
// ⚠️  Only PUBLIC Firebase config values go here.
// ⚠️  NEVER put service account credentials, private keys, or GCS credentials here.
//
// These values are from:
//   Firebase Console → Project Settings → Your apps → Web app → Config

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Prevent re-initialization in HMR environments
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});
export const googleProvider = new GoogleAuthProvider();

export default app;
