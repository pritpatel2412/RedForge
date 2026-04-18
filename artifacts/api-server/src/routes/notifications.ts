import { Router } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

// ── GET /api/notifications ────────────────────────────────────────────────────
// Returns the 30 most recent notifications for the authenticated user.
router.get("/", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const rows = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId as any, user.id))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(30);

    res.json(rows);
  } catch (err) {
    req.log.error(err, "Error fetching notifications");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PATCH /api/notifications/read-all ────────────────────────────────────────
router.patch("/read-all", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    await db
      .update(notificationsTable)
      .set({ read: true })
      .where(
        and(
          eq(notificationsTable.userId as any, user.id),
          eq(notificationsTable.read as any, false)
        )
      );
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "Error marking all notifications read");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PATCH /api/notifications/:id/read ────────────────────────────────────────
router.patch("/:id/read", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    await db
      .update(notificationsTable)
      .set({ read: true })
      .where(
        and(
          eq(notificationsTable.id as any, id),
          eq(notificationsTable.userId as any, user.id)
        )
      );
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "Error marking notification read");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── DELETE /api/notifications/:id ────────────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    await db
      .delete(notificationsTable)
      .where(
        and(
          eq(notificationsTable.id as any, id),
          eq(notificationsTable.userId as any, user.id)
        )
      );
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "Error dismissing notification");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
