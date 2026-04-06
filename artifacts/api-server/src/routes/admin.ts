import { Router } from "express";
import { db, usersTable, workspacesTable, workspaceMembersTable, couponsTable, couponUsesTable, userActivityLogsTable, emailLogsTable } from "@workspace/db";
import { eq, desc, asc, count, and, gte, lte, sql, ne, isNotNull, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { sendPlanChangedEmail } from "../lib/email.js";
import { logActivity } from "../lib/activity.js";

const router = Router();

function requireAdmin(req: any, res: any, next: any) {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Forbidden — admin only" });
    return;
  }
  next();
}

router.use(requireAuth, requireAdmin);

// ─── Overview / Analytics ───────────────────────────────────────────────────

router.get("/stats", async (req, res) => {
  try {
    const [totalUsers] = await db.select({ count: count() }).from(usersTable);
    const [totalWorkspaces] = await db.select({ count: count() }).from(workspacesTable);
    const [proWorkspaces] = await db.select({ count: count() }).from(workspacesTable).where(eq(workspacesTable.plan, "PRO"));
    const [enterpriseWorkspaces] = await db.select({ count: count() }).from(workspacesTable).where(eq(workspacesTable.plan, "ENTERPRISE"));
    const [freeWorkspaces] = await db.select({ count: count() }).from(workspacesTable).where(eq(workspacesTable.plan, "FREE"));
    const now = new Date();
    const [activeTrials] = await db.select({ count: count() }).from(workspacesTable).where(and(eq(workspacesTable.plan, "FREE"), gte(workspacesTable.trialEndsAt, now)));
    const [expiredTrials] = await db.select({ count: count() }).from(workspacesTable).where(and(eq(workspacesTable.plan, "FREE"), lte(workspacesTable.trialEndsAt, now), isNotNull(workspacesTable.trialEndsAt)));
    const [totalActivity] = await db.select({ count: count() }).from(userActivityLogsTable);
    const [totalEmails] = await db.select({ count: count() }).from(emailLogsTable);
    const [sentEmails] = await db.select({ count: count() }).from(emailLogsTable).where(eq(emailLogsTable.status, "sent"));

    // Activity over last 30 days grouped by day
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dailyActivity = await db
      .select({
        day: sql<string>`DATE(created_at)`,
        count: count(),
      })
      .from(userActivityLogsTable)
      .where(gte(userActivityLogsTable.createdAt, thirtyDaysAgo))
      .groupBy(sql`DATE(created_at)`)
      .orderBy(sql`DATE(created_at)`);

    // Signup trend (last 30 days)
    const signupTrend = await db
      .select({
        day: sql<string>`DATE(created_at)`,
        count: count(),
      })
      .from(usersTable)
      .where(gte(usersTable.createdAt, thirtyDaysAgo))
      .groupBy(sql`DATE(created_at)`)
      .orderBy(sql`DATE(created_at)`);

    // Top actions
    const topActions = await db
      .select({
        action: userActivityLogsTable.action,
        count: count(),
      })
      .from(userActivityLogsTable)
      .groupBy(userActivityLogsTable.action)
      .orderBy(desc(count()))
      .limit(10);

    res.json({
      totals: {
        users: totalUsers.count,
        workspaces: totalWorkspaces.count,
        pro: proWorkspaces.count,
        enterprise: enterpriseWorkspaces.count,
        free: freeWorkspaces.count,
        activeTrials: activeTrials.count,
        expiredTrials: expiredTrials.count,
        activity: totalActivity.count,
        emailsSent: sentEmails.count,
        emailsTotal: totalEmails.count,
      },
      dailyActivity,
      signupTrend,
      topActions,
    });
  } catch (err) {
    req.log.error(err, "admin stats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Users ───────────────────────────────────────────────────────────────────

router.get("/users", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 25);
    const offset = (page - 1) * limit;
    const search = (req.query.search as string) || "";

    let query = db.select({
      user: usersTable,
      workspace: workspacesTable,
    })
      .from(usersTable)
      .leftJoin(workspacesTable, eq(usersTable.currentWorkspaceId, workspacesTable.id))
      .orderBy(desc(usersTable.createdAt))
      .limit(limit)
      .offset(offset);

    const users = await query;
    const [{ count: total }] = await db.select({ count: count() }).from(usersTable);

    // Get last activity for each user
    const userIds = users.map(u => u.user.id);
    const lastActivities: Record<string, Date> = {};
    if (userIds.length > 0) {
      const activities = await db
        .select({
          userId: userActivityLogsTable.userId,
          lastSeen: sql<Date>`MAX(created_at)`,
        })
        .from(userActivityLogsTable)
        .where(inArray(userActivityLogsTable.userId, userIds))
        .groupBy(userActivityLogsTable.userId);
      for (const a of activities) {
        if (a.userId) lastActivities[a.userId] = a.lastSeen;
      }
    }

    res.json({
      users: users.map(({ user, workspace }) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        provider: user.provider || "email",
        createdAt: user.createdAt,
        lastSeenAt: lastActivities[user.id] || null,
        workspace: workspace ? {
          id: workspace.id,
          name: workspace.name,
          plan: workspace.plan,
          trialEndsAt: workspace.trialEndsAt,
        } : null,
      })),
      pagination: { page, limit, total: Number(total), pages: Math.ceil(Number(total) / limit) },
    });
  } catch (err) {
    req.log.error(err, "admin users error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/users/:id/plan", async (req, res) => {
  try {
    const { id } = req.params;
    const { plan, trialDays } = req.body;
    const admin = (req as any).user;

    if (!["FREE", "PRO", "ENTERPRISE"].includes(plan)) {
      res.status(400).json({ error: "Invalid plan" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const workspaceId = user.currentWorkspaceId;
    if (!workspaceId) { res.status(400).json({ error: "User has no workspace" }); return; }

    const trialEndsAt = trialDays ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000) : null;

    await db.update(workspacesTable).set({
      plan,
      trialEndsAt: trialEndsAt,
      updatedAt: new Date(),
    }).where(eq(workspacesTable.id, workspaceId));

    // Set admin role if requested
    if (req.body.setAdmin !== undefined) {
      await db.update(usersTable).set({
        role: req.body.setAdmin ? "admin" : "user",
        updatedAt: new Date(),
      }).where(eq(usersTable.id, id));
    }

    await logActivity({ userId: admin.id, workspaceId: admin.currentWorkspaceId, action: "admin.plan_change", metadata: { targetUserId: id, newPlan: plan }, req });

    // Send email notification
    await sendPlanChangedEmail({ email: user.email, name: user.name }, plan, "admin");

    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "admin plan change error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/users/:id/role", async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const admin = (req as any).user;

    if (!["user", "admin"].includes(role)) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }

    await db.update(usersTable).set({ role, updatedAt: new Date() }).where(eq(usersTable.id, id));
    await logActivity({ userId: admin.id, action: "admin.role_change", metadata: { targetUserId: id, newRole: role }, req });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const admin = (req as any).user;

    if (id === admin.id) {
      res.status(400).json({ error: "Cannot delete yourself" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    await db.delete(usersTable).where(eq(usersTable.id, id));
    await logActivity({ userId: admin.id, action: "admin.user_delete", metadata: { targetEmail: user.email }, req });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Coupons ─────────────────────────────────────────────────────────────────

router.get("/coupons", async (req, res) => {
  try {
    const coupons = await db
      .select()
      .from(couponsTable)
      .orderBy(desc(couponsTable.createdAt));

    res.json({ coupons });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/coupons", async (req, res) => {
  try {
    const admin = (req as any).user;
    const { code, description, type, grantedPlan, durationDays, discountPercent, maxUses, validUntil } = req.body;

    if (!code || !type) {
      res.status(400).json({ error: "code and type are required" });
      return;
    }

    const [coupon] = await db.insert(couponsTable).values({
      code: code.toUpperCase().trim(),
      description,
      type,
      grantedPlan: grantedPlan || null,
      durationDays: durationDays || 30,
      discountPercent: discountPercent || null,
      maxUses: maxUses || null,
      validUntil: validUntil ? new Date(validUntil) : null,
      createdBy: admin.id,
    }).returning();

    await logActivity({ userId: admin.id, action: "admin.coupon_create", metadata: { code: coupon.code }, req });

    res.json({ coupon });
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "Coupon code already exists" });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/coupons/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive, validUntil, maxUses, description } = req.body;
    const admin = (req as any).user;

    await db.update(couponsTable).set({
      ...(isActive !== undefined ? { isActive } : {}),
      ...(validUntil !== undefined ? { validUntil: validUntil ? new Date(validUntil) : null } : {}),
      ...(maxUses !== undefined ? { maxUses } : {}),
      ...(description !== undefined ? { description } : {}),
      updatedAt: new Date(),
    }).where(eq(couponsTable.id, id));

    await logActivity({ userId: admin.id, action: "admin.coupon_update", metadata: { couponId: id }, req });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/coupons/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const admin = (req as any).user;
    await db.delete(couponsTable).where(eq(couponsTable.id, id));
    await logActivity({ userId: admin.id, action: "admin.coupon_delete", metadata: { couponId: id }, req });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Activity Logs ───────────────────────────────────────────────────────────

router.get("/activity", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, parseInt(req.query.limit as string) || 50);
    const offset = (page - 1) * limit;
    const action = req.query.action as string;

    const whereClause = action ? eq(userActivityLogsTable.action, action) : undefined;

    const logs = await db
      .select({
        log: userActivityLogsTable,
        user: { name: usersTable.name, email: usersTable.email },
      })
      .from(userActivityLogsTable)
      .leftJoin(usersTable, eq(userActivityLogsTable.userId, usersTable.id))
      .where(whereClause)
      .orderBy(desc(userActivityLogsTable.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count: total }] = await db.select({ count: count() }).from(userActivityLogsTable);

    res.json({
      logs: logs.map(({ log, user }) => ({
        id: log.id,
        action: log.action,
        metadata: log.metadata ? JSON.parse(log.metadata) : null,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt,
        user: user || null,
      })),
      pagination: { page, limit, total: Number(total), pages: Math.ceil(Number(total) / limit) },
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Email Logs ──────────────────────────────────────────────────────────────

router.get("/emails", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 25);
    const offset = (page - 1) * limit;

    const logs = await db
      .select()
      .from(emailLogsTable)
      .orderBy(desc(emailLogsTable.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count: total }] = await db.select({ count: count() }).from(emailLogsTable);

    res.json({
      logs,
      pagination: { page, limit, total: Number(total), pages: Math.ceil(Number(total) / limit) },
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
