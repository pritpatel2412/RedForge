import { db, sessionsTable, usersTable, workspacesTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
export async function getUserFromRequest(req) {
    const token = req.cookies?.session || req.headers.authorization?.replace("Bearer ", "");
    if (!token)
        return null;
    const [session] = await db
        .select()
        .from(sessionsTable)
        .where(and(eq(sessionsTable.token, token), gt(sessionsTable.expiresAt, new Date())))
        .limit(1);
    if (!session)
        return null;
    const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, session.userId))
        .limit(1);
    if (!user)
        return null;
    const workspaceId = user.currentWorkspaceId;
    if (!workspaceId)
        return null;
    const [workspace] = await db
        .select()
        .from(workspacesTable)
        .where(eq(workspacesTable.id, workspaceId))
        .limit(1);
    return { user, workspace: workspace || null };
}
export async function requireAuth(req, res, next) {
    const result = await getUserFromRequest(req);
    if (!result || !result.workspace) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    req.user = result.user;
    req.workspace = result.workspace;
    next();
}
