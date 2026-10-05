/**
 * Firebase Admin SDK initialization.
 * Used for:
 *  - Verifying Firebase Auth ID tokens (auth middleware)
 *  - Accessing Firestore for file metadata storage
 *
 * Credentials are loaded exclusively from environment variables.
 * Never hard-code credentials here.
 */

const admin = require('firebase-admin');

let firebaseApp;

function initializeFirebase() {
  if (admin.apps.length > 0) {
    firebaseApp = admin.apps[0];
    return firebaseApp;
  }

  const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyFilePath) {
    const path = require('path');
    const fs = require('fs');
    const resolvedPath = path.isAbsolute(keyFilePath) ? keyFilePath : path.resolve(process.cwd(), keyFilePath);
    if (fs.existsSync(resolvedPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });
      console.log('[Firebase] Admin SDK initialized from key file for project:', serviceAccount.project_id);
      return firebaseApp;
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase Admin credentials. ' +
        'Set GOOGLE_APPLICATION_CREDENTIALS or ensure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are set.'
    );
  }

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });

  console.log('[Firebase] Admin SDK initialized for project:', projectId);
  return firebaseApp;
}

function getFirestore() {
  if (!firebaseApp) initializeFirebase();
  return admin.firestore();
}

function getAuth() {
  if (!firebaseApp) initializeFirebase();
  return admin.auth();
}

module.exports = { initializeFirebase, getFirestore, getAuth };
