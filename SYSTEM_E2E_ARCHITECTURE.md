# RedForge End-to-End System Architecture (Internal)

This document is an internal, full-detail architecture reference for the RedForge platform.  
It is intended for local engineering usage and should not be pushed unless explicitly approved.

## 1) System Overview

RedForge is a monorepo security platform with:
- A React SPA frontend (`artifacts/redforge`)
- An Express API backend (`artifacts/api-server`)
- Shared typed libraries (`lib/*`)
- PostgreSQL persistence via Drizzle ORM (`lib/db`)
- Security scanning and enrichment engine in the API runtime

At a product level, RedForge supports:
- Workspace-based multi-user security operations
- Project onboarding and target URL management
- Passive and active vulnerability scans
- Findings tracking, remediation generation, and compliance mapping
- Attack-chain correlation and attack-graph generation/streaming
- API key management for workspace integrations
- In-app notifications and Slack notifications
- Billing/subscriptions (Stripe)
- Admin controls (users, plans, coupons, activity, email logs)
- Security assistant chat with workspace-aware context

---

## 2) Monorepo Structure

Workspace package layout (pnpm workspaces):
- `artifacts/redforge`: Frontend app (React + Vite)
- `artifacts/api-server`: Backend service (Express + Node)
- `lib/db`: DB client, schema, typed exports
- `lib/api-client-react`: Generated typed API client + schema types
- `lib/api-spec`, `lib/api-zod`: Shared API contract/type packages
- `scripts`: Utility tasks (seed/typecheck helpers)

Root scripts:
- `pnpm run dev`: runs API + web concurrently
- `pnpm run typecheck`: lib + app-level type checks
- `pnpm run build`: typecheck + recursive package builds
- `pnpm run db:push`: schema migration push flow via workspace package
- `pnpm run db:seed`: seed flow via scripts package

---

## 3) Runtime Architecture

## 3.1 Frontend (React SPA)

Primary stack:
- React (with Wouter for routing)
- TanStack Query for server state and caching
- Vite build and dev server
- Tailwind/UI component system

Feature page domains:
- Public: landing, auth pages, changelog, status, legal
- Core app: dashboard, projects, scans, findings, analytics, reports
- Settings: workspace settings, API keys, billing
- Security assistant: chat
- Admin: dashboard, users, coupons, activity, email logs

Frontend behaviors:
- Lazy loading for most routes to reduce initial bundle cost
- Query client configured for `offlineFirst`, cache reuse, low retry churn
- Toast and UI-level feedback for mutations and status

## 3.2 Backend (Express API)

Core middleware and platform behavior:
- Compression enabled with SSE-aware filter
- CORS with credentials support
- Cookie parsing using session secret
- JSON/body parsing for API payloads
- Pino HTTP logging and request serialization
- Short-lived GET response cache headers for non-auth endpoints

Route families under `/api`:
- `/healthz`
- `/auth`
- `/projects`
- `/scans`
- `/findings`
- `/keys`
- `/workspace`
- `/dashboard`
- `/billing`
- `/webhooks`
- `/chat`
- `/attack-graph`
- `/admin`
- `/coupons`
- `/notifications`

## 3.3 Database Layer

Storage:
- PostgreSQL
- Drizzle ORM with typed table schemas and inferred types
- Connection pool with max connection and timeout guardrails

Multi-tenancy model:
- Workspaces are primary tenant boundary
- Workspace members map users to workspaces and roles
- Projects/scans/findings attach to workspace-owned projects

---

## 4) End-to-End Request/Data Flows

## 4.1 User Authentication and Session Flow

1. User authenticates via auth endpoints (email/password and OAuth routes present).
2. Backend stores session records in `sessions` table.
3. Client sends cookie or bearer token.
4. `requireAuth` middleware resolves user + workspace (with short in-memory cache).
5. Protected routes execute with resolved `(req.user, req.workspace)`.

## 4.2 Project and Scan Lifecycle

1. User creates/updates project with target URL and optional integration metadata.
2. User triggers scan (`POST /projects/:id/scan`).
3. Backend creates scan record (`PENDING`) and runs scanner orchestration.
4. Scanner updates logs/status incrementally (`RUNNING -> COMPLETED/FAILED`).
5. Findings are persisted and dashboard/finding APIs surface results to frontend.

## 4.3 Findings and Remediation Flow

1. Modules and enrichment stages generate normalized findings.
2. Findings deduplicated, scored, and stored against scan/project.
3. UI consumes `/findings` APIs for list/detail/status updates.
4. Fix generation endpoint provides remediation guidance/code artifacts.

## 4.4 Notification Flow

1. Scan completion and critical events trigger notification creation.
2. In-app notifications inserted into `notifications` table.
3. Slack push notifications dispatched when webhook URLs are configured.
4. Frontend reads/marks/deletes notifications via `/notifications`.

## 4.5 Billing Flow (Stripe)

1. Workspace initiates checkout (`/billing/create-checkout`).
2. Stripe customer/session created and redirect URL returned.
3. Webhook events update workspace plan/subscription metadata.
4. Portal endpoint supports self-service subscription management.

---

## 5) Security Scanner Engine (Backend Core)

Engine entrypoint: scanner orchestrator in `artifacts/api-server/src/lib/scanner`.

Pipeline phases:
1. Target normalization and guard checks (avoid parallel scan conflicts per project)
2. Fingerprinting and reachability probe
3. Parallel module execution
4. Active-only probes (when `ACTIVE` mode)
5. AI-assisted analysis via NVIDIA NIM (with fallback model)
6. Attack-chain correlation
7. Deduplication and risk scoring
8. Enrichment pass (remediation, CVE, compliance, scan diff)
9. Persistence + notifications

