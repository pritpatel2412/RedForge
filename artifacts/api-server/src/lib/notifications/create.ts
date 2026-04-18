import { db, notificationsTable } from "@workspace/db";

export interface NotificationPayload {
  userId:      string;
  workspaceId?: string | null;
  type?:       "info" | "success" | "warning" | "error";
  title:       string;
  body:        string;
  link?:       string | null;
}

/**
 * Inserts a notification row.
 * Fire-and-forget safe — callers can `.catch(() => {})`.
 */
export async function createNotification(payload: NotificationPayload): Promise<void> {
  await db.insert(notificationsTable).values({
    userId:      payload.userId,
    workspaceId: payload.workspaceId ?? null,
    type:        payload.type ?? "info",
    title:       payload.title,
    body:        payload.body,
    link:        payload.link ?? null,
  });
}
