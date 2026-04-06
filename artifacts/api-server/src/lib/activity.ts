import { db, userActivityLogsTable } from "@workspace/db";
import type { Request } from "express";

export async function logActivity(params: {
  userId?: string | null;
  workspaceId?: string | null;
  action: string;
  metadata?: Record<string, any>;
  req?: Request;
}) {
  try {
    const { userId, workspaceId, action, metadata, req } = params;
    await db.insert(userActivityLogsTable).values({
      userId: userId || null,
      workspaceId: workspaceId || null,
      action,
      metadata: metadata ? JSON.stringify(metadata) : null,
      ipAddress: req ? (req.headers["x-forwarded-for"] as string || req.ip || null) : null,
      userAgent: req ? (req.headers["user-agent"] || null) : null,
    });
  } catch (err) {
    console.error("[activity] log failed:", err);
  }
}
