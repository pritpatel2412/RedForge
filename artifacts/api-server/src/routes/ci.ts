import { Router } from "express";
import { db, projectsTable, scansTable, findingsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { getWorkspaceIdFromRequest } from "../lib/apiKeyAuth.js";
import { isAtLeastPlan } from "../lib/plan.js";
import { workspacesTable } from "@workspace/db";
import { triggerOnDeployContinuousScan } from "../lib/autopilot.js";

const router = Router();

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

router.post("/evaluate", async (req, res) => {
  try {
    const workspaceId = await getWorkspaceIdFromRequest(req as any);
    if (!workspaceId) {
      res.status(401).json({ error: "Invalid or missing API key" });
      return;
    }

    const {
      projectId,
      failOn = ["CRITICAL"],
      maxScanAgeHours = 24,
      includeMarkdown = true,
    } = req.body || {};

    if (!projectId) {
      res.status(400).json({ error: "projectId is required" });
      return;
    }

    const [project] = await db.select().from(projectsTable)
      .where(and(eq(projectsTable.id as any, projectId), eq(projectsTable.workspaceId as any, workspaceId)))
      .limit(1);
    const [workspace] = await db.select().from(workspacesTable)
      .where(eq(workspacesTable.id as any, workspaceId))
      .limit(1) as any;
    const plan = (workspace?.plan || "FREE") as any;
    if (!isAtLeastPlan(plan, "PRO")) {
      res.status(403).json({ error: "Upgrade to PRO to use CI/CD API access" });
      return;
    }

    if (!project) {
      res.status(404).json({ error: "Project not found in API key workspace" });
      return;
    }

    const [latestCompletedScan] = await db.select().from(scansTable)
      .where(and(eq(scansTable.projectId as any, projectId), eq(scansTable.status as any, "COMPLETED")))
      .orderBy(desc(scansTable.createdAt))
      .limit(1);

    if (!latestCompletedScan) {
      res.json({
        pass: false,
        gateReason: "No completed scan available for this project",
        projectId,
        projectName: project.name,
        scanId: null,
        counts: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
      });
      return;
    }

    const scanAgeMs = Date.now() - new Date(latestCompletedScan.createdAt as any).getTime();
    const stale = scanAgeMs > Number(maxScanAgeHours) * 60 * 60 * 1000;
    const findings = await db.select().from(findingsTable)
      .where(eq(findingsTable.scanId as any, latestCompletedScan.id));

    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 } as Record<Severity, number>;
    for (const f of findings as any[]) {
      const sev = (f.severity || "LOW") as Severity;
      if (counts[sev] !== undefined) counts[sev] += 1;
    }

    const normalizedFailOn: Severity[] = Array.isArray(failOn) ? failOn : ["CRITICAL"];
    const triggered = normalizedFailOn.filter((sev) => counts[sev] > 0);
    const pass = !stale && triggered.length === 0;

    const topFindings = findings
      .filter((f: any) => normalizedFailOn.includes((f.severity || "LOW") as Severity))
      .slice(0, 20)
      .map((f: any) => ({
        id: f.id,
        title: f.title,
        severity: f.severity,
        endpoint: f.endpoint,
        cwe: f.cwe,
        owasp: f.owasp,
      }));

    const markdown = includeMarkdown
      ? [
          `## RedForge CI Security Gate`,
          ``,
          `- Project: **${project.name}**`,
          `- Scan: \`${latestCompletedScan.id}\``,
          `- Risk score: **${latestCompletedScan.riskScore ?? "N/A"}**`,
          `- Gate policy: fail on ${normalizedFailOn.join(", ")}`,
          `- Status: ${pass ? "PASS" : "FAIL"}`,
          stale ? `- Reason: latest scan is stale (> ${maxScanAgeHours}h)` : "",
          ``,
          `### Severity Counts`,
          `- Critical: ${counts.CRITICAL}`,
          `- High: ${counts.HIGH}`,
          `- Medium: ${counts.MEDIUM}`,
          `- Low: ${counts.LOW}`,
          ``,
          topFindings.length
            ? `### Blocking Findings\n${topFindings
                .map((f: any) => `- [${f.severity}] ${f.title} (${f.endpoint})`)
                .join("\n")}`
            : `### Blocking Findings\n- None`,
        ]
          .filter(Boolean)
          .join("\n")
      : null;

    res.json({
      pass,
      gateReason: stale ? "Latest completed scan is stale" : triggered.length ? `Blocking severities present: ${triggered.join(", ")}` : "No blocking findings",
      projectId: project.id,
      projectName: project.name,
      scanId: latestCompletedScan.id,
      counts,
      failOn: normalizedFailOn,
      stale,
      topFindings,
      markdown,
    });
  } catch (err) {
    (req as any).log?.error(err, "Error evaluating CI security gate");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/deploy-hook", async (req, res) => {
  try {
    const workspaceId = await getWorkspaceIdFromRequest(req as any);
    if (!workspaceId) {
      res.status(401).json({ error: "Invalid or missing API key" });
      return;
    }

    const { projectId } = req.body || {};
    if (!projectId) {
      res.status(400).json({ error: "projectId is required" });
      return;
    }

    const [project] = await db.select().from(projectsTable)
      .where(and(eq(projectsTable.id as any, projectId), eq(projectsTable.workspaceId as any, workspaceId)))
      .limit(1);
    if (!project) {
      res.status(404).json({ error: "Project not found in API key workspace" });
      return;
    }

    const [workspace] = await db.select().from(workspacesTable)
      .where(eq(workspacesTable.id as any, workspaceId))
      .limit(1) as any;
    const plan = (workspace?.plan || "FREE") as any;
    if (!isAtLeastPlan(plan, "PRO")) {
      res.status(403).json({ error: "Upgrade to PRO to use deploy-triggered continuous scans" });
      return;
    }

    const result = await triggerOnDeployContinuousScan(projectId);
    if (!result.queued) {
      res.status(202).json({ queued: false, reason: result.reason || "No scan queued" });
      return;
    }
    res.status(201).json({ queued: true });
  } catch (err) {
    (req as any).log?.error(err, "Error in deploy hook");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

