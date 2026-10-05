# KIRA Agency Manager — Production Environment & Variable Audit

This document defines the production environment configuration, separation boundaries, secret management hierarchy, and environment variable classification for KIRA Agency Manager.

---

## 1. Environment Separation Boundaries

| Environment | Purpose | Storage Bucket | URL Base | Secrets Source |
|---|---|---|---|---|
| **Local (dev)** | Local developer workstation | Local mock / Dev GCS bucket | `http://localhost:3000` | `.env.local` (git-ignored) |
| **Test (CI)** | Automated unit & integration tests | Memory / Isolated test prefix | In-memory / Mock | CI Runner Environment Variables |
| **Staging** | Pre-production validation | `kira-agency-staging-storage` | `https://staging.kira.agency` | Google Secret Manager (`staging-*`) |
| **Production** | Live multi-tenant agency traffic | `kira-agency-manager-prod-storage` | `https://kira.agency` | Google Secret Manager (`latest`) |

### Strict Isolation Rules
1. **No Shared Buckets**: Production NEVER shares buckets, object paths, or prefixes with local, test, or staging environments.
2. **No Test Credentials**: Production runtimes never load test API keys, mock session tokens, or local credentials.
3. **No Localhost Callbacks**: All OAuth and authentication redirects in production point to `https://kira.agency/api/auth/callback/*`.
4. **Git Protection**: `.env`, `.env.local`, `*.pem`, `*.key`, and `*-adminsdk-*.json` are strictly excluded via `.gitignore` and `.dockerignore`.

---

## 2. Environment Variable Audit & Classification

Every environment variable in KIRA Agency Manager is categorized into **Server-Only** or **Client-Public**.

### A. Server-Only Variables (STRICT CONFIDENTIALITY)
These variables MUST NEVER be prefixed with `NEXT_PUBLIC_` and are prohibited from being bundled into client JavaScript.

| Variable Name | Required | Purpose | Secret Manager Secret Name |
|---|---|---|---|
| `SESSION_SECRET` | Yes | Signs and verifies user session cookies (HMAC-SHA256) | `kira-session-secret` |
| `FIREBASE_PRIVATE_KEY` | Yes | Firebase Admin SDK authentication with Google IAM | `kira-firebase-private-key` |
| `FIREBASE_CLIENT_EMAIL` | Yes | Firebase Admin SDK service account email | `kira-firebase-client-email` |
| `FIREBASE_PROJECT_ID` | Yes | Firebase / GCP Project ID | Injected via Cloud Run metadata |
| `GOOGLE_CLIENT_SECRET` | Yes | OAuth2 Client Secret for platform integrations | `kira-google-client-secret` |
| `GOOGLE_CLOUD_STORAGE_BUCKET`| Yes | Target GCS bucket for database JSON & media assets | Injected via Cloud Run config |
| `GOOGLE_CLOUD_PROJECT_ID` | Yes | GCP Project ID for GCS and Pub/Sub | Injected via Cloud Run metadata |
| `STORAGE_DRIVER` | Yes | Must be explicitly set to `gcs` in production | Static env: `gcs` |
| `NODE_ENV` | Yes | Runtime environment identifier (`production`) | Static env: `production` |

### B. Client-Public Variables (Framework Public Prefix)
Only variables genuinely needed by the user's browser for initial rendering or client-side Firebase Auth initialization use the `NEXT_PUBLIC_` prefix.

| Variable Name | Purpose | Safe For Browser? |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Canonical origin for absolute links & callbacks (`https://kira.agency`) | Yes |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Client Web SDK API key | Yes (Domain-restricted in GCP console) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain (`kira-4b051.firebaseapp.com`) | Yes |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Project identifier (`kira-4b051`) | Yes |

---

## 3. Secret Manager Production Configuration

In Google Cloud Run, production secrets are mounted directly as environment variables using Cloud Run's native Secret Manager integration, ensuring credentials never touch disk.

```bash
# Provisioning secrets in Google Secret Manager
gcloud secrets create kira-session-secret --replication-policy="automatic"
echo -n "YOUR_STRONG_RANDOM_SESSION_SECRET_64_CHARS" | gcloud secrets versions add kira-session-secret --data-file=-

gcloud secrets create kira-firebase-private-key --replication-policy="automatic"
echo -n "-----BEGIN PRIVATE KEY-----\n..." | gcloud secrets versions add kira-firebase-private-key --data-file=-

gcloud secrets create kira-firebase-client-email --replication-policy="automatic"
echo -n "kira-agency-runner@kira-4b051.iam.gserviceaccount.com" | gcloud secrets versions add kira-firebase-client-email --data-file=-

gcloud secrets create kira-google-client-secret --replication-policy="automatic"
echo -n "GOCSPX-your-google-oauth-secret" | gcloud secrets versions add kira-google-client-secret --data-file=-
```

---

## 4. Client Bundle Audit Verification

A post-build audit verifies that no server-only secrets leaked into `.next/static/`:
```bash
# Audit command to ensure no private keys or secrets exist in public client bundles:
grep -rn "BEGIN PRIVATE KEY" .next/static/ || echo "[AUDIT PASS] No private keys in client bundles."
grep -rn "kira-session-secret" .next/static/ || echo "[AUDIT PASS] No session secrets in client bundles."
```
