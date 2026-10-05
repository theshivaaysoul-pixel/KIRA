# KIRA Agency Manager

Central management platform for **KIRA Agency** — built with Next.js, TypeScript, Tailwind CSS, Firebase Auth, and Google Cloud Storage.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Auth | Firebase Auth (client) + Firebase Admin SDK (server) |
| Storage | Google Cloud Storage |
| UI | Custom design system, Lucide icons |
| Theme | next-themes (light / dark) |

---

## Architecture

```
Browser (React / Next.js)
  │  Firebase ID Token (Authorization: Bearer <token>)
  ▼
Next.js API Routes (Server)
  │  ├─ Verifies token via Firebase Admin SDK
  │  ├─ Calls GCSStorageService (server-only)
  │  └─ Business logic / services
  ▼
Google Cloud Storage (private bucket)
```

**Layered separation:**
```
UI (React components)
↓
API (Next.js route handlers)
↓
Services (business logic)
↓
Repositories (data access)
↓
Storage (GCS / Firestore)
```

The backend API is mobile-ready — a future React Native / Expo app can consume the same API endpoints.

---

## Project Structure

```
src/
  app/
    (auth)/login/        ← Login page
    (dashboard)/
      layout.tsx         ← Protected layout (auth guard)
      dashboard/         ← Dashboard page
    api/
      health/            ← GET /api/health
      health/storage/    ← GET /api/health/storage (authenticated)
      auth/me/           ← GET /api/auth/me (authenticated)
    layout.tsx           ← Root layout
    providers.tsx        ← Client providers (Auth, Toast, Theme)
  components/
    ui/                  ← Reusable UI: Button, Card, Input, Badge, Avatar, Toast, Loading
    layout/              ← AppShell, Sidebar
    dashboard/           ← SystemStatusCard, StorageDiagnostic
  contexts/
    AuthContext.tsx      ← Firebase Auth context + useAuth hook
  hooks/
    useStorageHealth.ts  ← GCS health check hook
  lib/
    auth/
      firebase-client.ts ← Firebase client SDK (browser-safe)
      firebase-admin.ts  ← Firebase Admin SDK (server-only)
    storage/
      storage-service.ts ← IStorageService interface
      gcs-storage-service.ts ← GCS implementation
      index.ts           ← Singleton export
    types/index.ts       ← Shared TypeScript types
    utils/api.ts         ← API helpers (auth, response formatting)
```

---

## Local Setup

### 1. Clone and install

```bash
cd agency-manager
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials. **Never commit this file.**

### 3. Firebase setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create or select a project
3. Enable **Authentication** → Sign-in method → **Google** and **Email/Password**
4. Enable **Firestore Database**
5. Get **Frontend config**: Project Settings → Your apps → Web → Config  
   → Set `NEXT_PUBLIC_FIREBASE_*` variables
6. Get **Admin credentials**: Project Settings → Service Accounts → Generate new private key  
   → Set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`

### 4. Google Cloud Storage setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable **Cloud Storage API**
3. Create a bucket (private, uniform access control)
4. Create a **Service Account** with `Storage Object Admin` role on the bucket
5. Download the JSON key
6. Set credentials (choose one method):
   - `GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json`, **or**
   - `GOOGLE_CLOUD_CLIENT_EMAIL` + `GOOGLE_CLOUD_PRIVATE_KEY` (inline)
7. Set `GOOGLE_CLOUD_PROJECT_ID` and `GOOGLE_CLOUD_STORAGE_BUCKET`

### 5. Run development server

```bash
npm run dev
# → http://localhost:3000
```

### 6. Verify GCS connection

1. Sign in to the app
2. Go to Dashboard
3. Click **Run Test** on the **Google Cloud Storage** card
4. All 5 checks should pass: Connection → Bucket Access → Write → Read → Delete

---

## Environment Variables

See [`.env.example`](.env.example) for the full list with documentation.

