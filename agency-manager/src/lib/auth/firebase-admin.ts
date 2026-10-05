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

  // 1. Direct JSON string or Base64 encoded Service Account
  const rawServiceAccount =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (rawServiceAccount && typeof rawServiceAccount === 'string') {
    try {
      const trimmed = rawServiceAccount.trim();
      const jsonStr = trimmed.startsWith('{')
        ? trimmed
        : Buffer.from(trimmed, 'base64').toString('utf8');
      const serviceAccount = JSON.parse(jsonStr);
      if (serviceAccount.project_id && serviceAccount.private_key) {
        adminApp = initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID,
        });
        console.log('[Firebase Admin] Initialized from service account JSON/Base64 for project:', serviceAccount.project_id);
        return adminApp!;
      }
    } catch (e) {
      console.warn('[Firebase Admin] Failed to parse service account JSON/Base64 env:', e);
    }
  }

  // 2. Key file on disk (local development)
  const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (keyFilePath && typeof keyFilePath === 'string' && !keyFilePath.trim().startsWith('{')) {
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

  // 3. Individual environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && rawPrivateKey) {
    let privateKey = rawPrivateKey.trim();
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');
    adminApp = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
    console.log('[Firebase Admin] Initialized from env vars for project:', projectId);
    return adminApp!;
  }

  throw new Error(
    '[Firebase Admin] Missing server credentials. ' +
    'Provide FIREBASE_SERVICE_ACCOUNT_KEY (Base64 or JSON), GOOGLE_APPLICATION_CREDENTIALS, or set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.'
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
