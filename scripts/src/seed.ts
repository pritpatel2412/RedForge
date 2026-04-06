import {
  db,
  usersTable,
  workspacesTable,
  workspaceMembersTable,
  projectsTable,
  scansTable,
  scanLogsTable,
  findingsTable,
  sessionsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { createHash } from "crypto";

async function hashPassword(password: string): Promise<string> {
  const { default: bcrypt } = await import("bcryptjs");
  return bcrypt.hash(password, 12);
}

async function seed() {
  console.log("🌱 Seeding database...");

  // Clean up existing demo data
  const existingUser = await db.select().from(usersTable)
    .where(eq(usersTable.email, "demo@redforge.io")).limit(1);

  if (existingUser.length > 0) {
    console.log("Demo user already exists, skipping seed...");
    return;
  }

  // Create demo workspace
  const [workspace] = await db.insert(workspacesTable).values({
    name: "Acme Security Team",
    slug: "acme",
    plan: "PRO",
    trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  }).returning();

  // Create demo user
  const passwordHash = await hashPassword("demo1234");
  const [user] = await db.insert(usersTable).values({
    email: "demo@redforge.io",
    passwordHash,
    name: "Demo User",
    role: "owner",
    currentWorkspaceId: workspace.id,
  }).returning();

  await db.insert(workspaceMembersTable).values({
    workspaceId: workspace.id,
    userId: user.id,
    role: "owner",
  });

  // Create projects
  const [project1] = await db.insert(projectsTable).values({
    workspaceId: workspace.id,
    name: "Main API (Production)",
    description: "Core REST API serving the production application",
    targetUrl: "https://api.acme.example.com",
    targetType: "API",
    status: "active",
  }).returning();

  const [project2] = await db.insert(projectsTable).values({
    workspaceId: workspace.id,
    name: "Admin Dashboard",
    description: "Internal admin panel for managing users and content",
    targetUrl: "https://admin.acme.example.com",
    targetType: "WEB_APP",
    status: "active",
  }).returning();

  // ---- Scan 1: Completed with 8 findings ----
  const scan1StartedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const scan1CompletedAt = new Date(scan1StartedAt.getTime() + 22 * 60 * 1000);
  const [scan1] = await db.insert(scansTable).values({
    projectId: project1.id,
    status: "COMPLETED",
    startedAt: scan1StartedAt,
    completedAt: scan1CompletedAt,
    findingsCount: 8,
    criticalCount: 1,
    highCount: 2,
    mediumCount: 3,
    lowCount: 2,
    createdAt: scan1StartedAt,
  }).returning();

  const scan1Logs = [
    { level: "INFO", message: "Starting security scan for https://api.acme.example.com" },
    { level: "INFO", message: "Initializing AI scan engine..." },
    { level: "INFO", message: "Running reconnaissance phase..." },
    { level: "INFO", message: "Discovering endpoints and attack surface..." },
    { level: "DEBUG", message: "Found 24 API endpoints to analyze" },
    { level: "INFO", message: "Running authentication tests..." },
    { level: "WARN", message: "Detected missing rate limiting on /api/login" },
    { level: "INFO", message: "Running injection vulnerability tests..." },
    { level: "INFO", message: "Running SSRF detection..." },
    { level: "ERROR", message: "⚠️  Critical vulnerability found: Authentication bypass in admin panel" },
    { level: "INFO", message: "Running broken access control tests..." },
    { level: "INFO", message: "Finalizing scan results..." },
    { level: "INFO", message: "Scan complete. 8 findings discovered." },
  ];
  for (let i = 0; i < scan1Logs.length; i++) {
    await db.insert(scanLogsTable).values({
      scanId: scan1.id,
      level: scan1Logs[i].level,
      message: scan1Logs[i].message,
      createdAt: new Date(scan1StartedAt.getTime() + i * 90000),
    });
  }

  // Scan 1 findings
  await db.insert(findingsTable).values([
    {
      scanId: scan1.id,
      projectId: project1.id,
      title: "Authentication bypass in admin panel",
      description: "The admin login endpoint accepts requests with missing JWT token, potentially allowing unauthorized access to administrative functions. An attacker can craft a request with a manipulated token that bypasses the authentication check entirely.",
      endpoint: "POST /api/admin/login",
      severity: "CRITICAL",
      status: "OPEN",
      cvss: "9.8",
      cwe: "CWE-287",
      owasp: "A07",
      pocCode: `curl -X POST https://api.acme.example.com/api/admin/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"admin@acme.com","bypass":true}'`,
      fixPatch: `// Before (vulnerable)
function verifyToken(req) {
  const token = req.headers.authorization;
  if (!token) return true; // BUG: returns true on missing token
  return jwt.verify(token, SECRET);
}

// After (fixed)
function verifyToken(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return false; // Reject missing tokens
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return false;
  }
}`,
      fixExplanation: "The authentication check must always return false when the token is missing or invalid. Never allow requests to proceed without a valid token on protected endpoints.",
      createdAt: scan1CompletedAt,
    },
    {
      scanId: scan1.id,
      projectId: project1.id,
      title: "SSRF via unvalidated URL parameter",
      description: "The /api/fetch endpoint accepts a user-controlled URL parameter without validation, enabling Server-Side Request Forgery (SSRF) attacks. An attacker can use this to access internal network resources, metadata services, or perform port scanning.",
      endpoint: "GET /api/fetch?url=",
      severity: "HIGH",
      status: "IN_PROGRESS",
      cvss: "8.1",
      cwe: "CWE-918",
      owasp: "A10",
      pocCode: `# Access AWS metadata service
curl "https://api.acme.example.com/api/fetch?url=http://169.254.169.254/latest/meta-data/iam/security-credentials/"`,
      fixPatch: `import { URL } from 'url';
const BLOCKED_HOSTS = ['169.254.169.254', '::1', 'localhost', '127.0.0.1'];

function validateUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    if (BLOCKED_HOSTS.includes(parsed.hostname)) return false;
    return true;
  } catch { return false; }
}`,
      fixExplanation: "Implement a strict allowlist of permitted URLs or domains. Block access to private IP ranges, localhost, and cloud metadata endpoints.",
      createdAt: scan1CompletedAt,
    },
    {
      scanId: scan1.id,
      projectId: project1.id,
      title: "Race condition in billing redemption",
      description: "The billing redemption endpoint is vulnerable to a TOCTOU race condition. Multiple concurrent requests can redeem the same coupon code before the database check completes.",
      endpoint: "POST /api/billing/redeem",
      severity: "HIGH",
      status: "OPEN",
      cvss: "7.5",
      cwe: "CWE-362",
      owasp: "A04",
      pocCode: null,
      fixPatch: null,
      fixExplanation: "Use database transactions with pessimistic locking (SELECT FOR UPDATE) to ensure atomicity.",
      createdAt: scan1CompletedAt,
    },
    {
      scanId: scan1.id,
      projectId: project1.id,
      title: "Insecure Direct Object Reference in user profiles",
      description: "The user profile endpoint does not verify that the requesting user owns the profile being accessed. Any authenticated user can view or modify other users' profile data.",
      endpoint: "GET /api/users/:id/profile",
      severity: "MEDIUM",
      status: "OPEN",
      cvss: "6.5",
      cwe: "CWE-639",
      owasp: "A01",
      pocCode: null,
      fixPatch: null,
      fixExplanation: "Always verify that the authenticated user has permission to access the requested resource.",
      createdAt: scan1CompletedAt,
    },
    {
      scanId: scan1.id,
      projectId: project1.id,
      title: "Missing rate limiting on authentication endpoint",
      description: "The login endpoint does not implement rate limiting, allowing brute force attacks against user credentials.",
      endpoint: "POST /api/auth/login",
      severity: "MEDIUM",
      status: "FIXED",
      cvss: "5.9",
      cwe: "CWE-307",
      owasp: "A07",
      pocCode: null,
      fixPatch: null,
      fixExplanation: "Implement rate limiting using express-rate-limit. Limit login attempts to 5 per minute per IP.",
      createdAt: scan1CompletedAt,
    },
    {
      scanId: scan1.id,
      projectId: project1.id,
      title: "JWT tokens do not expire",
      description: "Authentication tokens are issued without expiration times, meaning a stolen token remains valid indefinitely.",
      endpoint: "POST /api/auth/login",
      severity: "MEDIUM",
      status: "OPEN",
      cvss: "6.1",
      cwe: "CWE-613",
      owasp: "A07",
      pocCode: null,
      fixPatch: null,
      fixExplanation: "Set appropriate expiration times on JWT tokens (e.g., 1 hour for access tokens).",
      createdAt: scan1CompletedAt,
    },
    {
      scanId: scan1.id,
      projectId: project1.id,
      title: "Sensitive data in error messages",
      description: "Error responses include internal stack traces and database query details that could help an attacker understand the system's internal structure.",
      endpoint: "Multiple endpoints",
      severity: "LOW",
      status: "OPEN",
      cvss: "3.7",
      cwe: "CWE-209",
      owasp: "A09",
      pocCode: null,
      fixPatch: null,
      fixExplanation: "In production, return generic error messages. Never expose stack traces in API responses.",
      createdAt: scan1CompletedAt,
    },
    {
      scanId: scan1.id,
      projectId: project1.id,
      title: "CORS policy allows wildcard origins",
      description: "The API CORS configuration allows requests from any origin (*), which can enable cross-origin attacks.",
      endpoint: "All API endpoints",
      severity: "LOW",
      status: "WONT_FIX",
      cvss: "4.3",
      cwe: "CWE-942",
      owasp: "A05",
      pocCode: null,
      fixPatch: null,
      fixExplanation: "Configure CORS to only allow requests from known, trusted origins.",
      createdAt: scan1CompletedAt,
    },
  ]);

  // ---- Scan 2: Completed with 4 findings ----
  const scan2StartedAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  const scan2CompletedAt = new Date(scan2StartedAt.getTime() + 18 * 60 * 1000);
  const [scan2] = await db.insert(scansTable).values({
    projectId: project2.id,
    status: "COMPLETED",
    startedAt: scan2StartedAt,
    completedAt: scan2CompletedAt,
    findingsCount: 4,
    criticalCount: 0,
    highCount: 2,
    mediumCount: 2,
    lowCount: 0,
    createdAt: scan2StartedAt,
  }).returning();

  await db.insert(findingsTable).values([
    {
      scanId: scan2.id,
      projectId: project2.id,
      title: "Cross-Site Scripting (XSS) in search field",
      description: "The search field in the admin panel does not sanitize user input, allowing reflected XSS attacks. An attacker can inject malicious scripts that execute in victim browsers.",
      endpoint: "GET /admin/search?q=",
      severity: "HIGH",
      status: "OPEN",
      cvss: "7.4",
      cwe: "CWE-79",
      owasp: "A03",
      pocCode: `# Test with XSS payload
curl "https://admin.acme.example.com/admin/search?q=<script>alert('XSS')</script>"`,
      fixPatch: null,
      fixExplanation: "Sanitize all user input before rendering it in HTML. Use a library like DOMPurify for client-side sanitization.",
      createdAt: scan2CompletedAt,
    },
    {
      scanId: scan2.id,
      projectId: project2.id,
      title: "SQL injection in user search",
      description: "The user search functionality constructs SQL queries using string concatenation, making it vulnerable to SQL injection attacks.",
      endpoint: "GET /admin/users?search=",
      severity: "HIGH",
      status: "IN_PROGRESS",
      cvss: "8.8",
      cwe: "CWE-89",
      owasp: "A03",
      pocCode: `curl "https://admin.acme.example.com/admin/users?search=' OR 1=1--"`,
      fixPatch: null,
      fixExplanation: "Use parameterized queries or prepared statements. Never concatenate user input into SQL queries.",
      createdAt: scan2CompletedAt,
    },
    {
      scanId: scan2.id,
      projectId: project2.id,
      title: "Missing CSRF protection on state-changing endpoints",
      description: "State-changing API endpoints do not implement CSRF protection, allowing cross-site request forgery attacks.",
      endpoint: "POST /admin/users/delete",
      severity: "MEDIUM",
      status: "OPEN",
      cvss: "6.8",
      cwe: "CWE-352",
      owasp: "A01",
      pocCode: null,
      fixPatch: null,
      fixExplanation: "Implement CSRF tokens for all state-changing operations. Use the SameSite cookie attribute.",
      createdAt: scan2CompletedAt,
    },
    {
      scanId: scan2.id,
      projectId: project2.id,
      title: "Insecure cookie configuration",
      description: "Session cookies are missing the Secure and HttpOnly flags, making them vulnerable to theft via JavaScript or network interception.",
      endpoint: "POST /admin/login",
      severity: "MEDIUM",
      status: "FIXED",
      cvss: "5.4",
      cwe: "CWE-614",
      owasp: "A02",
      pocCode: null,
      fixPatch: null,
      fixExplanation: "Set Secure, HttpOnly, and SameSite=Strict flags on all session cookies.",
      createdAt: scan2CompletedAt,
    },
  ]);

  // ---- Scan 3: Running ----
  const [scan3] = await db.insert(scansTable).values({
    projectId: project1.id,
    status: "RUNNING",
    startedAt: new Date(Date.now() - 3 * 60 * 1000),
    findingsCount: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
  }).returning();

  const runningLogs = [
    { level: "INFO", message: "Starting security scan for https://api.acme.example.com" },
    { level: "INFO", message: "Initializing AI scan engine..." },
    { level: "INFO", message: "Running reconnaissance phase..." },
  ];
  for (let i = 0; i < runningLogs.length; i++) {
    await db.insert(scanLogsTable).values({
      scanId: scan3.id,
      level: runningLogs[i].level,
      message: runningLogs[i].message,
      createdAt: new Date(Date.now() - (3 - i) * 60 * 1000),
    });
  }

  console.log("✅ Seed complete!");
  console.log("📧 Demo login: demo@redforge.io / demo1234");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seed error:", err);
  process.exit(1);
});