| Variable | Side | Purpose |
|---------|------|---------|
| `NEXT_PUBLIC_FIREBASE_*` | Client | Firebase web app config |
| `FIREBASE_PROJECT_ID` | Server | Firebase Admin Auth |
| `FIREBASE_CLIENT_EMAIL` | Server | Firebase Admin Auth |
| `FIREBASE_PRIVATE_KEY` | Server | Firebase Admin Auth |
| `GOOGLE_CLOUD_PROJECT_ID` | Server | GCS project |
| `GOOGLE_CLOUD_STORAGE_BUCKET` | Server | GCS bucket name |
| `GOOGLE_APPLICATION_CREDENTIALS` | Server | Path to GCS key file (optional) |
| `GOOGLE_CLOUD_CLIENT_EMAIL` | Server | GCS inline credentials (optional) |
| `GOOGLE_CLOUD_PRIVATE_KEY` | Server | GCS inline credentials (optional) |

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| GET | `/api/health` | No | App / config health check |
| GET | `/api/health/storage` | Yes | GCS / Drive write/read/delete test |
| GET | `/api/auth/me` | Yes | Current user profile |
| POST | `/api/diagnostic/repository` | Yes | End-to-end repository diagnostic suite |
| POST | `/api/admin/storage/backup` | Admin | Manual backup of database JSON collections |
| GET | `/api/admin/storage/backups` | Admin | List backups with resource/reason filter & pagination |
| POST | `/api/admin/storage/recover` | Admin | Restore database collection from verified backup |

---

## Phase 2: GCS Data Safety & Persistence Architecture

### 1. Storage Safety Architecture
```
API / Service
      ↓
Repository Layer (PlatformRepository, SocialAccountRepository, etc.)
      ↓
JsonRepository (BaseJsonRepository)
      ↓
DataSafetyService
      ↓
StorageService (IStorageService)
      ↓
GCSStorageService / DriveStorageService
      ↓
Cloud Storage (Google Cloud Storage / Google Drive 5TB)
```

> **Architecture Note**: GCS + JSON persistence is an MVP/persistence architecture, not a full relational database transaction system.

### 2. Safe Write Pipeline
Every database write strictly enforces:
1. In-memory Zod schema validation
2. Concurrency check (optimistic concurrency via SHA-256 integrity hash)
3. Automated pre-write backup creation
4. Deterministic JSON serialization (sorted keys)
5. SHA-256 checksum calculation
6. Server-side upload to storage
7. **Read-back from storage**
8. Read-back JSON parsing & corruption detection
9. Read-back schema validation
10. Read-back checksum comparison with written payload
11. Return success only after full verification

### 3. Backup System & Paths
- Live Collections: `database/<resource>.json` (e.g., `database/platforms.json`)
- Backups: `database/backups/<resource>/<resource>-<timestamp>.json`
- Companion Metadata: `database/backups/<resource>/<resource>-<timestamp>.meta.json`
- Backup reasons: `BEFORE_UPDATE`, `BEFORE_DELETE`, `MANUAL_BACKUP`, `RECOVERY`, `SYSTEM_SAFETY`.

### 4. Integrity & Corruption Protection
- **Deterministic Checksum**: Node.js `crypto` SHA-256 over deterministic JSON stringification.
- **Malformed JSON Protection**: If a database file is corrupted or contains malformed JSON, the safety layer throws `StorageCorruptionError` and **NEVER** silently replaces it with `[]` or default values. Corrupted files are preserved for forensics.
- **Path Traversal Protection**: All backup paths are validated against `^database/backups/([a-z0-9-]+)/\1-[0-9A-Za-z_-]+\.json$` and restricted strictly to allowed database resources.
- **Pre-Recovery Safety Snapshot**: Before restoring any backup, a safety backup of the current live file is created automatically with reason `RECOVERY`.

### 5. Backup Retention
- Configurable via `GCS_BACKUP_RETENTION_DAYS` (default: 30 days).
- Invocable by admin maintenance operations.
- Never deletes live database files or backups newer than the retention threshold.

---

## Phase 3 — Authentication & Authorization Architecture

### 1. Security Boundary Declaration
> **Frontend permission checks are UX only.**
> **Server-side authorization is the real, immutable security boundary.**

