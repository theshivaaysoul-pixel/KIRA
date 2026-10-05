# Vercel Deployment Guide for KIRA Monorepo

This guide covers deploying the multi-service **KIRA** repository on Vercel using the official Vercel Services monorepo architecture.

---

## 🏗️ Architecture Overview

The repository consists of 3 distinct services configured in [`vercel.json`](./vercel.json):

```
KIRA/
├── agency-manager/    # Next.js 16 (Agency Operations Portal & Admin)
├── backend/           # Node.js / Express REST API (File Streaming & Services)
└── frontend/          # React + Vite Client Application
```

---

## ⚙️ Vercel Configuration (`vercel.json`)

The root [`vercel.json`](./vercel.json) defines the services and routing rewrites:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "services": {
    "agency-manager": {
      "root": "agency-manager",
      "framework": "nextjs"
    },
    "backend": {
      "root": "backend",
      "framework": "express"
    },
    "frontend": {
      "root": "frontend",
      "framework": "vite"
    }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": {
        "service": "backend"
      }
    },
    {
      "source": "/(.*)",
      "destination": {
        "service": "frontend"
      }
    }
  ]
}
```

### 🧭 Routing & Service Destination Notes

- **Backend API**: Requests matching `/api/(.*)` route directly to the `backend` Express service.
- **Frontend Client**: Requests matching `/(.*)` fall through to the `frontend` Vite app.
- **Agency Manager**: To route requests to `agency-manager` within the same domain, add a path prefix rule before the catch-all `/(.*)`:
  ```json
  {
    "source": "/manager/(.*)",
    "destination": {
      "service": "agency-manager"
    }
  }
  ```
  *Alternatively, `agency-manager` can be linked to its own dedicated Vercel project with custom root directory set to `agency-manager`.*

---

## 🔐 Environment Variables by Service

Configure these environment variables in your **Vercel Project Settings → Environment Variables**:

### 1. `backend` (Express Service)

| Variable | Description | Example / Required |
|:---|:---|:---|
| `PORT` | Listening port (handled by Vercel in serverless) | `4000` |
| `NODE_ENV` | Runtime environment | `production` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed frontend domains | `https://your-domain.vercel.app` |
| `FIREBASE_PROJECT_ID` | Firebase Console Project ID | `your-project-id` |
| `FIREBASE_CLIENT_EMAIL` | Firebase Admin Service Account email | `firebase-adminsdk-xxx@...` |
| `FIREBASE_PRIVATE_KEY` | Firebase Admin Private Key (with `\n` linebreaks) | `"-----BEGIN RSA PRIVATE KEY-----\n..."` |
| `GOOGLE_DRIVE_CLIENT_ID` | OAuth2 Client ID for Google Drive API | `xxx.apps.googleusercontent.com` |
| `GOOGLE_DRIVE_CLIENT_SECRET` | OAuth2 Client Secret | `your-secret` |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | OAuth2 Refresh Token | `your-token` |

### 2. `frontend` (Vite Client)

| Variable | Description |
|:---|:---|
| `VITE_API_BASE_URL` | Set to `/api` (or custom backend URL) |
| `VITE_FIREBASE_API_KEY` | Public Firebase Web API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | `<project-id>.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `<project-id>` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `<project-id>.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Cloud Messaging Sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase Web App ID |

### 3. `agency-manager` (Next.js Service)

| Variable | Description |
|:---|:---|
| `NEXT_PUBLIC_APP_URL` | Base production URL of the agency portal |
| `SESSION_SECRET` | 32+ character random secret for secure sessions |
| `NEXT_PUBLIC_FIREBASE_*` | Public Firebase client credentials (same as frontend) |
| `FIREBASE_PROJECT_ID` | Firebase Admin SDK Project ID |
| `FIREBASE_CLIENT_EMAIL` | Firebase Admin Service Account Email |
| `FIREBASE_PRIVATE_KEY` | Firebase Admin Private Key |
| `GOOGLE_CLOUD_PROJECT_ID` | Google Cloud Storage Project ID |
| `GOOGLE_CLOUD_STORAGE_BUCKET`| Google Cloud Storage Bucket Name |
| `GOOGLE_CLOUD_CLIENT_EMAIL` | Service account with Storage Object Admin role |
| `GOOGLE_CLOUD_PRIVATE_KEY` | GCS Private Key |

---

## 🚀 Deploying to Vercel

### Option A: Via Vercel CLI (Recommended for monorepos)

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel@latest
   ```

2. **Link the project**:
   ```bash
   vercel link
   ```

3. **Deploy Preview**:
   ```bash
   vercel
   ```

4. **Deploy to Production**:
   ```bash
   vercel --prod
   ```

### Option B: Via GitHub Integration

1. Push your changes to GitHub:
   ```bash
   git add vercel.json DEPLOY_VERCEL.md
   git commit -m "chore: add vercel multi-service configuration and deployment guide"
   git push origin main
   ```
2. Navigate to [vercel.com/new](https://vercel.com/new).
3. Import your GitHub repository (`theshivaaysoul-pixel/KIRA`).
4. Vercel will automatically detect [`vercel.json`](./vercel.json) and deploy each defined service.
5. Add the environment variables in **Project Settings → Environment Variables**.

### Option C: Deploying a Single Service Individually

If you prefer deploying a service (such as `agency-manager`) as its own standalone Vercel project:
1. In the Vercel Import screen, set **Root Directory** to `agency-manager` (or `frontend`).
2. Framework Preset will auto-detect as **Next.js** (or **Vite**).
3. Add only that service's environment variables.
4. Deploy!
