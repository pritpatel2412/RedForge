import { Router } from "express";
import { db, projectsTable, scansTable, findingsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { runRealScan } from "../lib/scanner/index.js";
import { isAtLeastPlan } from "../lib/plan.js";
import { getAutopilotConfig, queueContinuousScan, upsertAutopilotConfig } from "../lib/autopilot.js";

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
    .where(eq(projectsTable.workspaceId, workspace.id as any))
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

    // FREE plan: limit number of projects (scan targets)
    if (!isAtLeastPlan(workspace.plan, "PRO")) {
      const [{ count }] = await db.select({ count: sql<number>`count(*)` })
        .from(projectsTable)
        .where(eq(projectsTable.workspaceId as any, workspace.id as any));
      if (Number(count || 0) >= 3) {
        res.status(403).json({ error: "FREE plan limit reached: max 3 scan targets. Upgrade to PRO." });
        return;
      }
    }

    // Normalise URL: strip duplicate protocol (e.g. https://https://...) and trailing slash
    let normalizedUrl = targetUrl.trim();
    normalizedUrl = normalizedUrl.replace(/^(https?:\/\/)+/, (m: string) => {
      if (m.startsWith("https://https://")) return "https://";
      if (m.startsWith("http://http://")) return "http://";
      return m;
    });
    normalizedUrl = normalizedUrl.replace(/\/+$/, "");

    // Validate URL
    try {
      new URL(normalizedUrl);
    } catch {
      res.status(400).json({ error: "Invalid target URL — must be a valid https:// address" });
      return;
    }

    const [project] = await db.insert(projectsTable).values({
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
    }).returning();

    res.status(201).json(project);
  } catch (err) {
    req.log.error(err, "Error creating project");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const workspace = (req as any).workspace;
    const id = req.params.id;

    if (!id) {
      res.status(400).json({ error: "Missing project ID" });
      return;
    }

    const [project] = await db.select().from(projectsTable)
      .where(and(eq(projectsTable.id, id as any), eq(projectsTable.workspaceId, workspace.id as any)))
      .limit(1);

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    // Limit scans and findings to the most recent ones for the detail view
    // This prevents 500 errors on projects with massive histories
    const scans = await db.select().from(scansTable)
      .where(eq(scansTable.projectId, id as any))
      .orderBy(desc(scansTable.createdAt))
      .limit(50);

    const findings = await db.select().from(findingsTable)
      .where(eq(findingsTable.projectId, id as any))
      .orderBy(desc(findingsTable.createdAt))
      .limit(100);

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
    const id = req.params.id;
    const { name, description, targetUrl, status, slackWebhookUrl, githubRepo, githubBranch, githubToken } = req.body;

    const [project] = await db.select().from(projectsTable)
      .where(and(eq(projectsTable.id, id as any), eq(projectsTable.workspaceId, workspace.id as any)))
      .limit(1);

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const [updated] = await db.update(projectsTable)
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
      .where(eq(projectsTable.id, id as any))
      .returning();

    res.json(updated);
  } catch (err) {
    req.log.error(err, "Error updating project");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const workspace = (req as any).workspace;
    const id = req.params.id;

    const [project] = await db.select().from(projectsTable)
      .where(and(eq(projectsTable.id, id as any), eq(projectsTable.workspaceId, workspace.id as any)))
      .limit(1);

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    await db.delete(projectsTable).where(eq(projectsTable.id, id as any));
    res.json({ message: "Project deleted" });
  } catch (err) {
    req.log.error(err, "Error deleting project");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/scan", requireAuth, async (req, res) => {
  try {
    const workspace = (req as any).workspace;
    const id = req.params.id;
    const { scanMode = "PASSIVE" } = req.body;

    const validModes = ["PASSIVE", "ACTIVE", "CONTINUOUS"];
    const resolvedMode = validModes.includes(scanMode) ? scanMode : "PASSIVE";

    const [project] = await db.select().from(projectsTable)
      .where(and(eq(projectsTable.id, id as any), eq(projectsTable.workspaceId, workspace.id as any)))
      .limit(1);

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    // FREE plan scan limit: 50 scans per calendar month
    if (!isAtLeastPlan(workspace.plan, "PRO")) {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [{ count }] = await db.select({ count: sql<number>`count(*)` })
        .from(scansTable)
        .innerJoin(projectsTable, eq(scansTable.projectId, projectsTable.id))
        .where(and(
          eq(projectsTable.workspaceId as any, workspace.id as any),
          sql`${scansTable.createdAt} >= ${startOfMonth}`
        ));

      if (Number(count || 0) >= 50) {
        res.status(403).json({ error: "FREE plan limit reached: 50 scans/month. Upgrade to PRO." });
        return;
      }
    }

    // ACTIVE scanning requires PRO+
    if (resolvedMode === "ACTIVE" && !isAtLeastPlan(workspace.plan, "PRO")) {
      res.status(403).json({ error: "ACTIVE scan mode requires PRO plan" });
      return;
    }

    const [scan] = await db.insert(scansTable).values({
      projectId: id as string,
      status: "PENDING",
      scanMode: resolvedMode,
    }).returning();

    // CONTINUOUS mode is queued and executed by the autopilot worker.
    if (resolvedMode !== "CONTINUOUS") {
      runRealScan(scan.id, project.targetUrl, resolvedMode as any).catch(err => {
        console.error("Scanner error:", err);
      });
    }

    res.status(201).json(scan);
  } catch (err) {
    req.log.error(err, "Error triggering scan");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id/autopilot", requireAuth, async (req, res) => {
  try {
    const workspace = (req as any).workspace;
    const id = req.params.id;
    const [project] = await db.select().from(projectsTable)
      .where(and(eq(projectsTable.id, id as any), eq(projectsTable.workspaceId, workspace.id as any)))
      .limit(1);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const cfg = await getAutopilotConfig(String(id));
    res.json(cfg || {
      projectId: id,
      enabled: false,
      frequency: "DAILY",
      scanMode: "PASSIVE",
      onDeploy: false,
      dayOfWeek: 1,
      hourUtc: 2,
      nextRunAt: null,
      lastRunAt: null,
      lastScanId: null,
    });
  } catch (err) {
    req.log.error(err, "Error loading autopilot config");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id/autopilot", requireAuth, async (req, res) => {
  try {
    const workspace = (req as any).workspace;
    const id = req.params.id;
    const [project] = await db.select().from(projectsTable)
      .where(and(eq(projectsTable.id, id as any), eq(projectsTable.workspaceId, workspace.id as any)))
      .limit(1);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const enabled = Boolean(req.body?.enabled);
    const frequency = (req.body?.frequency === "WEEKLY" ? "WEEKLY" : "DAILY") as "DAILY" | "WEEKLY";
    const scanMode = (req.body?.scanMode === "ACTIVE" ? "ACTIVE" : "PASSIVE") as "PASSIVE" | "ACTIVE";
    const onDeploy = Boolean(req.body?.onDeploy);
    const hourUtc = Number.isFinite(Number(req.body?.hourUtc)) ? Number(req.body?.hourUtc) : 2;
    const dayOfWeek = Number.isFinite(Number(req.body?.dayOfWeek)) ? Number(req.body?.dayOfWeek) : 1;

    if (!isAtLeastPlan(workspace.plan, "PRO")) {
      res.status(403).json({ error: "Continuous autopilot requires PRO plan" });
      return;
    }

    const cfg = await upsertAutopilotConfig({
      projectId: String(id),
      workspacePlan: workspace.plan,
      enabled,
      frequency,
      scanMode,
      onDeploy,
      hourUtc,
      dayOfWeek,
    });
    res.json(cfg);
  } catch (err) {
    req.log.error(err, "Error updating autopilot config");
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.post("/:id/autopilot/run-now", requireAuth, async (req, res) => {
  try {
    const workspace = (req as any).workspace;
    const id = req.params.id;
    const [project] = await db.select().from(projectsTable)
      .where(and(eq(projectsTable.id, id as any), eq(projectsTable.workspaceId, workspace.id as any)))
      .limit(1);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    if (!isAtLeastPlan(workspace.plan, "PRO")) {
      res.status(403).json({ error: "Continuous autopilot requires PRO plan" });
      return;
    }

    const result = await queueContinuousScan(String(id));
    if (!result.queued) {
      res.status(409).json({ error: result.reason || "Unable to queue scan" });
      return;
    }
    res.status(201).json({ ok: true, queued: true });
  } catch (err) {
    req.log.error(err, "Error queueing run-now continuous scan");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