### 2. Identity Mapping Flow
```
Firebase Authenticated User (ID Token)
                 ↓
Firebase Admin `verifyIdToken(idToken)` (uid, verified email)
                 ↓
`TeamMemberRepository.findByAuthIdentity(uid, email)`
                 ↓
Resolved TeamMember Profile (`USR-XXXXXX`, status, role)
                 ↓
Status Validation (`ACTIVE` allowed, `SUSPENDED` / `INACTIVE` / `INVITED` blocked)
                 ↓
Permission Matrix Check (`hasPermission(role, permission)`)
                 ↓
Resource Authorization Check (IDOR & Assignment Guard)
                 ↓
Authorized Service Operation
```

### 3. All 7 Roles
* **OWNER**: Full agency privilege (35/35 permissions), system administration, storage recovery, assigning OWNER role.
* **ADMIN**: Full operational management (33 permissions), storage backups, team management, account administration. Cannot perform storage recovery or assign OWNER role without explicit permission.
* **MANAGER**: Manages assigned accounts, content creation & approval, calendar, team visibility.
* **EDITOR**: Content creation & updating, asset workflow, editorial calendar. Cannot approve content or manage team.
* **DESIGNER**: Content viewing & asset updating, task workflows.
* **ANALYST**: Read-only operational data access across analytics, accounts, content, calendar, and activity logs.
* **VIEWER**: Strict read-only access to permitted modules. Cannot create, update, delete, approve, or manage settings/storage.

### 4. Role Permission Matrix
| Capability | OWNER | ADMIN | MANAGER | EDITOR | DESIGNER | ANALYST | VIEWER |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `dashboard.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `accounts.read` | ✓ | ✓ | ✓ | - | - | ✓ | ✓ |
| `accounts.create / update / delete` | ✓ | ✓ | Update only | - | - | - | - |
| `content.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `content.create / update` | ✓ | ✓ | ✓ | ✓ | Update assets | - | - |
| `content.approve` | ✓ | ✓ | ✓ | - | - | - | - |
| `calendar.read` | ✓ | ✓ | ✓ | ✓ | - | ✓ | ✓ |
| `analytics.read` | ✓ | ✓ | ✓ | ✓ | - | ✓ | ✓ |
| `tasks.read / update` | ✓ | ✓ | ✓ | ✓ | ✓ | - | - |
| `team.read` | ✓ | ✓ | ✓ | - | - | - | - |
| `team.role.update` | ✓ | ✓ | - | - | - | - | - |
| `settings.update` | ✓ | ✓ | - | - | - | - | - |
| `storage.backup` | ✓ | ✓ | - | - | - | - | - |
| `storage.recover` | ✓ | - | - | - | - | - | - |
| `system.admin` | ✓ | - | - | - | - | - | - |

### 5. Critical Server-Side Safeguards
* **Self-Promotion Block**: A user cannot modify their own role (`CANNOT_MODIFY_OWN_ROLE`).
* **Non-Owner Escalation Block**: Only an existing `OWNER` can promote/invite an `OWNER` (`FORBIDDEN_CANNOT_ASSIGN_OWNER`).
* **Hierarchy Enforcement**: An `ADMIN` cannot modify a peer `ADMIN` or an `OWNER` (`FORBIDDEN_HIERARCHY_VIOLATION`).
* **Last OWNER Protection**: An active `OWNER` cannot be demoted, deactivated, suspended, or deleted if they are the sole remaining active owner (`CANNOT_REMOVE_LAST_OWNER`).
* **Status Enforcement**: `SUSPENDED` and `INACTIVE` accounts are blocked at the server boundary with 403 `ACCOUNT_SUSPENDED` / `ACCOUNT_INACTIVE`.
* **Zero Silent Owners**: If an authenticated Firebase identity does not match any registered `TeamMember`, the request fails with 403 `NO_TEAM_MEMBER` — an owner account is NEVER silently created.
* **Storage Admin Security**: `storage.recover` requires highest-level permission; non-owners/unauthorized roles receive 403 `FORBIDDEN`.
* **Security Activity Logging**: Lifecycle events (`LOGIN`, `LOGOUT`) and security operations (`ROLE_CHANGED`, `ACCESS_DENIED`, `TEAM_MEMBER_SUSPENDED`, `TEAM_MEMBER_REACTIVATED`) are recorded in `ActivityLog` while stripping all tokens, passwords, and sensitive keys.

