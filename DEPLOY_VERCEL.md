# Deploying KIRA Agency Manager to Vercel 🚀

This repository is set up for native deployment on [Vercel](https://vercel.com). Because the Next.js App Router application is located in the `agency-manager/` directory, follow the steps below.

---

## Method 1: Vercel Dashboard (Recommended — Automatic CI/CD)

### Step 1: Import Project
1. Log in to your [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** > **Project**.
3. Select your GitHub repository: `theshivaaysoul-pixel/KIRA`.

### Step 2: Configure Project Settings
In the **Configure Project** screen:

1. **Framework Preset**: `Next.js`
2. **Root Directory**: Click **Edit** and select:
   ```
   agency-manager
   ```
   *(Important: Setting `agency-manager` as the Root Directory enables Vercel to automatically detect Next.js 16, install dependencies, and build serverless routes).*
3. **Build Command**: Leave as default (`npm run build` or `next build --webpack`).
4. **Output Directory**: Leave as default (`.next`).

### Step 3: Add Environment Variables
Expand the **Environment Variables** section and add the required keys (from `agency-manager/.env.local` or `.env.example`):

#### 1. Public App URL
| Name | Description / Example |
| :--- | :--- |
| `NEXT_PUBLIC_APP_URL` | Your production Vercel URL (e.g. `https://kira-agency.vercel.app`) |

#### 2. Firebase Client SDK (Safe for browser bundle)
| Name | Description |
| :--- | :--- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web API Key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | e.g. `kira-4b051.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `kira-4b051` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `kira-4b051.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging Sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase Web App ID |

#### 3. Firebase Admin SDK (Server-Side)
| Name | Description |
| :--- | :--- |
| `FIREBASE_PROJECT_ID` | `kira-4b051` |
| `FIREBASE_CLIENT_EMAIL` | Firebase Service Account Email |
| `FIREBASE_PRIVATE_KEY` | Private Key string (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`) |

#### 4. Google Cloud Storage (Server-Side)
| Name | Description |
| :--- | :--- |
| `GOOGLE_CLOUD_PROJECT_ID` | Google Cloud Project ID |
| `GOOGLE_CLOUD_STORAGE_BUCKET` | GCS Bucket Name (e.g. `kira-agency-assets`) |
| `GOOGLE_CLOUD_CLIENT_EMAIL` | GCP Service Account Email |
| `GOOGLE_CLOUD_PRIVATE_KEY` | GCP Private Key string |

#### 5. Security & Session
| Name | Description |
| :--- | :--- |
| `SESSION_SECRET` | 32+ character random secret string |

### Step 4: Deploy
Click **Deploy**. Vercel will build and deploy the app. Every future push to `main` on GitHub will automatically trigger a new production deployment!

---

## Method 2: Vercel CLI

If you prefer deploying directly from your terminal:

```bash
# 1. Navigate to the agency-manager folder
cd agency-manager

# 2. Deploy preview
npx vercel

# 3. Follow the CLI prompts to link to your Vercel account
# 4. Deploy to production
npx vercel --prod
```
