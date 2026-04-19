import { Router } from "express";
import { db, findingsTable, projectsTable, scansTable } from "@workspace/db";
import { eq, desc, and, or, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { isAtLeastPlan } from "../lib/plan.js";

const router = Router();

function inferRepoCandidates(finding: any): string[] {
  const paths: string[] = [];
  try {
    const u = new URL(String(finding.endpoint || ""));
    const segs = u.pathname.split("/").filter(Boolean);
    const tail = segs[segs.length - 1] || "index";
    const parent = segs.length > 1 ? segs[segs.length - 2] : "api";
    paths.push(
      `src/routes/${parent}.ts`,
      `src/routes/${tail}.ts`,
      `src/api/${parent}.ts`,
      `src/api/${tail}.ts`,
      `app/api/${parent}/route.ts`,
      `app/api/${tail}/route.ts`,
      `routes/${parent}.js`,
      `routes/${tail}.js`,
    );
  } catch {
    // ignore invalid URL
  }

  return [
    ...paths,
    "src/app.ts",
    "src/index.ts",
    "src/server.ts",
    "src/routes/index.ts",
    "server.js",
    "app.js",
  ];
}

async function fetchRepoContext(project: any, finding: any): Promise<{ path: string; snippet: string } | null> {
  if (!project?.githubRepo) return null;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "RedForge-FixGenerator",
  };
  if (project.githubToken) headers.Authorization = `token ${project.githubToken}`;

  const branch = project.githubBranch || "main";
  const candidates = inferRepoCandidates(finding);
  const keywords = `${finding.title} ${finding.cwe || ""} ${finding.owasp || ""}`
    .toLowerCase()
    .split(/\s+/)
    .filter((k: string) => k.length > 3);

  for (const path of candidates) {
    const url = `https://api.github.com/repos/${project.githubRepo}/contents/${path}?ref=${branch}`;
    try {
      const resp = await fetch(url, { headers, signal: AbortSignal.timeout(7000) });
      if (!resp.ok) continue;
      const data = (await resp.json()) as any;
      if (data?.type !== "file" || !data.content) continue;
      const decoded = Buffer.from(String(data.content), "base64").toString("utf8");
      const lc = decoded.toLowerCase();
      const hasSecurityRelevantCode =
        lc.includes("auth") || lc.includes("route") || lc.includes("handler") || lc.includes("api");
      const keywordMatch = keywords.length === 0 || keywords.some((k: string) => lc.includes(k));
      if (!hasSecurityRelevantCode || !keywordMatch) continue;
      return { path, snippet: decoded.slice(0, 5000) };
    } catch {
      // continue candidate scan
    }
  }
  return null;
}

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

    const [finding] = await db.select().from(findingsTable).where(eq(findingsTable.id, id as any)).limit(1);
    if (!finding) {
      res.status(404).json({ error: "Finding not found" });
      return;
    }

    const [project] = await db.select().from(projectsTable)
      .where(and(eq(projectsTable.id, finding.projectId as any), eq(projectsTable.workspaceId, workspace.id as any)))
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

    // AI fix generation is a paid feature (PRO+)
    if (!isAtLeastPlan(workspace.plan, "PRO")) {
      res.status(403).json({ error: "Upgrade to PRO to generate AI fixes" });
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
          const repoContext = await fetchRepoContext(project, finding);
          const contextBlock = repoContext
            ? `Repository context file: ${repoContext.path}\n\n${repoContext.snippet}`
            : "No repository source context available.";

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
                  content:
                    "You are an expert penetration tester and security engineer. Generate precise, production-ready security fixes with diff-ready patches and concise exploit reasoning.",
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
Project repository: ${project.githubRepo || "N/A"} (${project.githubBranch || "main"})

Source context:
${contextBlock}

Provide:
1) A unified diff patch suitable for a pull request
2) Why this exact code path is vulnerable
3) A short PoC request to demonstrate exploitability

Output format:
PATCH:
<diff>
EXPLANATION:
<text>
POC:
<curl/request>`,
                },
              ],
            }),
            signal: AbortSignal.timeout(30000),
          });
          const data = await response.json() as any;
          const content = data.choices?.[0]?.message?.content || "";
          const patchMatch = content.match(/PATCH:\s*([\s\S]*?)\nEXPLANATION:/i);
          const explMatch = content.match(/EXPLANATION:\s*([\s\S]*?)\nPOC:/i);
          const pocMatch = content.match(/POC:\s*([\s\S]*)$/i);
          fixPatch = (patchMatch?.[1] || "").trim() || null;
          const expl = (explMatch?.[1] || "").trim();
          const poc = (pocMatch?.[1] || "").trim();
          fixExplanation = [expl, poc ? `PoC:\n${poc}` : ""].filter(Boolean).join("\n\n") || null;
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


