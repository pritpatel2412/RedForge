import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { db, usersTable, sessionsTable, workspacesTable, workspaceMembersTable, scansTable, findingsTable, projectsTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { getUserFromRequest } from "../lib/auth.js";
import { sendWelcomeEmail } from "../lib/email.js";
import { logActivity } from "../lib/activity.js";

const router = Router();

router.get("/me", async (req, res) => {
  try {
    const result = await getUserFromRequest(req);
    if (!result) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { user, workspace } = result;
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        notifyEmail: user.notifyEmail,
        notifySecurityAlerts: user.notifySecurityAlerts,
        notifyWeeklySummary: user.notifyWeeklySummary,
        createdAt: user.createdAt,
      },
      workspace: workspace ? {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        plan: workspace.plan,
        slackWebhookUrl: workspace.slackWebhookUrl,
        stripeCustomerId: workspace.stripeCustomerId,
        stripeSubscriptionId: workspace.stripeSubscriptionId,
        trialEndsAt: workspace.trialEndsAt,
        createdAt: workspace.createdAt,
      } : null,
    });
  } catch (err) {
    req.log.error(err, "Error in /auth/me");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PATCH /api/auth/profile – update name / password ─────────────────────────
router.patch("/profile", async (req, res) => {
  try {
    const result = await getUserFromRequest(req);
    if (!result) { res.status(401).json({ error: "Unauthorized" }); return; }
    const { user } = result;

    const { name, currentPassword, newPassword } = req.body as {
      name?: string;
      currentPassword?: string;
      newPassword?: string;
      notifyEmail?: boolean;
      notifySecurityAlerts?: boolean;
      notifyWeeklySummary?: boolean;
    };

    const updates: Record<string, any> = { updatedAt: new Date() };

    if (name && name.trim()) {
      updates.name = name.trim().slice(0, 100);
    }

    if (req.body.notifyEmail !== undefined) updates.notifyEmail = !!req.body.notifyEmail;
    if (req.body.notifySecurityAlerts !== undefined) updates.notifySecurityAlerts = !!req.body.notifySecurityAlerts;
    if (req.body.notifyWeeklySummary !== undefined) updates.notifyWeeklySummary = !!req.body.notifyWeeklySummary;

    if (newPassword) {
      if (!currentPassword) {
        res.status(400).json({ error: "Current password is required" }); return;
      }
      if (!user.passwordHash) {
        res.status(400).json({ error: "Password change not supported for OAuth accounts" }); return;
      }
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        res.status(400).json({ error: "Current password is incorrect" }); return;
      }
      if (newPassword.length < 8) {
        res.status(400).json({ error: "New password must be at least 8 characters" }); return;
      }
      updates.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    await db.update(usersTable).set(updates).where(eq(usersTable.id as any, user.id));
    logActivity({ userId: user.id, action: "user.profile_update", req }).catch(() => {});
    res.json({ ok: true, name: updates.name ?? user.name });
  } catch (err) {
    req.log.error(err, "Error updating profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/auth/stats – activity counts for profile page ────────────────────
router.get("/stats", async (req, res) => {
  try {
    const result = await getUserFromRequest(req);
    if (!result) { res.status(401).json({ error: "Unauthorized" }); return; }
    const { user, workspace } = result;

    const sessions = await db.select().from(sessionsTable)
      .where(and(eq(sessionsTable.userId as any, user.id), gt(sessionsTable.expiresAt as any, new Date())));

    let totalScans = 0, totalFindings = 0, criticalFindings = 0;

    if (workspace) {
      const projects = await db.select().from(projectsTable)
        .where(eq(projectsTable.workspaceId as any, workspace.id));
      const projectIds = projects.map(p => p.id);

      if (projectIds.length > 0) {
        const allScans = await db.select().from(scansTable);
        const wsScans = allScans.filter(s => projectIds.includes(s.projectId));
        totalScans = wsScans.length;

        const allFindings = await db.select().from(findingsTable);
        const wsFindings = allFindings.filter(f => projectIds.includes(f.projectId));
        totalFindings = wsFindings.length;
        criticalFindings = wsFindings.filter(f => f.severity === "CRITICAL").length;
      }
    }

    res.json({
      totalScans,
      totalFindings,
      criticalFindings,
      activeSessions: sessions.length,
      memberSince: user.createdAt,
    });
  } catch (err) {
    req.log.error(err, "Error fetching user stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/auth/heatmap – findings-per-day for the last 365 days ────────────
router.get("/heatmap", async (req, res) => {
  try {
    const result = await getUserFromRequest(req);
    if (!result) { res.status(401).json({ error: "Unauthorized" }); return; }
    const { workspace } = result;

    // Build a map of date → count covering exactly last 365 days
    const today    = new Date();
    const yearAgo  = new Date(today);
    yearAgo.setDate(yearAgo.getDate() - 364);
    yearAgo.setHours(0, 0, 0, 0);

    const dayCount: Record<string, number> = {};
    for (let d = new Date(yearAgo); d <= today; d.setDate(d.getDate() + 1)) {
      dayCount[d.toISOString().slice(0, 10)] = 0;
    }

    if (workspace) {
      const projects = await db.select().from(projectsTable)
        .where(eq(projectsTable.workspaceId as any, workspace.id));
      const projectIds = projects.map(p => p.id);

      if (projectIds.length > 0) {
        const allFindings = await db.select({ createdAt: findingsTable.createdAt, projectId: findingsTable.projectId })
          .from(findingsTable);

        for (const f of allFindings) {
          if (!projectIds.includes(f.projectId)) continue;
          const day = new Date(f.createdAt).toISOString().slice(0, 10);
          if (day in dayCount) dayCount[day]++;
        }
      }
    }

    // Compute streak (consecutive days with ≥1 finding, ending today)
    const days = Object.keys(dayCount).sort();
    let currentStreak = 0;
    let maxStreak = 0;
    let streak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (dayCount[days[i]] > 0) {
        streak++;
        if (i === days.length - 1 || days[i + 1] === days[i]) currentStreak = streak;
      } else {
        if (streak > maxStreak) maxStreak = streak;
        streak = 0;
        if (i === days.length - 1) break; // today had 0, streak is 0
      }
    }
    if (streak > maxStreak) maxStreak = streak;

    const totalInYear = Object.values(dayCount).reduce((a, b) => a + b, 0);

    res.json({
      days: dayCount,          // { "2024-04-18": 3, ... }
      totalInYear,
      currentStreak,
      maxStreak,
    });
  } catch (err) {
    req.log.error(err, "Error fetching heatmap");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/login", async (req, res) => {

  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email as any, email.toLowerCase())).limit(1);
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = randomUUID() + randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.insert(sessionsTable).values({ userId: user.id, token, expiresAt });

    const workspaceId = user.currentWorkspaceId;
    let workspace = null;
    if (workspaceId) {
      const [ws] = await db.select().from(workspacesTable).where(eq(workspacesTable.id as any, workspaceId)).limit(1);
      workspace = ws || null;
    }

    // Auto-promote admin emails
    const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
    if (adminEmails.includes(user.email) && user.role !== "admin") {
      await db.update(usersTable).set({ role: "admin", updatedAt: new Date() }).where(eq(usersTable.id as any, user.id));
      user.role = "admin";
    }

    logActivity({ userId: user.id, workspaceId: workspace?.id, action: "auth.login", req }).catch(() => {});

    res.cookie("session", token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production",
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        createdAt: user.createdAt,
      },
      workspace: workspace ? {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        plan: workspace.plan,
        slackWebhookUrl: workspace.slackWebhookUrl,
        stripeCustomerId: workspace.stripeCustomerId,
        stripeSubscriptionId: workspace.stripeSubscriptionId,
        trialEndsAt: workspace.trialEndsAt,
        createdAt: workspace.createdAt,
      } : null,
    });
  } catch (err) {
    req.log.error(err, "Error in /auth/login");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const token = req.cookies?.session;
    if (token) {
      await db.delete(sessionsTable).where(eq(sessionsTable.token as any, token));
    }
    res.clearCookie("session");
    res.json({ message: "Logged out" });
  } catch (err) {
    req.log.error(err, "Error in /auth/logout");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/register", async (req, res) => {
  try {
    const { email, password, name, workspaceName } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ error: "Email, password, and name are required" });
      return;
    }

    const existing = await db.select().from(usersTable).where(eq(usersTable.email as any, email.toLowerCase())).limit(1);
    if (existing.length > 0) {
      res.status(400).json({ error: "Email already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const slug = (workspaceName || `${name}'s workspace`).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now().toString(36);

    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const [workspace] = (await db.insert(workspacesTable).values({
      name: workspaceName || `${name}'s Workspace`,
      slug,
      plan: "FREE",
      trialEndsAt,
    }).returning()) as any;

    // Auto-promote admin emails
    const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
    const userRole = adminEmails.includes(email.toLowerCase()) ? "admin" : "owner";

    const [user] = (await db.insert(usersTable).values({
      email: email.toLowerCase(),
      passwordHash,
      name,
      role: userRole,
      provider: "email",
      currentWorkspaceId: workspace.id,
    }).returning()) as any;

    await db.insert(workspaceMembersTable).values({
      workspaceId: workspace.id,
      userId: user.id,
      role: "owner",
    });

    const token = randomUUID() + randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.insert(sessionsTable).values({ userId: user.id, token, expiresAt });

    // Fire-and-forget side effects
    logActivity({ userId: user.id, workspaceId: workspace.id, action: "auth.register", metadata: { email: user.email }, req }).catch(() => {});
    sendWelcomeEmail({ email: user.email, name: user.name }, trialEndsAt).catch(() => {});

    res.cookie("session", token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production",
    });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        createdAt: user.createdAt,
      },
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        plan: workspace.plan,
        slackWebhookUrl: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        trialEndsAt: workspace.trialEndsAt,
        createdAt: workspace.createdAt,
      },
    });
  } catch (err) {
    req.log.error(err, "Error in /auth/register");
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ═══════════════════════════════════════════════════
   OAuth 2.0 — Google & GitHub
═══════════════════════════════════════════════════ */

function getBaseUrl(_req?: any): string {
  // Priority 1: Use the explicit APP_URL environment variable (from .env)
  const appUrl = process.env.APP_URL;
  if (appUrl) {
    return appUrl.replace(/\/+$/, "");
  }

  // Priority 2: Force production domain if NOT in explicit development mode
  // This handles Vercel and other cloud environments more reliably.
  if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
    return "https://redforgex.vercel.app";
  }

  // Priority 3: Final fallback for local development only
  return "http://localhost:5000";
}

async function findOrCreateOAuthUser(
  email: string,
  name: string,
  avatarUrl: string | null,
  provider: "google" | "github" = "google",
): Promise<{ userId: string; workspaceId: string | null }> {
  const lowerEmail = email.toLowerCase();

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email as any, lowerEmail)).limit(1);
  if (existing) {
    return { userId: existing.id, workspaceId: existing.currentWorkspaceId };
  }

  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;
  const [workspace] = (await db.insert(workspacesTable).values({
    name: `${name}'s Workspace`,
    slug,
    plan: "FREE",
  }).returning()) as any;

  const dummyHash = await bcrypt.hash(randomUUID(), 4);
  const [user] = (await db.insert(usersTable).values({
    email: lowerEmail,
    passwordHash: dummyHash,
    name,
    avatarUrl,
    role: "owner",
    provider,
    currentWorkspaceId: workspace.id,
  }).returning()) as any;

  await db.insert(workspaceMembersTable).values({
    workspaceId: workspace.id,
    userId: user.id,
    role: "owner",
  });

  return { userId: user.id, workspaceId: workspace.id };
}

