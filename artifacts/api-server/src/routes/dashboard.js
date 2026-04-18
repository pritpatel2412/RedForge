import { Router } from "express";
import { db, projectsTable, scansTable, findingsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
const router = Router();
router.get("/stats", requireAuth, async (req, res) => {
    try {
        const workspace = req.workspace;
        const projects = await db.select().from(projectsTable)
            .where(eq(projectsTable.workspaceId, workspace.id));
        const projectIds = projects.map(p => p.id);
        const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]));
        if (projectIds.length === 0) {
            res.json({
                totalProjects: 0,
                totalScans: 0,
                openFindings: 0,
                criticalFindings: 0,
                highFindings: 0,
                mediumFindings: 0,
                lowFindings: 0,
                fixedFindings: 0,
                scansThisMonth: 0,
                recentFindings: [],
                recentScans: [],
            });
            return;
        }
        const allScans = await db.select().from(scansTable).orderBy(desc(scansTable.createdAt));
        const workspaceScans = allScans.filter(s => projectIds.includes(s.projectId));
        const allFindings = await db.select().from(findingsTable).orderBy(desc(findingsTable.createdAt));
        const workspaceFindings = allFindings.filter(f => projectIds.includes(f.projectId));
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const scansThisMonth = workspaceScans.filter(s => new Date(s.createdAt) >= monthStart).length;
        const openFindings = workspaceFindings.filter(f => f.status === "OPEN" || f.status === "IN_PROGRESS");
        const criticalFindings = openFindings.filter(f => f.severity === "CRITICAL").length;
        const highFindings = openFindings.filter(f => f.severity === "HIGH").length;
        const mediumFindings = openFindings.filter(f => f.severity === "MEDIUM").length;
        const lowFindings = openFindings.filter(f => f.severity === "LOW").length;
        const fixedFindings = workspaceFindings.filter(f => f.status === "FIXED").length;
        const recentFindings = workspaceFindings.slice(0, 10).map(f => ({
            ...f,
            projectName: projectMap[f.projectId] || "Unknown",
        }));
        const recentScans = workspaceScans.slice(0, 10).map(s => ({
            ...s,
            projectName: projectMap[s.projectId] || "Unknown",
        }));
        res.json({
            totalProjects: projects.length,
            totalScans: workspaceScans.length,
            openFindings: openFindings.length,
            criticalFindings,
            highFindings,
            mediumFindings,
            lowFindings,
            fixedFindings,
            scansThisMonth,
            recentFindings,
            recentScans,
        });
    }
    catch (err) {
        req.log.error(err, "Error getting dashboard stats");
        res.status(500).json({ error: "Internal server error" });
    }
});
export default router;
