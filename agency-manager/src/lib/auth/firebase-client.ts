// src/lib/auth/firebase-client.ts
// Firebase CLIENT-side SDK initialization (browser only)
// Only public NEXT_PUBLIC_ config values go here — no secrets.

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  browserLocalPersistence,
  setPersistence,
  browserPopupRedirectResolver,
  type Auth,
} from 'firebase/auth';
import { GoogleAuthProvider } from 'firebase/auth';

const firebaseClientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Validate required config at runtime
function validateClientConfig(): void {
  const required = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
  ] as const;

  const missing = required.filter(
    (key) => !process.env[key]
  );

  if (missing.length > 0) {
    console.warn(
      '[Firebase Client] Missing environment variables:',
      missing.join(', '),
      '\nCopy .env.example to .env.local and fill in your Firebase config.'
    );
  }
}

let clientApp: FirebaseApp | null = null;
let clientAuth: Auth | null = null;

function getClientApp(): FirebaseApp {
  if (clientApp) return clientApp;
  validateClientConfig();
  clientApp = getApps().length === 0
    ? initializeApp(firebaseClientConfig)
    : getApps()[0];
  return clientApp;
}

export function getClientAuth(): Auth {
  if (clientAuth) return clientAuth;
  clientAuth = getAuth(getClientApp());

  if (typeof window !== 'undefined') {
    // Enforce long-lived device persistence across restarts
    setPersistence(clientAuth, browserLocalPersistence).catch((err) => {
      console.warn('[Firebase Auth] Could not set browserLocalPersistence:', err);
    });
  }

  return clientAuth;
}

export function getGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

export { getClientApp, browserLocalPersistence, browserPopupRedirectResolver };