Implemented module categories include:
- TLS/cookies and transport checks
- Header policy analysis
- Information disclosure
- Auth/rate-limit risk patterns
- Supply-chain/SRI concerns
- XSS checks
- SSRF/redirect checks
- DNS posture checks
- API surface checks
- WordPress exposure checks
- GitHub SAST-oriented integration checks
- Business-logic checks in active mode

Risk and analytics outputs:
- Severity bucket counts (critical/high/medium/low)
- Scan risk score
- Attack chain detection records
- Historical diff (new/resolved/regressed trends)

---

## 6) API Surface (Feature-Centric)

Auth and identity:
- Profile/me/stats/heatmap
- Login/logout/register
- OAuth (Google/GitHub)
- Password reset and forgot password

Workspace and organization:
- Workspace settings (read/update)
- Slack webhook test

Projects and scans:
- CRUD projects
- Trigger scans
- List and detail scans
- Scan logs streaming/list

Findings:
- List/detail/update finding states
- Generate fix endpoint

Attack graph:
- Fetch graph state
- Stream graph generation
- Reset and regenerate graph

Integrations and billing:
- API keys create/list/delete
- Stripe checkout/portal/webhook
- Coupon apply

Admin:
- Platform stats
- User list + role/plan updates + delete
- Coupon management
- Activity and email log views

Notifications and chat:
- Notification list/read/read-all/delete
- Chat conversation CRUD
- Conversation message stream/history/tail-delete
- Follow-up and main chat generation endpoints

---

## 7) Data Model (Major Tables)

Identity and tenant:
- `users`
- `sessions`
- `workspaces`
- `workspace_members`

Security operations:
- `projects`
- `scans`
- `scan_logs`
- `findings`
- `attack_graphs`

Platform and engagement:
- `api_keys`
- `chat_conversations`
- `chat_messages`
- `notifications`

Commercial/admin telemetry:
- `coupons`
- `coupon_uses`
- `user_activity_logs`
- `email_logs`

---

## 8) Deployment and Execution Model

Local dev:
- Root `dev` command boots frontend and backend together.
- API defaults to `PORT=8080`, frontend to `PORT=5173`.
- `.env` used by root scripts; backend has fallback `.env` loader in runtime entry.

Vercel deployment:
- Build command: `pnpm run build`
- Frontend static output: `artifacts/redforge/dist/public`
- API rewrites to serverless handler (`/api/index.ts` pattern)
- Catch-all rewrite to SPA index for client-side routing

Serverless/API handler behavior:
- On cold path, seeds admin account once before serving requests
- Reuses Express app for endpoint handling

---

## 9) Integrations and External Dependencies

Primary external systems:
- PostgreSQL database (`DATABASE_URL`)
- NVIDIA NIM API for AI security analysis/chat
- Stripe for billing + subscription lifecycle
- Slack webhooks for scan notifications
- Optional OAuth providers (Google/GitHub auth endpoints)

Critical environment variables (representative):
- `DATABASE_URL`
- `SESSION_SECRET`
- `APP_URL`
- `NVIDIA_NIM_API_KEY`
- `NVIDIA_MODEL`, `NVIDIA_FALLBACK_MODEL`
- `STRIPE_SECRET_KEY`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`

---

## 10) Current Validation Status (As Checked)

Validation command executed:
- `pnpm run build` at repository root

Observed state:
- Build/typecheck fails due to existing TypeScript issues in `artifacts/mockup-sandbox`
- Main error class: unresolved alias imports (`@/...`) and some typing problems in sandbox UI components
- Because workspace build is recursive, this currently blocks full green verification

Implication:
- Core app may still run in dev mode, but workspace-wide CI/build health is not fully passing until sandbox errors are fixed or excluded from required checks.

---

## 11) Suggested Engineering Follow-Ups

- Decide whether `artifacts/mockup-sandbox` is production-critical:
  - If no: remove from mandatory typecheck/build filters.
  - If yes: fix tsconfig path aliases and strict typing errors.
- Add explicit workspace scripts for:
  - `lint`
  - `test`
  - `build:strict` (production packages only)
- Add architecture changelog process so this document is updated per major feature/domain changes.

---

## 12) Ownership Note

This file is intentionally created as an internal reference and currently local-only.  
No push action has been performed.

---

## 13) CI/CD Security Gate (Implemented)

RedForge now supports CI/CD merge gating through a dedicated API-key authenticated endpoint.

### API endpoint

- `POST /api/ci/evaluate`
- Auth: `x-api-key: <redforge_api_key>` (or `Authorization: Bearer <redforge_api_key>`)

### Request body

```json
{
  "projectId": "<uuid>",
  "failOn": ["CRITICAL", "HIGH"],
  "maxScanAgeHours": 24,
  "includeMarkdown": true
}
```

### Response highlights

- `pass`: boolean gate status
- `gateReason`: human-readable fail/pass reason
- `scanId`: latest completed scan used for decision
- `counts`: severity counters
- `topFindings`: blocking findings list
- `markdown`: PR-comment-ready summary text

### Gating behavior

- Validates API key and resolves workspace
- Ensures project belongs to that workspace
- Evaluates latest completed scan for that project
- Fails if:
  - latest scan is stale (`maxScanAgeHours` exceeded), or
  - any findings exist in configured blocking severities (`failOn`)

### GitHub Action support

Included files:

- `.github/workflows/redforge-security-gate.yml`
- `scripts/redforge-ci-gate.mjs`

Required GitHub secrets:

- `REDFORGE_API_BASE`
- `REDFORGE_API_KEY`
- `REDFORGE_PROJECT_ID`

This enables PR-time security enforcement and optional merge blocking based on RedForge findings.
