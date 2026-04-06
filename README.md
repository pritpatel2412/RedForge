# RedForge — Autonomous AI Penetration Testing SaaS

> A full-stack, production-grade security scanning platform that performs real HTTP-based vulnerability assessments, streams findings in real time, and leverages Claude AI for expert remediation guidance.

---

## Table of Contents

1. [Overview](#overview)
2. [Live Demo](#live-demo)
3. [Key Features](#key-features)
4. [Tech Stack](#tech-stack)
5. [Architecture](#architecture)
6. [Project Structure](#project-structure)
7. [Database Schema](#database-schema)
8. [Real Security Scanner — 11 Phases](#real-security-scanner--11-phases)
9. [AI Security Chat Assistant](#ai-security-chat-assistant)
10. [API Reference](#api-reference)
11. [Environment Variables](#environment-variables)
12. [Getting Started](#getting-started)
13. [Development Commands](#development-commands)
14. [Pages & Routes](#pages--routes)
15. [Security Considerations](#security-considerations)
16. [Screenshots](#screenshots)

---

## Overview

RedForge is an autonomous AI-powered penetration testing SaaS platform built for security teams and developers. Unlike tools that simulate vulnerabilities with hardcoded data, RedForge makes **real HTTP requests** to target URLs, discovers actual misconfigurations and vulnerabilities, and streams findings live to the dashboard.

Every scan is unique — results depend entirely on what the target server actually responds with.

**Core capabilities:**
- Real 11-phase HTTP security scanner
- Real-time SSE log streaming during active scans
- AI-powered remediation with working code patches (Claude)
- Conversational AI security advisor with full workspace context
- Multi-tenant workspaces with API key access
- Stripe billing integration (Free / Pro / Enterprise plans)
- Slack notifications for critical findings
- PDF report export
- Analytics and trend tracking

---

## Live Demo

| Credential | Value |
|---|---|
| Email | `demo@redforge.io` |
| Password | `demo1234` |

---

## Key Features

### Real-Time Security Scanning
Trigger a scan on any public URL and watch log entries stream in live as each of the 11 scanner phases executes. Findings appear automatically once discovered — no page refresh needed.

### AI-Powered Remediation
For each finding, generate a detailed AI fix using Claude that includes:
- Root cause explanation
- Working code patch (language-appropriate)
- Configuration change instructions
- Prevention guidance

### AI Security Chat Assistant
A full chat interface powered by Claude 3.5 Sonnet with complete awareness of your workspace:
- Knows all your findings by name, severity, endpoint, and CVSS score
- Streams responses token-by-token
- Renders markdown, tables, and code blocks with copy buttons
- Six pre-built quick-action prompts
- Risk badge based on live finding data

### Multi-Tenant Workspaces
Each registered user gets an isolated workspace with:
- Their own projects, scans, and findings
- API keys for programmatic access
- Configurable Slack webhook for alerts
- Plan tracking (Free / Pro / Enterprise)

### Stripe Billing
Full Stripe integration for plan upgrades:
- Hosted checkout session
- Customer portal for subscription management
- Webhook handling for `checkout.session.completed` and subscription lifecycle events

### Slack Notifications
Automatic alerts sent to a configured webhook URL when:
- A critical-severity finding is discovered
- A scan completes with a summary of results

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 24 |
| Package Manager | pnpm workspaces (monorepo) |
| Language | TypeScript 5.9 (strict) |
| Frontend | React 18 + Vite 7 |
| Backend | Express 5 |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod + drizzle-zod |
| API Codegen | Orval (OpenAPI → React Query hooks) |
| Auth | Session cookies (HTTP-only) + bcrypt |
| AI | NVIDIA NIM (OpenAI-compatible API) |
| Billing | Stripe |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Animation | Framer Motion |
| 3D / Globe | Three.js + React Three Fiber |
| Build | esbuild (ESM bundle) |
| Charts | Recharts |

---

## Architecture

```
Browser (React + Vite)
        │
        │ REST + SSE
        ▼
Express 5 API Server  ←──────────────── PostgreSQL (Drizzle ORM)
        │
        ├── Scanner Engine (11 phases of real HTTP probes)
        ├── Anthropic Claude API  (AI fixes + Chat + Scanner phase 11)
        ├── Stripe API            (checkout, portal, webhooks)
        └── Slack Webhook         (critical alerts)
```

**Authentication flow:**
1. `POST /api/auth/login` — bcrypt password verification, creates session row in DB
2. Session token stored in `HttpOnly` cookie
3. All protected routes call `requireAuth` middleware which reads cookie → looks up session → attaches `req.user` + `req.workspace`

**Scan flow:**
1. `POST /api/projects/:id/scan` creates a scan row (status: `RUNNING`) and runs the scanner in the background
2. Scanner writes log rows and finding rows to the DB as it progresses
3. Frontend opens an SSE connection to `GET /api/scans/:id/logs` which polls the DB every second and pushes new rows
4. When the scanner finishes, the scan is marked `COMPLETED` and the SSE stream closes

---

## Project Structure

```
redforge/                          ← monorepo root
├── artifacts/
│   ├── api-server/                ← Express 5 backend
│   │   └── src/
│   │       ├── index.ts           ← server entry, CORS, session middleware
│   │       ├── lib/
│   │       │   ├── auth.ts        ← requireAuth middleware
│   │       │   └── scanner/
│   │       │       └── index.ts   ← 11-phase real HTTP scanner
│   │       └── routes/
│   │           ├── index.ts       ← router registry
│   │           ├── auth.ts        ← login / logout / register / me
│   │           ├── projects.ts    ← project CRUD + scan trigger
│   │           ├── scans.ts       ← scan list, detail, SSE log stream
│   │           ├── findings.ts    ← findings list, detail, status update
│   │           ├── chat.ts        ← AI chat SSE streaming endpoint
│   │           ├── dashboard.ts   ← aggregated stats endpoint
│   │           ├── keys.ts        ← API key management
│   │           ├── workspace.ts   ← workspace settings
│   │           ├── billing.ts     ← Stripe checkout + portal + webhook
│   │           └── webhooks.ts    ← alternate webhook path
│   │
│   └── redforge/                  ← React + Vite frontend
│       └── src/
│           ├── App.tsx            ← router, QueryClient
│           ├── components/
│           │   ├── layout/
│           │   │   ├── AppLayout.tsx   ← auth guard + shell
│           │   │   └── Sidebar.tsx     ← nav with AI Assistant highlight
│           │   └── landing/           ← landing page sections
│           └── pages/
│               ├── Landing.tsx
│               ├── Dashboard.tsx
│               ├── Chat.tsx           ← AI Security Chat
│               ├── Analytics.tsx
│               ├── Reports.tsx
│               ├── projects/
│               ├── scans/
│               ├── findings/
│               └── settings/
│
├── lib/
│   ├── api-spec/                  ← OpenAPI 3.1 spec (source of truth)
│   ├── api-client-react/          ← Orval-generated React Query hooks
│   ├── api-zod/                   ← Orval-generated Zod schemas
│   └── db/                        ← Drizzle schema + DB connection
│       └── src/
│           └── schema.ts          ← all table definitions
│
├── scripts/
│   └── src/seed.ts                ← seeds demo user + workspace + sample data
│
└── pnpm-workspace.yaml
```

---

## Database Schema

```
users
├── id          UUID PK
├── email       TEXT UNIQUE
├── password    TEXT (bcrypt)
└── createdAt   TIMESTAMP

sessions
├── id          UUID PK
├── userId      UUID FK → users
├── token       TEXT UNIQUE
└── expiresAt   TIMESTAMP

workspaces
├── id          UUID PK
├── name        TEXT
├── plan        ENUM (FREE, PRO, ENTERPRISE)
├── slackWebhookUrl  TEXT?
└── stripeCustomerId TEXT?

workspace_members
├── workspaceId UUID FK → workspaces
└── userId      UUID FK → users

projects
├── id          UUID PK
├── workspaceId UUID FK → workspaces
├── name        TEXT
├── targetUrl   TEXT
├── targetType  ENUM (WEB_APP, API, MOBILE_API, GRAPHQL)
└── description TEXT?

scans
├── id            UUID PK
├── projectId     UUID FK → projects
├── status        ENUM (RUNNING, COMPLETED, FAILED)
├── findingsCount INT
├── criticalCount INT
├── duration      INT (seconds)
└── completedAt   TIMESTAMP?

scan_logs
├── id        UUID PK
├── scanId    UUID FK → scans
├── level     ENUM (INFO, WARN, ERROR, SUCCESS)
├── phase     TEXT
├── message   TEXT
└── createdAt TIMESTAMP

findings
├── id          UUID PK
├── scanId      UUID FK → scans
├── projectId   UUID FK → projects
├── title       TEXT
├── severity    ENUM (CRITICAL, HIGH, MEDIUM, LOW, INFO)
├── status      ENUM (OPEN, IN_PROGRESS, FIXED, ACCEPTED)
├── endpoint    TEXT
├── description TEXT
├── cvss        DECIMAL
├── owasp       TEXT
├── cwe         TEXT
├── poc         TEXT?    (proof-of-concept)
├── recommendation TEXT?
├── aiFixGenerated  BOOLEAN
└── aiFix       TEXT?    (AI-generated patch)

api_keys
├── id          UUID PK
├── workspaceId UUID FK → workspaces
├── name        TEXT
├── keyHash     TEXT
└── lastUsedAt  TIMESTAMP?
```

---

## Real Security Scanner — 11 Phases

The scanner lives at `artifacts/api-server/src/lib/scanner/index.ts` and is invoked when a scan is triggered. It makes real HTTP requests to the target and produces findings based on actual server responses.

### Phase 1 — Target Verification
Sends a `GET` request to the target URL. Checks reachability, HTTP status code, and baseline response headers. If the target is unreachable, the scan fails immediately with a clear error.

### Phase 2 — SSL/TLS Check
Detects whether the target uses plain HTTP. If so, creates a `HIGH` severity finding: "Unencrypted HTTP Connection" with a recommendation to enforce HTTPS and configure HSTS.

### Phase 3 — Security Headers Analysis
Inspects the response headers for the presence of:
- `Strict-Transport-Security` (HSTS)
- `Content-Security-Policy` (CSP)
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Referrer-Policy`
- `Server` and `X-Powered-By` (technology disclosure)

Each missing or misconfigured header becomes a `MEDIUM` or `LOW` finding with the correct header value as the fix.

### Phase 4 — CORS Misconfiguration
Sends a preflight request with `Origin: https://evil.attacker.com`. If the response includes `Access-Control-Allow-Origin: *` or echoes the malicious origin, a `HIGH` finding is created for CORS misconfiguration with exploit scenario and fix.

### Phase 5 — Sensitive File Exposure
Probes 15+ known sensitive paths:
```
/.env          /.git/config      /phpinfo.php
/actuator/env  /backup.sql       /.htpasswd
/web.config    /composer.json    /package.json
/config.json   /wp-config.php    /server-status
/crossdomain.xml  /robots.txt (for sensitive disallows)
```
Any path that returns HTTP 200 with non-trivial content becomes a `CRITICAL` finding.

### Phase 6 — Admin Panel Discovery
Probes 10+ admin paths:
```
/admin    /wp-admin    /phpmyadmin    /administrator
/panel    /manager     /actuator      /_debug
/console  /dashboard   /admin.php
```
Accessible admin interfaces become `HIGH` severity findings.

### Phase 7 — SQL Injection Probe
Injects standard SQLi payloads into common API endpoints:
```
/api/users?id='
/api/search?q=1' OR '1'='1
/api/login  (POST with malicious JSON)
```
Checks response bodies for SQL error strings (`syntax error`, `mysql_fetch`, `ORA-`, `PG::`, etc.). Any match becomes a `CRITICAL` finding with the exact payload as proof-of-concept.

### Phase 8 — Rate Limiting Test
Sends 6 rapid `POST` requests to authentication endpoints. If none return HTTP `429 Too Many Requests`, a `MEDIUM` finding is created for missing rate limiting, with recommendations for implementing exponential backoff and account lockout.

### Phase 9 — Information Disclosure
Probes endpoints likely to expose internal information:
```
/error    /trace    /debug    /api/debug
/?cause_error=true
```
Checks responses for stack traces, database error messages, internal file paths, and framework version strings. Any leak becomes a `HIGH` finding.

### Phase 10 — Subresource Integrity (SRI)
Fetches the target page HTML and parses `<script src="...">` tags. Any script loaded from a CDN (e.g., `cdn.jsdelivr.net`, `unpkg.com`, `cdnjs.cloudflare.com`) without an `integrity="sha384-..."` attribute becomes a `MEDIUM` finding for missing SRI.

### Phase 11 — AI Deep Analysis (optional)
If `ANTHROPIC_API_KEY` is set, sends the target's response headers, body excerpt, and discovered findings to Claude. Claude identifies additional patterns not covered by the other phases and returns structured finding data that is saved to the database.

---

## AI Security Chat Assistant

Located at `/chat`, powered by Claude 3.5 Sonnet with full workspace context.

### How it works

Every message triggers a `POST /api/chat` call that:

1. Fetches all findings for the workspace from the database
2. Fetches recent scan history
3. Builds a detailed system prompt containing:
   - Organization name and current risk level
   - Finding count by severity
   - Full list of findings (title, severity, endpoint, CVSS, OWASP, CWE, status)
   - Recent scan summaries
4. Calls the Anthropic streaming API
5. Streams the response back to the browser via SSE, character-by-character

### Frontend capabilities

- **Streaming display** — text appears as it is generated, with an animated blinking cursor
- **Markdown rendering** — headers, bold, lists, tables, and code blocks all render correctly
- **Code copy** — one-click copy button on every code block with language label
- **Quick action chips** — six pre-built questions covering the most common use cases
- **Risk badge** — shows CRITICAL / HIGH / MEDIUM / LOW based on live finding counts
- **Graceful fallback** — if no API key is configured, a clear step-by-step setup guide is shown

### Quick Actions

| Button | What it asks Claude |
|---|---|
| Most critical finding? | Detailed breakdown of the highest-risk vulnerability |
| Remediation roadmap | Prioritized 30-day fix plan across all open findings |
| Explain CORS attack | Attack scenario + exact nginx/Express fix |
| Explain SSRF | Exploit walkthrough + prevention with code |
| Executive summary | Non-technical report for stakeholders |
| Easiest wins | Findings fixable in under an hour with exact steps |

### To enable

Add `ANTHROPIC_API_KEY` to the Replit Secrets panel (or your `.env` file).

---

## API Reference

All endpoints are under `/api`. All protected endpoints require a valid session cookie.

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Login with email + password |
| `POST` | `/api/auth/logout` | Clear session |
| `POST` | `/api/auth/register` | Create account |
| `GET` | `/api/auth/me` | Current user + workspace |

### Projects

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/projects` | List all projects |
| `POST` | `/api/projects` | Create project |
| `GET` | `/api/projects/:id` | Project detail |
| `PUT` | `/api/projects/:id` | Update project |
| `DELETE` | `/api/projects/:id` | Delete project |
| `POST` | `/api/projects/:id/scan` | Trigger a new scan |

### Scans

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/scans` | List scans |
| `GET` | `/api/scans/:id` | Scan detail (findings + logs) |
| `GET` | `/api/scans/:id/logs` | SSE real-time log stream |

### Findings

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/findings` | List findings (filter by severity/status) |
| `GET` | `/api/findings/:id` | Finding detail |
| `PATCH` | `/api/findings/:id` | Update status (OPEN → IN_PROGRESS → FIXED) |
| `POST` | `/api/findings/:id/generate-fix` | Generate AI fix patch |

### AI Chat

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat` | SSE-streaming chat (requires ANTHROPIC_API_KEY) |

### Workspace & Keys

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/workspace/settings` | Get workspace settings |
| `PATCH` | `/api/workspace/settings` | Update name, Slack webhook |
| `GET` | `/api/keys` | List API keys |
| `POST` | `/api/keys` | Create API key |
| `DELETE` | `/api/keys/:id` | Delete API key |

### Dashboard

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard/stats` | Aggregated stats (totals, trends, recent activity) |

### Billing (requires Stripe keys)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/billing/create-checkout` | Create Stripe checkout session |
| `POST` | `/api/billing/portal` | Create Stripe billing portal session |
| `POST` | `/api/billing/webhook` | Stripe webhook receiver |

---

## Environment Variables

### Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (auto-provisioned on Replit) |
| `SESSION_SECRET` | Secret used to sign session cookies |

### Optional — AI Features

| Variable | Description |
|---|---|
| `NVIDIA_NIM_API_KEY` | Your `nvapi-...` key from integrate.api.nvidia.com — enables AI chat, AI fix generation, and scanner Phase 11 |
| `NVIDIA_MODEL` | Override the NIM model (default: `meta/llama-3.1-70b-instruct`). Any OpenAI-compatible model on NIM works, e.g. `nvidia/llama-3.3-nemotron-super-49b-v1` |

### Optional — Billing

| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key (from dashboard.stripe.com) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret from Stripe CLI or dashboard |
| `STRIPE_PRO_PRICE_ID` | Price ID of your Pro subscription product |

### Optional — Notifications

Slack webhook URL is configured per-workspace through the Settings UI, not via environment variables.

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL database (auto-provisioned if using Replit)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set environment variables

Create a `.env` file or use Replit Secrets:

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
SESSION_SECRET=your-random-secret-here
ANTHROPIC_API_KEY=sk-ant-...   # optional but recommended
```

### 3. Push database schema

```bash
pnpm --filter @workspace/db run push
```

### 4. Seed demo data

```bash
pnpm --filter @workspace/scripts run seed
```

This creates:
- Demo user: `demo@redforge.io` / `demo1234`
- A personal workspace
- Sample projects and findings

### 5. Start the development servers

**API server** (port 8080):
```bash
pnpm --filter @workspace/api-server run dev
```

**Frontend** (Vite dev server):
```bash
pnpm --filter @workspace/redforge run dev
```

On Replit, both are managed automatically via configured workflows.

---

## Development Commands

```bash
# Install all workspace dependencies
pnpm install

# Push Drizzle schema to database
pnpm --filter @workspace/db run push

# Seed demo user and sample data
pnpm --filter @workspace/scripts run seed

# Regenerate API client from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Build API server (esbuild ESM bundle)
pnpm --filter @workspace/api-server run build

# Start API server in dev mode (build + run)
pnpm --filter @workspace/api-server run dev

# Start frontend in dev mode (Vite)
pnpm --filter @workspace/redforge run dev
```

---

## Pages & Routes

### Public (no auth required)

| Path | Description |
|---|---|
| `/` | Landing page — hero, features, pricing, testimonials |
| `/signin` | Sign-in form |
| `/signup` | Registration form |
| `/changelog` | Product changelog |
| `/status` | System status indicators |

### Protected (session required)

| Path | Description |
|---|---|
| `/dashboard` | Stats overview, recent findings, recent scans |
| `/projects` | Project list with scan trigger |
| `/projects/new` | Create a new project |
| `/projects/:id` | Project detail, scan history |
| `/scans` | All scans across projects |
| `/scans/:id` | Scan detail with live SSE log stream |
| `/findings` | Filterable findings table (severity, status) |
| `/findings/:id` | Finding detail with AI fix generation |
| `/analytics` | Trend charts, severity distribution, fix rate over time |
| `/reports` | PDF report generation and download |
| `/chat` | AI Security Chat Assistant |
| `/settings` | Workspace name, Slack webhook |
| `/settings/api-keys` | API key management |
| `/settings/billing` | Stripe plan upgrade |

---

## Security Considerations

### Ethical Use
RedForge makes real HTTP requests to the URLs you provide. **Only scan systems you own or have explicit written permission to test.** Unauthorized scanning may violate computer fraud laws in your jurisdiction.

### Rate Limiting
The scanner itself tests for rate limiting on target systems, but the RedForge API has no built-in rate limiting on scan triggers. In production, add middleware (e.g., `express-rate-limit`) to the scan endpoint.

### API Key Storage
API keys are stored as bcrypt hashes. The plaintext key is shown only once at creation time and is never stored or retrievable again.

### Session Security
- Sessions use HTTP-only cookies (not accessible via JavaScript)
- `SESSION_SECRET` should be a cryptographically random string of at least 32 characters
- Sessions are stored in the database with expiry timestamps

### AI Input Safety
The AI chat endpoint injects workspace data into Claude's context. No user-provided content is injected into the system prompt — only database rows that the authenticated user already has access to.

---

## Screenshots

> Sign in using `demo@redforge.io` / `demo1234` to explore all features.

**Dashboard** — Animated stat cards, recent findings, recent scan activity

**Scan View** — Live SSE log stream, finding count updating in real time

**Findings** — Severity-filtered table, status management, AI fix generation

**Analytics** — Recharts-powered trend lines, severity distribution, fix rate

**AI Chat** — Streaming Claude responses, markdown rendering, quick prompts

**Settings** — Workspace config, Slack webhook, API key management

---

## License

Built for educational and portfolio purposes. All scanning activity must be performed only on systems you own or have explicit permission to test.
