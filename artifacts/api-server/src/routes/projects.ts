import { Router } from "express";
import { db, projectsTable, scansTable, findingsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { runRealScan } from "../lib/scanner/index.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const workspace = (req as any).workspace;

    // Use subqueries to get aggregated stats for all projects in one efficient query
    const results = await db.select({
      id: projectsTable.id,
      name: projectsTable.name,
      description: projectsTable.description,
      targetUrl: projectsTable.targetUrl,
      targetType: projectsTable.targetType,
      status: projectsTable.status,
      createdAt: projectsTable.createdAt,
      updatedAt: projectsTable.updatedAt,
      scanCount: sql<number>`(SELECT count(*) FROM ${scansTable} WHERE ${scansTable.projectId} = ${projectsTable.id})`,
      findingCount: sql<number>`(SELECT count(*) FROM ${findingsTable} WHERE ${findingsTable.projectId} = ${projectsTable.id})`,
      criticalCount: sql<number>`(SELECT count(*) FROM ${findingsTable} WHERE ${findingsTable.projectId} = ${projectsTable.id} AND ${findingsTable.severity} = 'CRITICAL')`,
      lastScanAt: sql<string>`(SELECT max(${scansTable.createdAt}) FROM ${scansTable} WHERE ${scansTable.projectId} = ${projectsTable.id})`,
    })
    .from(projectsTable)
    .where(eq(projectsTable.workspaceId, workspace.id))
    .orderBy(desc(projectsTable.createdAt));

    res.json(results.map(p => ({
      ...p,
      scanCount: Number(p.scanCount || 0),
      findingCount: Number(p.findingCount || 0),
      criticalCount: Number(p.criticalCount || 0),
    })));
  } catch (err) {
    req.log.error(err, "Error listing projects");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const workspace = (req as any).workspace;
    const { name, description, targetUrl, targetType, slackWebhookUrl, githubRepo, githubBranch, githubToken } = req.body;

    if (!name || !targetUrl || !targetType) {
      res.status(400).json({ error: "name, targetUrl, and targetType are required" });
      return;
    }

    // Normalise URL: strip duplicate protocol (e.g. https://https://...) and trailing slash
    let normalizedUrl = targetUrl.trim();
    normalizedUrl = normalizedUrl.replace(/^(https?:\/\/)+/, (m: string) => {
      return m.startsWith("https://https://") ? "https://" : m.startsWith("http://http://") ? "http://" : m;
    });
    normalizedUrl = normalizedUrl.replace(/\/+$/, "");

    // Validate URL
    try {
      new URL(normalizedUrl);
    } catch {
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
      slackWebhookUrl: (slackWebhookUrl && slackWebhookUrl.startsWith("https://hooks.slack.com/")) ? slackWebhookUrl : null,
      githubRepo: githubRepo || null,
      githubBranch: githubBranch || "main",
      githubToken: githubToken || null,
    }).returning()) as any;

    res.status(201).json(project);
  } catch (err) {
    req.log.error(err, "Error creating project");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const workspace = (req as any).workspace;
    const id = req.params.id as string;

    const project = (await db.select().from(projectsTable)
      .where(and(eq(projectsTable.id as any, id), eq(projectsTable.workspaceId as any, workspace.id)))
      .limit(1).then(r => r[0])) as any;

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const scans = await db.select().from(scansTable)
      .where(eq(scansTable.projectId as any, id))
      .orderBy(desc(scansTable.createdAt));

    const findings = await db.select().from(findingsTable)
      .where(eq(findingsTable.projectId as any, id))
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
  } catch (err) {
    req.log.error(err, "Error getting project");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const workspace = (req as any).workspace;
    const id = req.params.id as string;
    const { name, description, targetUrl, status, slackWebhookUrl, githubRepo, githubBranch, githubToken } = req.body;

    const project = (await db.select().from(projectsTable)
      .where(and(eq(projectsTable.id as any, id), eq(projectsTable.workspaceId as any, workspace.id)))
      .limit(1).then(r => r[0])) as any;

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
        slackWebhookUrl: (slackWebhookUrl !== undefined && (slackWebhookUrl === null || slackWebhookUrl.startsWith("https://hooks.slack.com/"))) 
          ? slackWebhookUrl 
          : project.slackWebhookUrl,
        githubRepo: githubRepo !== undefined ? githubRepo : project.githubRepo,
        githubBranch: githubBranch !== undefined ? githubBranch : project.githubBranch,
        githubToken: githubToken !== undefined ? githubToken : project.githubToken,
        updatedAt: new Date(),
      })
      .where(eq(projectsTable.id as any, id))
      .returning()) as any;

    res.json(updated);
  } catch (err) {
    req.log.error(err, "Error updating project");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const workspace = (req as any).workspace;
    const id = req.params.id as string;

    const project = (await db.select().from(projectsTable)
      .where(and(eq(projectsTable.id as any, id), eq(projectsTable.workspaceId as any, workspace.id)))
      .limit(1).then(r => r[0])) as any;

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    await db.delete(projectsTable).where(eq(projectsTable.id as any, id));
    res.json({ message: "Project deleted" });
  } catch (err) {
    req.log.error(err, "Error deleting project");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/scan", requireAuth, async (req, res) => {
  try {
    const workspace = (req as any).workspace;
    const id = req.params.id as string;
    const { scanMode = "PASSIVE" } = req.body;

    const validModes = ["PASSIVE", "ACTIVE", "CONTINUOUS"];
    const resolvedMode = validModes.includes(scanMode) ? scanMode : "PASSIVE";

    const project = (await db.select().from(projectsTable)
      .where(and(eq(projectsTable.id as any, id), eq(projectsTable.workspaceId as any, workspace.id)))
      .limit(1).then(r => r[0])) as any;

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const [scan] = (await db.insert(scansTable).values({
      projectId: id,
      status: "PENDING",
      scanMode: resolvedMode,
    }).returning()) as any;

    // Run the real security scanner in the background
    runRealScan(scan.id, project.targetUrl, resolvedMode as any).catch(err => {
      console.error("Scanner error:", err);
    });

    res.status(201).json(scan);
  } catch (err) {
    req.log.error(err, "Error triggering scan");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