---

## Phase Completion Status

- [x] **Phase 0**: Project foundation, Firebase Auth, Google Cloud Storage abstraction, health checks, responsive design system.
- [x] **Phase 1**: 11 Domain models, strict Zod validation layer, BaseJsonRepository, relationships, duplicate prevention, live storage verification.
- [x] **Phase 2**: GCS Data Safety layer, safe write pipeline with read-back verification, deterministic SHA-256 checksums, automated versioned backups, controlled recovery, corruption detection, path traversal protection, optimistic concurrency, and admin storage diagnostic UI.
- [x] **Phase 3**: Authentication & Roles, server-side authorization layer, stable `authUid` to `TeamMember` mapping, centralized 35-permission matrix for all 7 roles, last-owner safeguards, self-promotion blocks, IDOR protection, role-filtered navigation, client `usePermission` hook, and real role/status administration UI.
- [x] **Phase 4**: Dashboard UI & Aggregated Real Data API, Instagram-inspired operational interface, server-side `DashboardService`, `GET /api/dashboard/overview`, 4 primary KPI cards + secondary metrics, real media previews/thumbnails, upcoming scheduled publications, overdue-aware task management, live ActivityLog audit feed, attention banner for failed publications and account connection errors, permission-scoped quick actions, and automated verification across all 7 roles with live cloud storage lifecycle tests.

---

## Phase 4: Dashboard UI & Aggregated API

### 1. Architectural Overview
Phase 4 transforms the initial system diagnostic dashboard into a high-performance, Instagram-inspired operational command center powered exclusively by real data from cloud storage repositories.

```
Browser Client (React / Next.js)
  │  Bearer <FirebaseIdToken>
  ▼
GET /api/dashboard/overview
  │  requirePermission(req, 'dashboard.read')
  ▼
DashboardService (Server-Side)
  │  ├─ Loads collections concurrently via BaseJsonRepository
  │  ├─ Enforces Role-Aware Scoping (OWNER/ADMIN vs MANAGER vs EDITOR/DESIGNER vs ANALYST vs VIEWER)
  │  ├─ Computes real operational metrics (Active Accounts, Content, Scheduled Posts, Tasks)
  │  ├─ Filters Attention Items (FAILED publications, CONNECTION_ERROR accounts)
  │  ├─ Formats Recent Content (real assets/thumbnails or clean typographic placeholders)
  │  ├─ Prepares Upcoming Schedule (nearest queued publications with agency timezone)
  │  ├─ Calculates Overdue Tasks (dueDate < Date.now() with URGENT sorting)
  │  └─ Sanitizes & humanizes Recent Activity logs
  ▼
Strict JSON Response (Mobile-ready, Expo/React Native compatible)
```

### 2. API Contract: `GET /api/dashboard/overview`
* **Authentication**: Required (`Authorization: Bearer <token>`)
* **Authorization**: Requires `dashboard.read` permission
* **Response Shape**:
```json
{
  "success": true,
  "data": {
    "metrics": {
      "activeAccounts": 2,
      "activeContent": 14,
      "scheduledPublications": 3,
      "pendingTasks": 5,
      "publishedContent": 28,
      "activeTeamMembers": 6,
      "failedPublications": 0,
      "accountConnectionErrors": 0
    },
    "attentionItems": [
      {
        "type": "PUBLICATION_FAILED",
        "title": "Publication Failed",
        "description": "Instagram post failed to publish: Token expired",
        "severity": "ERROR",
        "entityId": "PUB-000001"
      }
    ],
    "recentContent": [
      {
        "id": "CNT-000001",
        "title": "Summer Campaign Teaser",
        "contentType": "VIDEO",
        "status": "PRODUCTION",
        "createdAt": "2026-09-27T10:00:00Z",
        "creatorName": "Alex Designer",
        "accountHandle": "kira_agency",
        "platformName": "Instagram",
        "thumbnailUrl": "/thumbnails/video-preview.jpg"
      }
    ],
    "upcomingPublications": [
      {
        "id": "PUB-000002",
        "contentId": "CNT-000001",
        "contentTitle": "Summer Campaign Teaser",
        "accountHandle": "kira_agency",
        "platformName": "Instagram",
        "scheduledAt": "2026-09-30T15:00:00Z",
        "status": "QUEUED"
      }
    ],
    "tasks": [
      {
        "id": "TSK-000001",
        "title": "Finalize brand guidelines reel",
        "priority": "URGENT",
        "status": "IN_PROGRESS",
        "assigneeName": "Alex Designer",
        "dueDate": "2026-09-26T18:00:00Z",
        "isOverdue": true
      }
    ],
    "recentActivity": [
      {
        "id": "ACT-000001",
        "action": "CREATE",
        "label": "Created content",
        "userName": "Sarah Manager",
        "entityType": "CONTENT",
        "entityId": "CNT-000001",
        "timestamp": "2026-09-27T10:00:00Z"
      }
    ],
    "agencySettings": {
      "agencyName": "KIRA Agency",
      "timezone": "America/New_York",
      "dateFormat": "YYYY-MM-DD"
    }
  }
}
```

