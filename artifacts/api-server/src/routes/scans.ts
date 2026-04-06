import { Router } from "express";
import { db, scansTable, projectsTable, findingsTable, scanLogsTable } from "@workspace/db";
import { eq, desc, and, gt } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import type { Response } from "express";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const workspace = (req as any).workspace;

    const projects = await db.select().from(projectsTable)
      .where(eq(projectsTable.workspaceId, workspace.id));
    const projectIds = projects.map(p => p.id);
    const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]));

    if (projectIds.length === 0) {
      res.json([]);
      return;
    }

    const allScans = await db.select().from(scansTable)
      .orderBy(desc(scansTable.createdAt))
      .limit(50);

    const scans = allScans.filter(s => projectIds.includes(s.projectId));

    res.json(scans.map(s => ({
      ...s,
      projectName: projectMap[s.projectId] || "Unknown",
    })));
  } catch (err) {
    req.log.error(err, "Error listing scans");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const workspace = (req as any).workspace;
    const { id } = req.params;

    const [scan] = await db.select().from(scansTable).where(eq(scansTable.id, id)).limit(1);
    if (!scan) {
      res.status(404).json({ error: "Scan not found" });
      return;
    }

    const [project] = await db.select().from(projectsTable)
      .where(and(eq(projectsTable.id, scan.projectId), eq(projectsTable.workspaceId, workspace.id)))
      .limit(1);

    if (!project) {
      res.status(404).json({ error: "Scan not found" });
      return;
    }

    const findings = await db.select().from(findingsTable)
      .where(eq(findingsTable.scanId, id))
      .orderBy(desc(findingsTable.createdAt));

    const logs = await db.select().from(scanLogsTable)
      .where(eq(scanLogsTable.scanId, id))
      .orderBy(scanLogsTable.createdAt);

    res.json({
      ...scan,
      projectName: project.name,
      findings: findings.map(f => ({ ...f, projectName: project.name })),
      logs,
    });
  } catch (err) {
    req.log.error(err, "Error getting scan");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id/logs", requireAuth, async (req, res: Response) => {
  try {
    const workspace = (req as any).workspace;
    const { id } = req.params;

    const [scan] = await db.select().from(scansTable).where(eq(scansTable.id, id)).limit(1);
    if (!scan) {
      res.status(404).json({ error: "Scan not found" });
      return;
    }

    const [project] = await db.select().from(projectsTable)
      .where(and(eq(projectsTable.id, scan.projectId), eq(projectsTable.workspaceId, workspace.id)))
      .limit(1);

    if (!project) {
      res.status(404).json({ error: "Scan not found" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const flush = () => { try { (res as any).flush?.(); } catch { /* ignore */ } };

    const sentIds = new Set<string>();
    let done = false;

    const sendLogs = async () => {
      try {
        const [currentScan] = await db.select().from(scansTable).where(eq(scansTable.id, id)).limit(1);

        const logs = await db.select().from(scanLogsTable)
          .where(eq(scanLogsTable.scanId, id))
          .orderBy(scanLogsTable.createdAt);

        const newLogs = logs.filter(l => !sentIds.has(l.id));

        for (const log of newLogs) {
          sentIds.add(log.id);
          res.write(`data: ${JSON.stringify({ id: log.id, level: log.level, message: log.message, createdAt: log.createdAt })}\n\n`);
          flush();
        }

        // Always send current scan status so client can update the badge
        if (currentScan) {
          res.write(`event: status\ndata: ${JSON.stringify({ status: currentScan.status, findingsCount: currentScan.findingsCount, criticalCount: currentScan.criticalCount, riskScore: currentScan.riskScore })}\n\n`);
          flush();
        }

        if (currentScan && (currentScan.status === "COMPLETED" || currentScan.status === "FAILED")) {
          res.write(`event: done\ndata: ${JSON.stringify({ status: currentScan.status })}\n\n`);
          flush();
          done = true;
          res.end();
          return;
        }
      } catch (err) {
        try { res.end(); } catch { /* ignore */ }
      }
    };

    await sendLogs();
    if (!done) {
      const interval = setInterval(async () => {
        if (done) {
          clearInterval(interval);
          return;
        }
        await sendLogs();
        if (done) clearInterval(interval);
      }, 1000);

      req.on("close", () => {
        clearInterval(interval);
        done = true;
      });
    }
  } catch (err) {
    req.log.error(err, "Error in scan logs SSE");
    res.end();
  }
});

export default router;
