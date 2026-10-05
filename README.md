# KIRA — Autonomous Agency Operating System & Media Manager

<p align="center">
  <img src="./LOGOs/Favicon.png" alt="KIRA Logo" width="100" height="100" />
</p>

<p align="center">
  <strong>Next-Generation Multi-Tenant Agency Operations, Content Workflows, and Team Management Platform</strong>
</p>

---

## 🌟 Executive Summary

**KIRA** is an autonomous agency management system built for high-velocity creative agencies and digital media teams. It unifies team collaboration, content scheduling, multi-platform publishing (YouTube, Instagram, TikTok, LinkedIn, Twitter/X, Facebook), access governance, and cloud asset storage into a secure, single-pane-of-glass dashboard.

---

## 🏗️ Repository Architecture

This workspace is structured as a full-stack platform:

```
KIRA/
├── agency-manager/           # Next.js 15 App Router (Primary Agency Operating Portal)
│   ├── src/
│   │   ├── app/              # Dashboard pages, API endpoints, Auth handlers
│   │   │   ├── (auth)/       # Authentication & Registration workflows
│   │   │   ├── (dashboard)/  # Main operations (Team, Content, Calendar, Tasks, Admin)
│   │   │   └── api/          # Protected RESTful API routes with RBAC enforcement
│   │   ├── components/       # Reusable UI components, Modals, Feed, Layout
│   │   ├── contexts/         # React Contexts (AuthContext, ThemeProvider)
│   │   ├── hooks/            # Custom Hooks (usePermission, useTeam, useToast)
│   │   ├── lib/              # Core business services, Auth rules, Repositories
│   │   └── types/            # TypeScript Domain models & Validation schemas
│   └── public/               # Static brand assets, Icons, Backgrounds
├── backend/                  # Node.js / Express microservice integration
├── frontend/                 # React + Vite client application
├── LOGOs/                    # High-resolution brand assets & Identity logos
├── SETUP_GUIDE.md            # Detailed credentials & service account guide
├── GCS_SETUP.md              # Google Cloud Storage integration manual
└── package.json              # Monorepo command runner & orchestration
```

---

## 💻 Technology Stack

### Core Frameworks & Runtime