### 3. Metric & Calculation Definitions
* **Active Accounts**: Count of `SocialAccount` where `status === 'ACTIVE'`.
* **Active Content**: Count of `Content` excluding `ARCHIVED` status.
* **Scheduled Publications**: Count of `ContentPublication` where `status === 'QUEUED'` (or `SCHEDULED`).
* **Pending Tasks**: Count of `Task` where `status` is `'TODO'`, `'IN_PROGRESS'`, or `'REVIEW'`. Completed and cancelled tasks are excluded.
* **Overdue Tasks**: Tasks where `new Date(dueDate).getTime() < Date.now()` and status is not completed/cancelled. Automatically prioritized to top of task list with red alert badges.
* **Attention Items**: Surfaces real failure events requiring team intervention — `ContentPublication.status === 'FAILED'` and `SocialAccount.status === 'CONNECTION_ERROR'`.

### 4. UI Components
* **Header & Welcome**: Real authenticated user avatar, name, role badge, dynamic agency name from `AgencySettings`, and manual cloud refresh button.
* **Attention Banner**: Only visible when real issues exist in storage; displays critical failure counts and warning details.
* **KPI Metrics Grid**: 4 prominent gradient-tinted cards + secondary operational metrics bar.
* **Recent Content Gallery**: Instagram-inspired visual card grid with content type icons, workflow status badges, platform tags, and media thumbnail support.
* **Upcoming Schedule**: Chronological listing of upcoming scheduled posts with account handles and localized publication timestamps.
* **Task Overview**: Prioritized list with overdue indicators, assignee names, and status tags.
* **Recent Activity Feed**: Real audit log with action-specific icons, human-readable labels, and sanitized entity references.
* **Quick Actions**: Permission-aware operational triggers (`Create Content`, `Schedule Post`, `Assign Task`, `Add Account`, `Team Management`, `System Backups`).
* **Preserved Diagnostic Panel**: Collapsible panel retaining all Phase 0-3 health checks, storage safety metrics, user profile, and team role administration.

---

## Phase 5: Dynamic Platform Management

### 1. Dynamic Platform Principle
> **Platforms are dynamic database records, NOT hard-coded frontend components or enum types.**
* **Source of Truth**: The database (`database/platforms.json` via `PlatformRepository`) is the sole source of truth for platforms, their configuration, active state, and supported capabilities.
* **Extensible without Schema Changes**: Adding a new platform (e.g., *Threads*, *LinkedIn*, *Bluesky*, or a custom enterprise webhook) requires creating a new `Platform` record via the API/UI. No database schema alterations, backend migrations, or UI component refactoring is required.
* **Normalization**: `SocialAccount` and content publications reference platforms solely via `platformId` (`PLT-XXXXXX`). Platform metadata is never duplicated inside account records.

