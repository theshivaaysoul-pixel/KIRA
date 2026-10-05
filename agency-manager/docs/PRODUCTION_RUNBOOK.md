# KIRA Agency Manager — Production Runbook & Operations Manual

This runbook documents emergency procedures, deployment rollbacks, backup strategies, data restoration processes, and disaster recovery plans for KIRA Agency Manager in production.

---

## 1. Zero-Downtime Deployment Rollback

Google Cloud Run maintains an immutable history of revisions. If a faulty deployment passes CI but triggers production anomalies, traffic can be redirected instantly to the previous stable revision.

### Step 1: List Recent Revisions
```bash
gcloud run revisions list \
  --service=kira-agency-manager-prod \
  --region=us-central1 \
  --limit=5 \
  --format="table(name,active,creationTimestamp)"
```

### Step 2: Instant Traffic Rollback (0 Seconds Downtime)
Redirect 100% of user traffic to the known stable revision:
```bash
gcloud run services update-traffic kira-agency-manager-prod \
  --region=us-central1 \
  --to-revisions=kira-agency-manager-prod-00042-xyz=100
```

### Step 3: Verify Service Health
Run the smoke test against the live production service:
```bash
TARGET_URL="https://kira.agency" node scripts/smoke-test.mjs
```

---

## 2. Production Backup & Retention Strategy

All core collections (`users`, `platforms`, `social_accounts`, `content`, `content_publications`, `tasks`, `analytics`, `activity_logs`, `team_members`) are protected by the Phase 2 `DataSafetyService`.

### Write Safety Pipeline
Every write follows the strict 10-step atomic flow:
```text
Validate Input
  ↓
Read Current Object
  ↓
Validate Current Schema & Checksum
  ↓
Generate Backup: database/backups/<collection>_<timestamp>_<checksum>.json
  ↓
Update Collection in Memory
  ↓
Validate Updated Collection
  ↓
Serialize & Compute SHA-256 Checksum
  ↓
Write with GCS Generation Precondition (Optimistic Concurrency)
  ↓
Read Back Immediately from GCS
  ↓
Validate Checksum & Size Matches
```

### Backup Lifecycle & Retention
- **Frequency**: Point-in-time snapshot created before every non-trivial mutation.
- **Location**: `gs://kira-agency-manager-prod-storage/database/backups/`
- **Retention Rule**: 30-day lifecycle rule managed via GCS Object Lifecycle Management.
- **Daily Archive**: Periodic full-system snapshot archive created daily at 02:00 UTC.

---

## 3. Controlled Data Recovery Procedure

If a data corruption or accidental deletion occurs:

### Step 1: Lock Writes (Maintenance Mode or Scale Down)
If necessary to prevent race conditions during recovery:
```bash
# Temporarily set max instances to 1 or pause traffic
gcloud run services update kira-agency-manager-prod --region=us-central1 --max-instances=1
```

### Step 2: Inspect Available Backups
```bash
gcloud storage ls --long gs://kira-agency-manager-prod-storage/database/backups/
```

### Step 3: Validate Backup Integrity
Download the target snapshot to an isolated verification scratch area:
```bash
gcloud storage cp gs://kira-agency-manager-prod-storage/database/backups/content_20261001T040000Z_abc123.json ./scratch/
node -e "
  const fs = require('fs');
  const data = JSON.parse(fs.readFileSync('./scratch/content_20261001T040000Z_abc123.json', 'utf8'));
  console.log('Record count:', data.records?.length || data.length);
"
```

### Step 4: Perform Atomic Restore via GCS
Copy the verified backup over the active database collection:
```bash
gcloud storage cp \
  gs://kira-agency-manager-prod-storage/database/backups/content_20261001T040000Z_abc123.json \
  gs://kira-agency-manager-prod-storage/database/content.json
```

### Step 5: Execute Data Integrity Audit
Hit the protected admin data-health endpoint to confirm schema consistency and zero broken references:
```bash
curl -H "Authorization: Bearer <ADMIN_SESSION_TOKEN>" \
  https://kira.agency/api/admin/data-health
```

---

## 4. Architectural Limitation & Future Scalability Path

> [!IMPORTANT]
> **Storage Architecture Limitation**:
> KIRA Agency Manager currently utilizes GCS-backed JSON persistence (`BaseJsonRepository` backed by `GCSStorageService` with `DataSafetyService` protections).
>
> While robust with atomic writes, read-back verification, and SHA-256 checksums, **it is NOT a full relational ACID database**.
>
> **Future Scalability Roadmap**:
> When concurrent write throughput exceeds 25 writes/second or total collection sizes exceed 50MB, migrate persistence from GCS JSON to Google Cloud SQL (PostgreSQL). The existing repository interfaces (`IContentRepository`, `IPlatformRepository`, etc.) were intentionally designed to allow drop-in implementation swaps without altering business logic or API controllers.
