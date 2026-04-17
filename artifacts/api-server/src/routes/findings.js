import { Router } from "express";
import { db, findingsTable, projectsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
const router = Router();
router.get("/", requireAuth, async (req, res) => {
    try {
        const workspace = req.workspace;
        const { severity, status, projectId } = req.query;
        const projects = await db.select().from(projectsTable)
            .where(eq(projectsTable.workspaceId, workspace.id));
        const projectIds = projects.map(p => p.id);
        const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]));
        if (projectIds.length === 0) {
            res.json([]);
            return;
        }
        let allFindings = await db.select().from(findingsTable)
            .orderBy(desc(findingsTable.createdAt));
        allFindings = allFindings.filter(f => projectIds.includes(f.projectId));
        if (projectId)
            allFindings = allFindings.filter(f => f.projectId === projectId);
        if (severity)
            allFindings = allFindings.filter(f => f.severity === severity);
        if (status)
            allFindings = allFindings.filter(f => f.status === status);
        res.json(allFindings.map(f => ({ ...f, projectName: projectMap[f.projectId] || "Unknown" })));
    }
    catch (err) {
        req.log.error(err, "Error listing findings");
        res.status(500).json({ error: "Internal server error" });
    }
});
router.get("/:id", requireAuth, async (req, res) => {
    try {
        const workspace = req.workspace;
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
    }
    catch (err) {
        req.log.error(err, "Error getting finding");
        res.status(500).json({ error: "Internal server error" });
    }
});
router.patch("/:id", requireAuth, async (req, res) => {
    try {
        const workspace = req.workspace;
        const id = req.params.id;
        const { status } = req.body;
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
        const [updated] = (await db.update(findingsTable).set({
            status: status || finding.status,
            updatedAt: new Date(),
        }).where(eq(findingsTable.id, id)).returning());
        res.json({ ...updated, projectName: project.name });
    }
    catch (err) {
        req.log.error(err, "Error updating finding");
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/:id/generate-fix", requireAuth, async (req, res) => {
    try {
        const workspace = req.workspace;
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
                    const data = await response.json();
                    const content = data.choices?.[0]?.message?.content || "";
                    const parts = content.split("EXPLANATION:");
                    fixPatch = parts[0]?.trim() || null;
                    fixExplanation = parts[1]?.trim() || null;
                }
                catch (aiErr) {
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
        }).where(eq(findingsTable.id, id)).returning());
        res.json({ ...updated, projectName: project.name });
    }
    catch (err) {
        req.log.error(err, "Error generating fix");
        res.status(500).json({ error: "Internal server error" });
    }
});
export default router;
