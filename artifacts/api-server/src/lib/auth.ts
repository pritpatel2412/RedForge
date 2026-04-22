import { db, sessionsTable, usersTable, workspacesTable, workspaceMembersTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";

// ── In-memory session cache for ultra-low latency (< 5ms) auth ──────────────
const SESSION_CACHE = new Map<string, { result: any; expires: number }>();
const CACHE_TTL = 30000; // 30 seconds
const MAX_CACHE_SIZE = 2000;

function cleanupCache() {
  if (SESSION_CACHE.size > MAX_CACHE_SIZE) {
    const now = Date.now();
    for (const [token, data] of SESSION_CACHE.entries()) {
      if (data.expires < now) SESSION_CACHE.delete(token);
    }
    if (SESSION_CACHE.size > MAX_CACHE_SIZE) SESSION_CACHE.clear();
  }
}

export async function getUserFromRequest(req: Request) {
  const token = req.cookies?.session || req.headers.authorization?.replace("Bearer ", "");
  if (!token) return null;

  // Check cache first
  const cached = SESSION_CACHE.get(token);
  if (cached && cached.expires > Date.now()) {
    return cached.result;
  }

  // Optimized: Single query with joins instead of three sequential queries
  const [result] = await db
    .select({
      user: usersTable,
      workspace: workspacesTable,
    })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .leftJoin(workspacesTable, eq(usersTable.currentWorkspaceId, workspacesTable.id))
    .where(
      and(
        eq(sessionsTable.token, token),
        gt(sessionsTable.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!result) return null;

  const finalResult = { user: result.user, workspace: result.workspace || null };

  // Cache the result for subsequent requests
  cleanupCache();
  SESSION_CACHE.set(token, { result: finalResult, expires: Date.now() + CACHE_TTL });

  return finalResult;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const result = await getUserFromRequest(req);
  if (!result || !result.workspace) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).user = result.user;
  (req as any).workspace = result.workspace;
  next();
}

/**
 * Ensures the user has an active subscription or is within a free trial.
 * Blocks access to functional features if trial is expired and no paid plan is active.
 */
export async function requireActiveSubscription(req: Request, res: Response, next: NextFunction) {
  const result = await getUserFromRequest(req);
  if (!result || !result.workspace) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { workspace, user } = result;

  // Admin users bypass trial/plan checks for support purposes
  if (user.role === "admin") {
    (req as any).user = user;
    (req as any).workspace = workspace;
    return next();
  }

  // If the plan is FREE, verify the trial hasn't expired
  if (workspace.plan === "FREE") {
    const trialEnd = workspace.trialEndsAt ? new Date(workspace.trialEndsAt) : null;
    if (trialEnd && trialEnd < new Date()) {
      res.status(402).json({
        error: "TRIAL_EXPIRED",
        message: "Your free trial has expired. Please upgrade your plan to continue using RedForge services.",
        trialEndsAt: workspace.trialEndsAt
      });
      return;
    }
  }

  (req as any).user = user;
  (req as any).workspace = workspace;
  next();
}
// ─────────────────────────────────────────────────────────────────────────────
