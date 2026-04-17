import { db, userActivityLogsTable } from "@workspace/db";
export async function logActivity(params) {
    try {
        const { userId, workspaceId, action, metadata, req } = params;
        await db.insert(userActivityLogsTable).values({
            userId: userId || null,
            workspaceId: workspaceId || null,
            action,
            metadata: metadata ? JSON.stringify(metadata) : null,
            ipAddress: req ? (req.headers["x-forwarded-for"] || req.ip || null) : null,
            userAgent: req ? (req.headers["user-agent"] || null) : null,
        });
    }
    catch (err) {
        console.error("[activity] log failed:", err);
    }
}