### 2. Platform Domain Model
```typescript
interface Platform {
  id: string; // e.g. "PLT-000001" (server-generated)
  name: string; // Display name, e.g. "Instagram"
  slug: string; // Lowercase, URL-safe unique key, e.g. "instagram"
  icon?: string; // Approved icon name / safe icon key
  description?: string; // Optional platform summary
  isActive: boolean; // Active state for new account connections
  capabilities: Record<PlatformCapability, boolean>; // Supported content formats and workflows
  createdAt: string; // ISO 8601 UTC timestamp
  updatedAt: string; // ISO 8601 UTC timestamp
}
```

### 3. Capability System
The platform system defines 10 discrete capability switches validated against `PLATFORM_CAPABILITIES`:
* **Content Formats**: `text`, `image`, `video`, `carousel`, `story`, `shortVideo`
* **Broadcast**: `live`
* **Workflows**: `scheduling`, `analytics`, `publishing`

UI components query these capabilities dynamically to determine allowed post formats and workflow actions.

### 4. Slug Validation & Constraints
* **Format**: Must match `^[a-z0-9]+(?:-[a-z0-9]+)*$` (strictly lowercase alphanumeric with hyphens).
* **Uniqueness**: Enforced server-side during both platform creation and updates.
* **Safety**: Rejects uppercase characters, whitespace, special symbols, and path traversal attempts (`../../platform`).
* **Stability**: Slugs remain stable and immutable after creation to protect future publishing adapters.

### 5. Relationship Protection & Soft Deactivation
* **Zero Broken References**: Before deleting any platform, `PlatformService` checks for existing `SocialAccount` references where `account.platformId === platform.id`.
* **Deletion Block**: If any connected social accounts exist, destructive physical deletion is blocked with a controlled `409 PLATFORM_IN_USE` error detailing the number of connected accounts.
* **Soft Deactivation**: Platforms can be deactivated (`isActive: false`). Deactivated platforms:
  * Remain in the database and visible to authorized admins.
  * Are hidden from new account connection selectors.
  * Preserve all historical analytics, published content, and audit logs.

### 6. Idempotent Platform Seeding
* Seeds standard default platforms (`instagram`, `tiktok`, `x`, `youtube`, `facebook`, `discord`, `kick`, `snapchat`).
* **Safe & Non-Destructive**: Checks existing records by slug. Missing platforms are created; existing platforms are preserved without overwriting custom agency configuration.
* Returns real operational summary: `{ created: number, skipped: number, failed: number }`.

### 7. Platform API Endpoints
All endpoints enforce Firebase token authentication, role-based authorization, and GCS transactional data safety:
* `GET /api/platforms`: Lists platforms with server-side search (`q`), active status filter (`isActive`), capability filter (`capability`), sorting (`name`, `createdAt`, `updatedAt`, `status`), and pagination (`page`, `limit`).
* `POST /api/platforms`: Creates a new platform with server-generated ID (`PLT-XXXXXX`), unique slug check, capability validation, and activity audit logging (`platforms.create`).
* `GET /api/platforms/:id`: Retrieves platform detail including live associated account count (`accountCount`).
* `PATCH /api/platforms/:id`: Updates mutable platform fields (name, description, icon, capabilities, active status) with slug uniqueness enforcement and activity logging (`platforms.update`).
* `DELETE /api/platforms/:id`: Performs relationship-checked deletion (`platforms.delete`). Blocks deletion with 409 if accounts exist.
* `POST /api/platforms/seed`: Idempotently provisions default platforms (`platforms.create`).

### 8. Role Authorization Matrix for Platforms
| Role | `platforms.read` | `platforms.create` | `platforms.update` | `platforms.delete` |
|---|:---:|:---:|:---:|:---:|
| **OWNER** | ✅ | ✅ | ✅ | ✅ |
| **ADMIN** | ✅ | ✅ | ✅ | ✅ |
| **MANAGER** | ✅ | ❌ | ❌ | ❌ |
| **EDITOR** | ✅ | ❌ | ❌ | ❌ |
| **DESIGNER** | ✅ | ❌ | ❌ | ❌ |
| **ANALYST** | ✅ | ❌ | ❌ | ❌ |
| **VIEWER** | ✅ | ❌ | ❌ | ❌ |

---

## Phase 6 — Social Account Management

