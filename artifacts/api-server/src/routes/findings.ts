import { Router } from "express";
import { db, findingsTable, projectsTable, scansTable } from "@workspace/db";
import { eq, desc, and, or, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const workspace = (req as any).workspace;
    const { severity, status, projectId } = req.query;

    const conditions = [eq(projectsTable.workspaceId, workspace.id)];
    if (projectId) conditions.push(eq(findingsTable.projectId, projectId as string));
    if (severity)  conditions.push(eq(findingsTable.severity, severity as string));
    if (status)    conditions.push(eq(findingsTable.status, status as string));

    const results = await db.select({
      finding: findingsTable,
      projectName: projectsTable.name,
    })
    .from(findingsTable)
    .innerJoin(projectsTable, eq(findingsTable.projectId, projectsTable.id))
    .where(and(...conditions))
    .orderBy(desc(findingsTable.createdAt))
    .limit(100);

    res.json(results.map(r => ({
      ...r.finding,
      projectName: r.projectName,
    })));
  } catch (err) {
    req.log.error(err, "Error listing findings");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const workspace = (req as any).workspace;
    const id = req.params.id;

    const [finding] = await db.select().from(findingsTable).where(eq(findingsTable.id, id)).limit(1);
    if (!finding) {
      res.status(404).json({ error: "Finding not found" });
      return;
    }

    const [project] = await db.select().from(projectsTable)
      .where(and(eq(projectsTable.id, finding.projectId), eq(projectsTable.workspaceId, workspace.id)))
      .limit(1);

    if (!project) {
      res.status(404).json({ error: "Finding not found" });
      return;
    }

    res.json({ ...finding, projectName: project.name });
  } catch (err) {
    req.log.error(err, "Error getting finding");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const workspace = (req as any).workspace;
    const id = req.params.id as string;
    const { status } = req.body;

    const [finding] = await db.select().from(findingsTable).where(eq(findingsTable.id as any, id)).limit(1);
    if (!finding) {
      res.status(404).json({ error: "Finding not found" });
      return;
    }

    const [project] = await db.select().from(projectsTable)
      .where(and(eq(projectsTable.id as any, finding.projectId), eq(projectsTable.workspaceId as any, workspace.id)))
      .limit(1);

    if (!project) {
      res.status(404).json({ error: "Finding not found" });
      return;
    }

    const [updated] = (await db.update(findingsTable).set({
      status: status || finding.status,
      updatedAt: new Date(),
    }).where(eq(findingsTable.id as any, id)).returning()) as any;

    res.json({ ...updated, projectName: project.name });
  } catch (err) {
    req.log.error(err, "Error updating finding");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/generate-fix", requireAuth, async (req, res) => {
  try {
    const workspace = (req as any).workspace;
    const id = req.params.id as string;

    const [finding] = await db.select().from(findingsTable).where(eq(findingsTable.id as any, id)).limit(1);
    if (!finding) {
      res.status(404).json({ error: "Finding not found" });
      return;
    }

    const [project] = await db.select().from(projectsTable)
      .where(and(eq(projectsTable.id as any, finding.projectId), eq(projectsTable.workspaceId as any, workspace.id)))
      .limit(1);

    if (!project) {
      res.status(404).json({ error: "Finding not found" });
      return;
    }

    // Generate a fix using NVIDIA NIM if API key is available, otherwise use a template
    let fixPatch = finding.fixPatch;
    let fixExplanation = finding.fixExplanation;

    if (!fixPatch) {
      const nimKey = process.env.NVIDIA_NIM_API_KEY;
      const nimModel = process.env.NVIDIA_MODEL || "meta/llama-3.1-70b-instruct";
      if (nimKey) {
        try {
          const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${nimKey}`,
            },
            body: JSON.stringify({
              model: nimModel,
              max_tokens: 1024,
              messages: [
                {
                  role: "system",
                  content: "You are an expert penetration tester and security engineer. Generate precise, production-ready security fixes.",
                },
                {
                  role: "user",
                  content: `Generate a concise code fix for this security vulnerability:
Title: ${finding.title}
Description: ${finding.description}
Endpoint: ${finding.endpoint}
Severity: ${finding.severity}
CWE: ${finding.cwe || "N/A"}
OWASP: ${finding.owasp || "N/A"}

Provide:
1. A code patch showing the fix (before/after with comments)
2. A brief explanation of what was changed and why

Format: Start with the code patch in a code block, then write "EXPLANATION:" followed by the explanation.`,
                },
              ],
            }),
            signal: AbortSignal.timeout(30000),
          });
          const data = await response.json() as any;
          const content = data.choices?.[0]?.message?.content || "";
          const parts = content.split("EXPLANATION:");
          fixPatch = parts[0]?.trim() || null;
          fixExplanation = parts[1]?.trim() || null;
        } catch (aiErr) {
          // Fall through to default
        }
      }

      if (!fixPatch) {
        fixPatch = `// Generated fix for: ${finding.title}\n// Review and adapt this fix for your specific implementation\n\n// 1. Add proper input validation\n// 2. Implement authentication checks\n// 3. Apply principle of least privilege\n// 4. Add security headers and rate limiting`;
        fixExplanation = `This vulnerability requires immediate attention. Follow security best practices to remediate ${finding.severity} severity finding: ${finding.title}. Consult OWASP ${finding.owasp || "documentation"} for detailed guidance.`;
      }
    }

    const [updated] = (await db.update(findingsTable).set({
      fixPatch,
      fixExplanation,
      updatedAt: new Date(),
    }).where(eq(findingsTable.id as any, id)).returning()) as any;

    res.json({ ...updated, projectName: project.name });
  } catch (err) {
    req.log.error(err, "Error generating fix");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;


