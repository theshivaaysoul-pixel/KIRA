# KIRA — Setup & Credentials Guide

This guide walks you through setting up your full-stack application with:
1. **Firebase Auth & Accounts**: Email/Password login + Google Sign-In, with user accounts managed in Firebase.
2. **5 TB Google One Storage**: All uploaded files (photos, videos, documents) are stored in your 5 TB Google Drive storage under `KIRA/users/{userId}/{category}/`.
3. **Firestore Metadata**: Fast queries and user file records stored in Firebase Firestore.

---

## Architecture Overview

```
Frontend (React + Vite)
    │  Users sign in with Email & Password or Google
    │  Receives Firebase ID Token
    ▼
Express Backend (Node.js)
    │  1. Verifies Firebase ID Token via Firebase Admin SDK
    │  2. Identifies user (UID, email)
    │  3. Uses YOUR stored Google Drive credentials to upload/download
    ▼
┌─────────────────────────────────┐      ┌─────────────────────────────┐
│ Your 5 TB Google One Storage    │      │ Firebase Firestore          │
│ (Google Drive API)              │      │ (Metadata Database)         │
│                                 │      │                             │
│ 📁 KIRA/                        │      │ Stores:                     │
│    └── users/{userId}/          │      │ - fileId, userId, fileName  │
│        ├── images/              │      │ - mimeType, size, category  │
│        ├── videos/              │      │ - driveFileId, createdAt    │
│        └── documents/           │      └─────────────────────────────┘
└─────────────────────────────────┘
```

---

## Step 1: Firebase Project & Authentication Setup

### 1.1 Create or Open your Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com).
2. Click **Add project** (or select your existing GCP/Firebase project).
3. Follow the prompts to create the project.

### 1.2 Enable Email/Password and Google Sign-In
1. In the left sidebar, click **Build** → **Authentication**.
2. Click **Get Started**.
3. Under the **Sign-in method** tab:
   - Click **Email/Password** → toggle **Enable** → click **Save**.
   - (Optional) Click **Google** → toggle **Enable** → choose your project support email → click **Save**.

### 1.3 Enable Cloud Firestore
1. In the left sidebar, click **Build** → **Firestore Database**.
2. Click **Create database**.
3. Choose a location closest to you.
4. Select **Start in test mode** (or production mode) → click **Create**.

### 1.4 Get Frontend Config (`frontend/.env.local`)
1. Click the **Gear icon (⚙️)** next to "Project Overview" → **Project settings**.
2. Scroll down to **Your apps** → click the **Web icon (`</>`)**.
3. App nickname: `KIRA Web` → click **Register app**.
4. You will see a `firebaseConfig` block. Copy the corresponding values into [frontend/.env.local](file:///c:/Users/shvmn/Documents/KIRA/frontend/.env.local):
   ```env
   VITE_API_BASE_URL=http://localhost:4000
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
   VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef...
   ```

### 1.5 Get Backend Firebase Admin Credentials (`backend/.env`)
1. In Firebase Console → **Project settings** → click the **Service accounts** tab.
2. Click **Generate new private key** → confirm by clicking **Generate key**.
3. A JSON file will download to your computer. Open it in a text editor:
   - Find `"project_id"` → paste into `FIREBASE_PROJECT_ID` in `backend/.env`.
   - Find `"client_email"` → paste into `FIREBASE_CLIENT_EMAIL` in `backend/.env`.
   - Find `"private_key"` → paste into `FIREBASE_PRIVATE_KEY` in `backend/.env` (keep quotes and `\n`).

---

## Step 2: Google Drive API Setup (for your 5 TB Google One storage)

All user files will be saved in your personal Google account's 5 TB Google One space.

### 2.1 Enable the Google Drive API
1. Go to the [Google Cloud Console](https://console.cloud.google.com).
2. Select your project from the top dropdown.
3. In the search bar at the top, type `Google Drive API` and select it.
4. Click **Enable**.

### 2.2 Configure OAuth Consent Screen
1. Go to **APIs & Services** → **OAuth consent screen**.
2. User Type: select **External** → click **Create**.
3. App name: `KIRA Storage`
4. User support email: Select your Google email (the one with the 5 TB subscription).
5. Developer contact email: Enter your email.
6. Click **Save and Continue** through Scopes.
7. Under **Test users**, click **+ ADD USERS** and add your Google email address.
8. Click **Save and Continue** → **Back to Dashboard**.

### 2.3 Create OAuth 2.0 Client Credentials
1. Go to **APIs & Services** → **Credentials**.
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**.
3. Application type: Select **Web application**.
4. Name: `KIRA Backend`
5. Under **Authorized redirect URIs**, click **+ ADD URI** and enter:
   ```
   http://localhost:4000/oauth2callback
   ```
6. Click **Create**.
7. Copy the **Client ID** and **Client Secret** into [backend/.env](file:///c:/Users/shvmn/Documents/KIRA/backend/.env):
   ```env
   GOOGLE_DRIVE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_DRIVE_CLIENT_SECRET=your-client-secret
   ```

### 2.4 Authorize & Obtain the Refresh Token
Run the built-in helper script from the backend folder:
```powershell
cd c:\Users\shvmn\Documents\KIRA\backend
node scripts/getDriveToken.js
```
1. It will print a authorization URL. Copy and open it in your browser.
2. Sign in with your **Google account that has the 5 TB Google One subscription**.
3. Click **Continue / Allow**.
4. The browser will redirect to `http://localhost:4000/oauth2callback?code=4/0A...`.
5. Copy the `code` parameter from the URL address bar and paste it back into your terminal prompt.
6. The script will output your `GOOGLE_DRIVE_REFRESH_TOKEN`.
7. Paste this token into [backend/.env](file:///c:/Users/shvmn/Documents/KIRA/backend/.env):
   ```env
   GOOGLE_DRIVE_REFRESH_TOKEN=1//0g...
   ```

---

## Step 3: Run the Application

Open two terminal windows:

### Terminal 1 — Backend
```powershell
cd c:\Users\shvmn\Documents\KIRA\backend
npm run dev
```
Backend runs on **http://localhost:4000**.

### Terminal 2 — Frontend
```powershell
cd c:\Users\shvmn\Documents\KIRA\frontend
npm run dev
```
Frontend runs on **http://localhost:5173**.

---

## How It Works in Practice

1. Open **http://localhost:5173**.
2. Any user can:
   - Create an account using **Email & Password** (or sign in with Google).
   - Click the user pill in the top-right navbar to view their **Firebase Account details** (UID, email, registration status).
3. When they drag & drop or upload files:
   - Photos, videos, and documents are securely uploaded to your **5 TB Google One Drive**.
   - Files are automatically isolated inside `KIRA/users/{userId}/{category}/`.
   - Each user can only see, download, and delete their own files.
