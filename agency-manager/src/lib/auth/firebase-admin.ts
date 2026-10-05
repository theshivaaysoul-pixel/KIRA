// src/lib/auth/firebase-admin.ts
// Firebase ADMIN SDK initialization (server-side only)
// NEVER import this file in client components or expose to browser.

import type { App } from 'firebase-admin/app';
import path from 'path';
import fs from 'fs';

let adminApp: App | null = null;

/**
 * Lazily initialize Firebase Admin SDK.
 * Called only on the server (API routes, Server Components).
 * Credentials come from environment variables or service account key file.
 */
export function getAdminApp(): App {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getApps, initializeApp, cert } = require('firebase-admin/app');

  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp!;
  }

  const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (keyFilePath) {
    let resolvedPath = path.isAbsolute(keyFilePath)
      ? keyFilePath
      : path.resolve(process.cwd(), keyFilePath);

    if (!fs.existsSync(resolvedPath)) {
      const alt1 = path.resolve(process.cwd(), '..', keyFilePath);
      const alt2 = path.resolve(process.cwd(), '../..', keyFilePath);
      if (fs.existsSync(alt1)) resolvedPath = alt1;
      else if (fs.existsSync(alt2)) resolvedPath = alt2;
    }

    if (fs.existsSync(resolvedPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
      adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID,
      });
      console.log('[Firebase Admin] Initialized from key file for project:', serviceAccount.project_id);
      return adminApp!;
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && rawPrivateKey) {
    const privateKey = rawPrivateKey.replace(/\\n/g, '\n');
    adminApp = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
    console.log('[Firebase Admin] Initialized from env vars for project:', projectId);
    return adminApp!;
  }

  throw new Error(
    '[Firebase Admin] Missing server credentials. ' +
    'Provide GOOGLE_APPLICATION_CREDENTIALS in .env.local or set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.'
  );
}

export function getAdminAuth() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getAuth } = require('firebase-admin/auth');
  getAdminApp();
  return getAuth();
}

export function getAdminFirestore() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getFirestore } = require('firebase-admin/firestore');
  getAdminApp();
  return getFirestore();
}

/**
 * Verify a Firebase ID token from the Authorization header.
 * Returns decoded token or throws.
 */
export async function verifyIdToken(idToken: string) {
  const auth = getAdminAuth();
  return auth.verifyIdToken(idToken);
}
