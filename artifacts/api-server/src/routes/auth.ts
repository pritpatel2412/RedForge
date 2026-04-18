import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { db, usersTable, sessionsTable, workspacesTable, workspaceMembersTable } from "@workspace/db";
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
  // Always use APP_URL for OAuth callbacks — header sniffing is unreliable
  // on the callback leg (no origin/referer from OAuth providers).
  const appUrl = process.env.APP_URL;
  if (appUrl) return appUrl.replace(/\/+$/, "");

  // Fallback for local dev only
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


