import { Router } from "express";
import { db, projectsTable, scansTable, findingsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { runRealScan } from "../lib/scanner/index.js";
const router = Router();
router.get("/", requireAuth, async (req, res) => {
    try {
        const workspace = req.workspace;
        const projects = await db.select().from(projectsTable)
            .where(eq(projectsTable.workspaceId, workspace.id))
            .orderBy(desc(projectsTable.createdAt));
        const projectsWithStats = await Promise.all(projects.map(async (project) => {
            const scans = await db.select().from(scansTable).where(eq(scansTable.projectId, project.id));
            const findings = await db.select().from(findingsTable).where(eq(findingsTable.projectId, project.id));
            const criticalCount = findings.filter(f => f.severity === "CRITICAL").length;
            const lastScan = scans.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
            return {
                ...project,
                scanCount: scans.length,
                findingCount: findings.length,
                criticalCount,
                lastScanAt: lastScan?.createdAt || null,
            };
        }));
        res.json(projectsWithStats);
    }
    catch (err) {
        req.log.error(err, "Error listing projects");
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/", requireAuth, async (req, res) => {
    try {
        const workspace = req.workspace;
        const { name, description, targetUrl, targetType } = req.body;
        if (!name || !targetUrl || !targetType) {
            res.status(400).json({ error: "name, targetUrl, and targetType are required" });
            return;
        }
        // Normalise URL: strip duplicate protocol (e.g. https://https://...) and trailing slash
        let normalizedUrl = targetUrl.trim();
        normalizedUrl = normalizedUrl.replace(/^(https?:\/\/)+/, (m) => {
            return m.startsWith("https://https://") ? "https://" : m.startsWith("http://http://") ? "http://" : m;
        });
        normalizedUrl = normalizedUrl.replace(/\/+$/, "");
        // Validate URL
        try {
            new URL(normalizedUrl);
        }
        catch {
            res.status(400).json({ error: "Invalid target URL — must be a valid https:// address" });
            return;
        }
        const [project] = (await db.insert(projectsTable).values({
            workspaceId: workspace.id,
            name,
            description: description || null,
            targetUrl: normalizedUrl,
            targetType: targetType || "WEB_APP",
            status: "active",
        }).returning());
        res.status(201).json(project);
    }
    catch (err) {
        req.log.error(err, "Error creating project");
        res.status(500).json({ error: "Internal server error" });
    }
});
router.get("/:id", requireAuth, async (req, res) => {
    try {
        const workspace = req.workspace;
        const id = req.params.id;
        const [project] = await db.select().from(projectsTable)
            .where(and(eq(projectsTable.id, id), eq(projectsTable.workspaceId, workspace.id)))
            .limit(1);
        if (!project) {
            res.status(404).json({ error: "Project not found" });
            return;
        }
        const scans = await db.select().from(scansTable)
            .where(eq(scansTable.projectId, id))
            .orderBy(desc(scansTable.createdAt));
        const findings = await db.select().from(findingsTable)
            .where(eq(findingsTable.projectId, id))
            .orderBy(desc(findingsTable.createdAt));
        res.json({
            ...project,
            scans: scans.map(s => ({
                id: s.id,
                status: s.status,
                startedAt: s.startedAt,
                completedAt: s.completedAt,
                findingsCount: s.findingsCount,
                criticalCount: s.criticalCount,
                createdAt: s.createdAt,
            })),
            findings: findings.map(f => ({ ...f, projectName: project.name })),
        });
    }
    catch (err) {
        req.log.error(err, "Error getting project");
        res.status(500).json({ error: "Internal server error" });
    }
});
router.put("/:id", requireAuth, async (req, res) => {
    try {
        const workspace = req.workspace;
        const id = req.params.id;
        const { name, description, targetUrl, status } = req.body;
        const [project] = await db.select().from(projectsTable)
            .where(and(eq(projectsTable.id, id), eq(projectsTable.workspaceId, workspace.id)))
            .limit(1);
        if (!project) {
            res.status(404).json({ error: "Project not found" });
            return;
        }
        const [updated] = (await db.update(projectsTable)
            .set({
            name: name || project.name,
            description: description !== undefined ? description : project.description,
            targetUrl: targetUrl || project.targetUrl,
            status: status || project.status,
            updatedAt: new Date(),
        })
            .where(eq(projectsTable.id, id))
            .returning());
        res.json(updated);
    }
    catch (err) {
        req.log.error(err, "Error updating project");
        res.status(500).json({ error: "Internal server error" });
    }
});
router.delete("/:id", requireAuth, async (req, res) => {
    try {
        const workspace = req.workspace;
        const id = req.params.id;
        const [project] = await db.select().from(projectsTable)
            .where(and(eq(projectsTable.id, id), eq(projectsTable.workspaceId, workspace.id)))
            .limit(1);
        if (!project) {
            res.status(404).json({ error: "Project not found" });
            return;
        }
        await db.delete(projectsTable).where(eq(projectsTable.id, id));
        res.json({ message: "Project deleted" });
    }
    catch (err) {
        req.log.error(err, "Error deleting project");
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/:id/scan", requireAuth, async (req, res) => {
    try {
        const workspace = req.workspace;
        const id = req.params.id;
        const { scanMode = "PASSIVE" } = req.body;
        const validModes = ["PASSIVE", "ACTIVE", "CONTINUOUS"];
        const resolvedMode = validModes.includes(scanMode) ? scanMode : "PASSIVE";
        const [project] = await db.select().from(projectsTable)
            .where(and(eq(projectsTable.id, id), eq(projectsTable.workspaceId, workspace.id)))
            .limit(1);
        if (!project) {
            res.status(404).json({ error: "Project not found" });
            return;
        }
        const [scan] = (await db.insert(scansTable).values({
            projectId: id,
            status: "PENDING",
            scanMode: resolvedMode,
        }).returning());
        // Run the real security scanner in the background
        runRealScan(scan.id, project.targetUrl, resolvedMode).catch(err => {
            console.error("Scanner error:", err);
        });
        res.status(201).json(scan);
    }
    catch (err) {
        req.log.error(err, "Error triggering scan");
        res.status(500).json({ error: "Internal server error" });
    }
});
export default router;