### Overview
Phase 6 delivers full Social Account lifecycle management backed by real Google Cloud Storage (`database/social-accounts.json`). Every feature is end-to-end verified against live GCS — no mocks, no fake responses.

### 1. Domain Model

```ts
interface SocialAccount {
  id: string;                    // ACC-XXXXXX (server-generated)
  platformId: string;            // FK → Platform.id
  accountName: string;           // Display name (trimmed, 1–150 chars)
  username: string;              // Normalized handle (leading @ stripped)
  status: SocialAccountStatus;   // 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | 'CONNECTION_ERROR'
  profileUrl?: string;           // Must be HTTP/HTTPS URL
  avatarUrl?: string;            // Must be HTTP/HTTPS URL
  niche?: string;                // Content category (max 100 chars)
  description?: string;          // Internal notes (max 500 chars)
  assignedManagerId?: string;    // FK → TeamMember.id (must be ACTIVE)
  externalAccountId?: string;    // Platform-native ID (unique per platform)
  createdAt: string;             // ISO 8601 UTC
  updatedAt: string;             // ISO 8601 UTC
}
```

**Extended read model** (`SocialAccountWithRelations`):
```ts
interface SocialAccountWithRelations extends SocialAccount {
  platform?: Platform;           // Resolved platform details
  assignedManager?: TeamMember;  // Resolved manager details
  publicationCount: number;      // Live reference count
  analyticsCount: number;        // Live reference count
  taskCount: number;             // Live reference count
}
```

### 2. Validation Rules (Server-Side, Zod)
- **Required**: `platformId`, `accountName`, `username`
- **Username**: Trimmed, `@` prefix stripped automatically, max 100 characters
- **URLs**: `profileUrl` and `avatarUrl` must be valid `http://` or `https://` URLs (rejects `ftp://`, `javascript:`, data URIs)
- **Uniqueness**: `username` is unique per `platformId`; `externalAccountId` is unique per `platformId` when provided
- **Platform constraint**: Referenced platform must exist AND be `isActive === true` for new account creation
- **Manager constraint**: `assignedManagerId` must reference a team member with `status === 'ACTIVE'`

### 3. Relationship Safety & Archive-on-Delete
Before permanently deleting a social account, `SocialAccountService.deleteOrArchiveAccount()` checks for live references in:
- `ContentPublication` (via `socialAccountId`)
- `AnalyticsSnapshot` (via `socialAccountId`)
- `Task` (via `socialAccountId`)

**Behaviour:**
| References Exist | `forcePermanent: false` | `forcePermanent: true` |
|:---:|:---:|:---:|
| Yes | Soft-archive (`status → ARCHIVED`) | `AccountInUseError` (409) |
| No | Permanent delete | Permanent delete |

Soft-archived accounts preserve all historical records and remain visible to OWNER/ADMIN.

### 4. Platform Deactivation Compatibility
- Accounts connected to a platform that is later **deactivated** remain fully intact and readable.
- Only **new account creation** against a deactivated platform is blocked.
- Reactivating an account (`status → ACTIVE`) on a deactivated platform is also blocked.

### 5. Social Account API Endpoints

All endpoints require Firebase authentication. Authorization uses `accounts.*` permissions.

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| `GET` | `/api/social-accounts` | `accounts.read` | List with search, filter, sort, pagination |
| `POST` | `/api/social-accounts` | `accounts.create` | Create account with full validation |
| `GET` | `/api/social-accounts/:id` | `accounts.read` | Get account with live relation counts |
| `PATCH` | `/api/social-accounts/:id` | `accounts.update` | Update account fields |
| `DELETE` | `/api/social-accounts/:id` | `accounts.delete` | Delete or auto-archive if referenced |

**GET `/api/social-accounts` query parameters:**
- `search` — full-text search across `accountName`, `username`, `niche`, `description`
- `platformId` — filter by platform
- `status` — filter by status (`ACTIVE`, `INACTIVE`, `ARCHIVED`, `CONNECTION_ERROR`, `ALL`)
- `assignedManagerId` — filter by assigned manager
- `sortBy` — `accountName`, `username`, `createdAt`, `updatedAt`, `status`
- `sortOrder` — `asc` | `desc`
- `page`, `pageSize` — pagination

