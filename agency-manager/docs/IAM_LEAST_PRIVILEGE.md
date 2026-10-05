# KIRA Agency Manager — Google Cloud IAM & Least Privilege Architecture

This document specifies the Identity and Access Management (IAM) architecture, service identities, and role assignments ensuring strict least-privilege security across all production environments.

---

## 1. Service Identities Overview

Production operations are divided into distinct identities:

1. **Application Runtime Service Identity (`kira-agency-runner`)**
   - Identity: `kira-agency-runner@<PROJECT_ID>.iam.gserviceaccount.com`
   - Role: Assigned to the Google Cloud Run revision container.
   - Access: Restricted strictly to database JSON files, media storage, secret resolution, and metrics/log writing.

2. **CI/CD Deployment Identity (`kira-github-deployer`)**
   - Identity: `kira-github-deployer@<PROJECT_ID>.iam.gserviceaccount.com`
   - Access: Keyless authentication via Google Cloud Workload Identity Federation (WIF).
   - Privileges: Restricted to pushing images to Google Artifact Registry and updating Cloud Run service revisions.

---

## 2. IAM Role Audit for Application Runtime

The application runtime identity `kira-agency-runner` is assigned ONLY the following 4 discrete IAM roles:

| GCP IAM Role | Purpose | Justification |
|---|---|---|
| `roles/storage.objectUser` | Read/write/delete objects in production bucket | Required by `GCSStorageService` for `database/` and `media/` access. Cannot modify bucket metadata, IAM policies, or delete the bucket itself. |
| `roles/secretmanager.secretAccessor` | Access version payloads of application secrets | Allows Cloud Run to decrypt runtime secrets (`kira-session-secret`, `kira-firebase-private-key`). Cannot create, list, or delete secrets. |
| `roles/logging.logWriter` | Stream container logs to Cloud Logging | Enables structured JSON audit and operational logging. |
| `roles/monitoring.metricWriter` | Stream latency and request metrics to Cloud Monitoring | Enables real-time SLO monitoring, error rate tracking, and automated alerting. |

### Prohibited Roles
- ❌ `roles/owner` (Broad project control)
- ❌ `roles/editor` (Unrestricted resource modification)
- ❌ `roles/storage.admin` (Bucket administrative privileges)
- ❌ `roles/secretmanager.admin` (Secret management privileges)

---

## 3. Storage Bucket Access Perimeter

The production GCS bucket (`kira-agency-manager-prod-storage`) is hardened with Google Cloud storage security standards:

```bash
# 1. Enforce Uniform Bucket-Level Access (disables legacy object ACLs)
gcloud storage buckets update gs://kira-agency-manager-prod-storage --uniform-bucket-level-access

# 2. Enforce Public Access Prevention (blocks any public object exposure)
gcloud storage buckets update gs://kira-agency-manager-prod-storage --public-access-prevention

# 3. Bind runtime service account as objectUser
gcloud storage buckets add-iam-policy-binding gs://kira-agency-manager-prod-storage \
    --member="serviceAccount:kira-agency-runner@kira-4b051.iam.gserviceaccount.com" \
    --role="roles/storage.objectUser"
```

### Bucket Layout & Permissions
```text
gs://kira-agency-manager-prod-storage/
├── database/                   # Private JSON collections (Atomic read-write-verify)
│   └── backups/                # Automated point-in-time timestamped backups
├── media/                      # Private user-uploaded assets (Signed URLs only)
│   └── content/                # Content-associated images, videos, thumbnails
└── _health_check_probe.txt     # Safe write-read-delete probe for health checks
```

No anonymous read access is permitted. All media access is brokered through short-lived (15–60 minute) V4 Signed URLs generated on-demand by the authenticated API.
