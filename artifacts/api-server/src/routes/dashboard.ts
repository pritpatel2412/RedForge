import { Router } from "express";
import { db, projectsTable, scansTable, findingsTable } from "@workspace/db";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/stats", requireAuth, async (req, res) => {
  try {
    const workspace = (req as any).workspace;

    // 1. Get projects count and map
    const projects = await db.select({
      id: projectsTable.id,
      name: projectsTable.name,
    })
    .from(projectsTable)
    .where(eq(projectsTable.workspaceId, workspace.id));

    if (projects.length === 0) {
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

    const projectIds = projects.map(p => p.id);
    const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]));

    // 2. Aggregate stats with simple WHERE IN clauses (more robust than joins)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [scansStats] = await db.select({
      total: sql<number>`count(*)`,
      thisMonth: sql<number>`count(*) FILTER (WHERE ${scansTable.createdAt} >= ${monthStart})`
    })
    .from(scansTable)
    .where(inArray(scansTable.projectId, projectIds));

    const [findingsStats] = await db.select({
      totalOpen: sql<number>`count(*) FILTER (WHERE ${findingsTable.status} IN ('OPEN', 'IN_PROGRESS'))`,
      critical: sql<number>`count(*) FILTER (WHERE ${findingsTable.status} IN ('OPEN', 'IN_PROGRESS') AND ${findingsTable.severity} = 'CRITICAL')`,
      high: sql<number>`count(*) FILTER (WHERE ${findingsTable.status} IN ('OPEN', 'IN_PROGRESS') AND ${findingsTable.severity} = 'HIGH')`,
      medium: sql<number>`count(*) FILTER (WHERE ${findingsTable.status} IN ('OPEN', 'IN_PROGRESS') AND ${findingsTable.severity} = 'MEDIUM')`,
      low: sql<number>`count(*) FILTER (WHERE ${findingsTable.status} IN ('OPEN', 'IN_PROGRESS') AND ${findingsTable.severity} = 'LOW')`,
      fixed: sql<number>`count(*) FILTER (WHERE ${findingsTable.status} = 'FIXED')`
    })
    .from(findingsTable)
    .where(inArray(findingsTable.projectId, projectIds));

    // 3. Get recent activities (joins are fine for simple row fetching)
    const recentScansData = await db.select({
      scan: scansTable,
      projectName: projectsTable.name
    })
      .from(scansTable)
      .innerJoin(projectsTable, eq(scansTable.projectId, projectsTable.id))
      .where(inArray(scansTable.projectId, projectIds))
      .orderBy(desc(scansTable.createdAt))
      .limit(10);

    const recentFindingsData = await db.select({
      finding: findingsTable,
      projectName: projectsTable.name
    })
      .from(findingsTable)
      .innerJoin(projectsTable, eq(findingsTable.projectId, projectsTable.id))
      .where(inArray(findingsTable.projectId, projectIds))
      .orderBy(desc(findingsTable.createdAt))
      .limit(10);

    res.json({
      totalProjects: projects.length,
      totalScans: Number(scansStats?.total || 0),
      openFindings: Number(findingsStats?.totalOpen || 0),
      criticalFindings: Number(findingsStats?.critical || 0),
      highFindings: Number(findingsStats?.high || 0),
      mediumFindings: Number(findingsStats?.medium || 0),
      lowFindings: Number(findingsStats?.low || 0),
      fixedFindings: Number(findingsStats?.fixed || 0),
      scansThisMonth: Number(scansStats?.thisMonth || 0),
      recentFindings: recentFindingsData.map(r => ({
        ...r.finding,
        projectName: r.projectName,
      })),
      recentScans: recentScansData.map(r => ({
        ...r.scan,
        projectName: r.projectName,
      })),
    });
  } catch (err) {
    req.log.error(err, "Error getting dashboard stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