async function createSessionAndRedirect(res: any, userId: string, redirectTo: string) {
  const token     = randomUUID() + randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(sessionsTable).values({ userId, token, expiresAt });
  res.cookie("session", token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === "production",
  });
  res.redirect(redirectTo);
}

/* ── Google ── */
router.get("/oauth/google", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(503).json({ error: "Google OAuth not configured. Provide GOOGLE_CLIENT_ID." });
    return;
  }
  const state       = randomUUID();
  const callbackUrl = `${getBaseUrl(req)}/api/auth/oauth/google/callback`;
  const isProd      = process.env.NODE_ENV === "production";
  // SameSite=none + Secure required so the cookie survives the cross-origin
  // redirect chain: browser → Google → back to us.
  res.cookie("oauth_state", state, {
    httpOnly: true,
    maxAge:   10 * 60 * 1000,
    sameSite: isProd ? "none" : "lax",
    secure:   isProd,
  });
  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  callbackUrl,
    response_type: "code",
    scope:         "openid email profile",
    state,
    access_type:   "offline",
    prompt:        "select_account",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get("/oauth/google/callback", async (req, res) => {
  try {
    const { code, state } = req.query as Record<string, string>;
    const storedState     = req.cookies?.oauth_state;
    res.clearCookie("oauth_state", {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure:   process.env.NODE_ENV === "production",
    });

    // Allow bypass in dev when cookies might not be set (e.g. localhost CORS)
    const stateMismatch = !state || (storedState && state !== storedState);
    if (stateMismatch) {
      req.log.warn({ state, storedState }, "OAuth state mismatch on Google callback");
      res.status(400).send("OAuth state mismatch. Please try again.");
      return;
    }

    const clientId     = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const callbackUrl  = `${getBaseUrl(req)}/api/auth/oauth/google/callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: callbackUrl, grant_type: "authorization_code" }),
    });
    const tokens = await tokenRes.json() as any;
    if (!tokens.access_token) throw new Error(`No access token from Google: ${JSON.stringify(tokens)}`);

    const userRes  = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile  = await userRes.json() as any;
    const { userId } = await findOrCreateOAuthUser(profile.email, profile.name || profile.email, profile.picture || null, "google");
    const base = getBaseUrl(req);
    await createSessionAndRedirect(res, userId, `${base}/dashboard`);
  } catch (err: any) {
    req.log.error(err, "Google OAuth callback error");
    res.redirect("/?error=oauth_failed");
  }
});

/* ── GitHub ── */
router.get("/oauth/github", (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    res.status(503).json({ error: "GitHub OAuth not configured. Provide GITHUB_CLIENT_ID." });
    return;
  }
  const state       = randomUUID();
  const callbackUrl = `${getBaseUrl(req)}/api/auth/oauth/github/callback`;
  const isProd      = process.env.NODE_ENV === "production";
  res.cookie("oauth_state", state, {
    httpOnly: true,
    maxAge:   10 * 60 * 1000,
    sameSite: isProd ? "none" : "lax",
    secure:   isProd,
  });
  const params = new URLSearchParams({
    client_id:    clientId,
    redirect_uri: callbackUrl,
    scope:        "user:email read:user",
    state,
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

router.get("/oauth/github/callback", async (req, res) => {
  try {
    const { code, state } = req.query as Record<string, string>;
    const storedState     = req.cookies?.oauth_state;
    res.clearCookie("oauth_state", {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure:   process.env.NODE_ENV === "production",
    });

    const stateMismatch = !state || (storedState && state !== storedState);
    if (stateMismatch) {
      req.log.warn({ state, storedState }, "OAuth state mismatch on GitHub callback");
      res.status(400).send("OAuth state mismatch. Please try again.");
      return;
    }

    const clientId     = process.env.GITHUB_CLIENT_ID!;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET!;
    const callbackUrl  = `${getBaseUrl(req)}/api/auth/oauth/github/callback`;

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: callbackUrl }),
    });
    const tokens   = await tokenRes.json() as any;
    if (!tokens.access_token) throw new Error(`No access token from GitHub: ${JSON.stringify(tokens)}`);

    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: "application/vnd.github+json" },
    });
    const profile = await userRes.json() as any;

    let email = profile.email;
    if (!email) {
      const emailsRes = await fetch("https://api.github.com/user/emails", {
        headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: "application/vnd.github+json" },
      });
      const emails = await emailsRes.json() as any[];
      const primary = emails.find((e: any) => e.primary && e.verified);
      email = primary?.email;
    }
    if (!email) throw new Error("No verified email from GitHub");

    const { userId } = await findOrCreateOAuthUser(email, profile.name || profile.login, profile.avatar_url || null, "github");
    const base = getBaseUrl(req);
    await createSessionAndRedirect(res, userId, `${base}/dashboard`);
  } catch (err: any) {
    req.log.error(err, "GitHub OAuth callback error");
    res.redirect("/?error=oauth_failed");
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email as any, email.toLowerCase())).limit(1);
    if (!user) {
      // Return success even if user not found to prevent email enumeration
      res.json({ message: "If an account exists, a reset link has been sent" });
      return;
    }

    const token = randomUUID() + randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.update(usersTable)
      .set({ resetPasswordToken: token, resetPasswordExpiresAt: expiresAt })
      .where(eq(usersTable.id as any, user.id));

    const base = getBaseUrl(req);
    const resetLink = `${base}/auth/reset-password?token=${token}`;
    
    // Import dynamically to avoid circular reference if any, or just use the pre-added email lib
    const { sendPasswordResetEmail } = await import("../lib/email.js");
    sendPasswordResetEmail({ email: user.email, name: user.name }, resetLink).catch(e => req.log.error(e, "Failed to send reset email"));

    res.json({ message: "If an account exists, a reset link has been sent" });
  } catch (err) {
    req.log.error(err, "Error in /auth/forgot-password");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      res.status(400).json({ error: "Token and new password are required" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.resetPasswordToken as any, token)).limit(1);
    
    if (!user || !user.resetPasswordExpiresAt || user.resetPasswordExpiresAt < new Date()) {
      res.status(400).json({ error: "Invalid or expired reset token" });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await db.update(usersTable)
      .set({ 
        passwordHash, 
        resetPasswordToken: null, 
        resetPasswordExpiresAt: null,
        updatedAt: new Date()
      })
      .where(eq(usersTable.id as any, user.id));
      
    // Delete all existing sessions for security
    await db.delete(sessionsTable).where(eq(sessionsTable.userId as any, user.id));

    res.json({ message: "Password updated successfully!" });
  } catch (err) {
    req.log.error(err, "Error in /auth/reset-password");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;