### 6. Role Authorization Matrix for Accounts

| Role | `accounts.read` | `accounts.create` | `accounts.update` | `accounts.delete` |
|---|:---:|:---:|:---:|:---:|
| **OWNER** | ✅ | ✅ | ✅ | ✅ |
| **ADMIN** | ✅ | ✅ | ✅ | ✅ |
| **MANAGER** | ✅ | ✅ | ✅ | ✅ |
| **MEMBER** | ✅ | ✅ | ✅ | ❌ |
| **EDITOR** | ❌ | ❌ | ❌ | ❌ |
| **DESIGNER** | ❌ | ❌ | ❌ | ❌ |
| **ANALYST** | ✅ | ❌ | ❌ | ❌ |
| **VIEWER** | ✅ | ❌ | ❌ | ❌ |

### 7. Verification

Phase 6 is backed by an automated test suite (`scripts/verify-phase6.mjs`) running against live GCS:

```
PHASE 6 VERIFICATION COMPLETE: 66 PASSED, 0 FAILED
```

| Section | Tests | Result |
|---------|-------|--------|
| 1. Validation Layer | 6 | ✅ |
| 2. Platform & Manager Integrity | 7 | ✅ |
| 3. GCS CRUD Persistence | 12 | ✅ |
| 4. Duplicate Prevention | 5 | ✅ |
| 5. Platform Deactivation Compatibility | 4 | ✅ |
| 6. Search, Filter, Sort, Pagination | 9 | ✅ |
| 7. Relationship Protection & Soft Archive | 11 | ✅ |
| 8. Role-Based Permissions Matrix | 7 | ✅ |
| 9. Security Activity Logging | 5 | ✅ |

---

## Phase 24: Production Deployment & Infrastructure

The application is fully containerized and configured for high-availability production deployment on Google Cloud.

### Production Architecture
- **Runtime / Hosting**: [Google Cloud Run](https://cloud.google.com/run) (Serverless container runtime, auto-scaling 1–10 instances, HTTP/2, automated HTTPS/TLS)
- **Containerization**: Multi-stage standalone Node.js 22 Alpine Docker image (`Dockerfile`) running unprivileged UID 1001 (`nextjs:nodejs`)
- **Storage**: [Google Cloud Storage](https://cloud.google.com/storage) (`kira-agency-manager-prod-storage`) with Uniform Bucket-Level Access, private objects, and Signed URLs
- **Identity & IAM**: Dedicated runtime service account `kira-agency-runner@kira-4b051.iam.gserviceaccount.com` under strict least-privilege role bindings
- **Secret Management**: Google Secret Manager (`SESSION_SECRET`, `FIREBASE_PRIVATE_KEY`, etc.) directly bound to container environment
- **CI/CD Automation**: GitHub Actions (`.github/workflows/production-deploy.yml`) and Google Cloud Build (`cloudbuild.yaml`)
- **Monitoring & Logging**: Structured JSON logging, Cloud Monitoring metrics, SLO tracking, and P1/P2 alert policies

### Operational Documentation
- [Production Environment & Secrets Audit](docs/PRODUCTION_ENV.md)
- [IAM Least Privilege Architecture](docs/IAM_LEAST_PRIVILEGE.md)
- [Production Operations Runbook & Rollback Guide](docs/PRODUCTION_RUNBOOK.md)
- [Monitoring, Logging & Alerting Guidelines](docs/MONITORING_AND_ALERTS.md)

### Verification & Testing
```bash
# Run complete test suite (unit, integration, security, e2e)
npm test

# Run CI pipeline gate
npm run test:ci

# Run production smoke test against live target
TARGET_URL="https://kira.agency" npm run test:smoke
```

### Architectural Limitation & Roadmap
> [!NOTE]
> KIRA Agency Manager uses GCS-backed atomic JSON persistence protected by `DataSafetyService` (atomic writes, read-back verification, and SHA-256 checksums). While resilient and cost-effective for current agency scale, it is not a full relational ACID database. The documented scaling roadmap transitions persistence to Cloud SQL (PostgreSQL) when traffic demands exceed GCS JSON concurrency limits.