| Component | Technology | Version | Purpose |
|:---|:---|:---|:---|
| **Agency Manager** | [Next.js](https://nextjs.org/) | `16.3.6` | Primary full-stack framework with React App Router & Route Handlers |
| **Frontend Framework** | [React](https://react.dev/) | `19.2.8` | High-performance reactive UI rendering with React Server Components |
| **Type System** | [TypeScript](https://www.typescriptlang.org/) | `^5.0` | Strict end-to-end type safety, interfaces, and compile-time validation |
| **Backend Microservice** | [Express](https://expressjs.com/) | `^5.2.1` | Node.js REST API service for background file streaming and utilities |
| **Companion Client** | [Vite](https://vitejs.dev/) | `^8.3.0` | Fast bundle tooling for lightweight companion web application |

### Styling & Design System

- **Tailwind CSS v4**: Utility-first styling with modern CSS variables, glassmorphic themes, and responsive design tokens.
- **Lucide Icons (`lucide-react`)**: Clean, comprehensive vector iconography for consistent visual cues across all views.
- **Next Themes (`next-themes`)**: Seamless dark/light theme switching with zero layout shift and system-preference detection.

### Cloud, Storage & Authentication

- **Firebase Authentication**: Client & server identity verification supporting Google OAuth 2.0 and Email/Password credentials.
- **Firebase Admin SDK (`firebase-admin` v14)**: Secure server-side identity verification, session decoding, and privilege escalation guards.
- **Google Cloud Storage (`@google-cloud/storage` v8)**: Production storage bucket connector for media files, checksum verification, and backup archives.
- **Google APIs (`googleapis` v182)**: Native Google Workspace & Drive integration for high-capacity multi-terabyte storage.

### Security, Validation & State

- **Zod (`^4.6.5`)**: Strict schema validation for incoming HTTP request payloads, route query parameters, and domain models.
- **Helmet & CORS**: HTTP security header hardening and cross-origin resource sharing policies for backend services.
- **Express Rate Limit**: Granular IP and user-rate throttling against brute-force attacks and abuse.
- **Custom RBAC & Permission Matrix**: In-memory and GCS-persisted permission evaluation engine with designated leadership safeguards.

### Testing & Quality Assurance

- **Jest & Supertest**: Automated unit and integration testing suite for backend endpoints.
- **Oxlint & ESLint**: High-speed linting, AST static analysis, and code quality enforcement.
- **TypeScript Compiler (`tsc`)**: Static type diagnostics ensuring zero type regressions.

---

## 🚀 Core Features & Capabilities

### 1. Team Management & Instant Link Invites
- **Hierarchical Role Model**: Owner, Manager, Admin, Editor, Designer, Analyst, Viewer, and Member roles.
- **Shareable Invite Links**: Generate direct role-specific invitation links (`/login?invite=true&role=MEMBER`) that allow colleagues to onboard with one click.
- **Member Action Visibility & Protection**: Standard team members can view operations without permission to delete, modify, or suspend peers.
- **Last-Owner Protection**: Agency owners cannot be accidentally demoted, suspended, or deleted.

### 2. Fine-Grained Access Control & RBAC
- **Designated Leadership Accounts**:
  - **Agency Owner**: `theshivaaysoul@gmail.com` (Unrestricted administrative authority)
  - **Agency Manager**: `teamofkira@gmail.com` (Full operational management)
- **Granular Custom Grants**: Ability to toggle 12 distinct functional modules across Operations, Content, and System Administration.
- **Client & Server Guardrails**: Frontend controls backed by atomic server-side authorization checks (`requirePermission`).

### 3. Content Workflow & Multi-Platform Publishing
- **Publishing Pipeline**: Idea → Scripted → Media Ready → Approved → Scheduled → Published.
- **Multi-Platform Support**: YouTube, Instagram, TikTok, LinkedIn, Twitter/X, and Facebook.
- **Asset Storage & Media Preview**: High-speed previews, 30-day recycling bin protection, and automated archiving.

### 4. Interactive Calendar & Task Queues
- **Publishing Calendar**: Drag-and-drop campaign schedule, rescheduling workflows, and slot conflict warnings.
- **Task Management**: Real-time status boards (Kanban & List views), priority filters, and assignee tracking.

### 5. Data Health & Infrastructure Security
- **Cloud Storage Safety**: Automated Google Cloud Storage backup routines with SHA-256 integrity checksums.
- **Audit Activity Trail**: Real-time audit logs capturing sensitive operations (role adjustments, status toggles, deletion events).
- **Rate Limiting & Security Guardrails**: Brute-force protection and payload validation powered by Zod.

---

## 👥 Role Hierarchy & Permission Matrix

| Role | Hierarchy Rank | Operational Access | Team Management | Deletion Rights |
|:-----|:--------------:|:-------------------|:---------------:|:---------------:|
| **OWNER** | 100 | Full Access | Full Access | Full Access |
| **MANAGER** | 90 | Full Access | Full Access | Full Access |
| **ADMIN** | 80 | Full Operations | Subordinates Only | Subordinates Only |
| **EDITOR** | 40 | Content & Media | View Only | Draft Content Only |
| **DESIGNER** | 40 | Media Assets | View Only | None |
| **MEMBER** | 25 | Content, Calendar, Tasks | Invite Only | None |
| **ANALYST** | 20 | Analytics & Reports | View Only | None |
| **VIEWER** | 10 | Read-Only Dashboards | View Only | None |

---

## ⚡ Quick Start & Development

### Prerequisites
- **Node.js** >= 18.18.0
- **npm** >= 9.0.0
- Firebase Project credentials (Authentication & Firestore)

### 1. Installation
Clone the repository and install all dependencies:

```bash
# Install root orchestration packages
npm install

# Install Agency Manager Next.js app
cd agency-manager
npm install
```

### 2. Environment Configuration
Create `.env.local` inside the `agency-manager/` directory:

```env
# Firebase Client
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin SDK (Server)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# Agency Leadership
NEXT_PUBLIC_OWNER_EMAIL=theshivaaysoul@gmail.com
NEXT_PUBLIC_MANAGER_EMAIL=teamofkira@gmail.com
```

### 3. Launch Development Server

Run the development server from the repository root:

```bash
# Starts the Agency Manager on http://localhost:3000
npm run dev
```

Or run directly inside `agency-manager/`:

```bash
cd agency-manager
npm run dev
```

### 4. Build & Production Validation

```bash
cd agency-manager
npm run build
npm run start
```

To run a static type check:

```bash
cd agency-manager
npx tsc --noEmit
```

---

## 🔐 API Reference Overview

All administrative and operational routes reside under `/api/*`:

- `GET /api/auth/me` — Authenticated session identity, roles, and merged permissions.
- `GET /api/team` — List agency personnel with search and filters.
- `POST /api/team` — Invite new team member.
- `PATCH /api/team/[id]` — Update member role, status, or profile fields.
- `DELETE /api/team/[id]` — Remove member (restricted by hierarchy & last-owner rule).
- `GET /api/content` — Paginated content library with platform targets.
- `GET /api/admin/access-control` — Owner/Manager module permission governance.
- `POST /api/auth/activity` — Security and operational audit log stream.

---

## 📄 License & Attribution

Internal proprietary software developed for **KIRA Agency**. All rights reserved.
For setup assistance and security credentials, refer to [SETUP_GUIDE.md](./SETUP_GUIDE.md).
