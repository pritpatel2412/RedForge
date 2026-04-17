import { Router } from "express";
import { EventEmitter } from "events";
import { db, scansTable as scansTableRaw, findingsTable as findingsTableRaw, projectsTable as projectsTableRaw, attackGraphsTable as attackGraphsTableRaw } from "@workspace/db";
const scansTable = scansTableRaw;
const findingsTable = findingsTableRaw;
const projectsTable = projectsTableRaw;
const attackGraphsTable = attackGraphsTableRaw;
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
const router = Router();
const NIM_BASE = "https://integrate.api.nvidia.com/v1";
const NIM_MODEL = process.env.NVIDIA_MODEL || "meta/llama-3.1-70b-instruct";
const STALE_MS = 5 * 60 * 1000; // 5 minutes
// ── In-process event bus: scanId → emitter ────────────────────────────────────
const emitters = new Map();
function getEmitter(scanId) {
    if (!emitters.has(scanId))
        emitters.set(scanId, new EventEmitter());
    return emitters.get(scanId);
}
// ── Helpers ───────────────────────────────────────────────────────────────────
async function resolveAccess(req, scanId) {
    const workspace = req.workspace;
    const [scan] = await db.select().from(scansTable).where(eq(scansTable.id, scanId));
    if (!scan)
        return null;
    const [project] = await db.select().from(projectsTable)
        .where(and(eq(projectsTable.id, scan.projectId), eq(projectsTable.workspaceId, workspace.id)));
    if (!project)
        return null;
    return { scan, project };
}
function isStale(record) {
    if (!record || record.status !== "GENERATING")
        return false;
    return Date.now() - new Date(record.updatedAt).getTime() > STALE_MS;
}
// ── GET /api/attack-graph/:scanId ─────────────────────────────────────────────
router.get("/:scanId", requireAuth, async (req, res) => {
    const scanId = req.params.scanId;
    const access = await resolveAccess(req, scanId);
    if (!access) {
        res.status(404).json({ error: "Not found" });
        return;
    }
    let [graph] = await db.select().from(attackGraphsTable).where(eq(attackGraphsTable.scanId, scanId));
    // Auto-fail stale GENERATING records
    if (graph && isStale(graph)) {
        await db.update(attackGraphsTable)
            .set({ status: "FAILED", errorMessage: "Generation timed out — please retry", updatedAt: new Date() })
            .where(eq(attackGraphsTable.id, graph.id));
        graph = { ...graph, status: "FAILED", errorMessage: "Generation timed out — please retry" };
    }
    if (!graph) {
        res.json({ status: "NOT_GENERATED" });
        return;
    }
    res.json({
        ...graph,
        graph: graph.graphJson ? JSON.parse(graph.graphJson) : null,
    });
});
// ── GET /api/attack-graph/:scanId/stream (SSE — real-time progress) ───────────
router.get("/:scanId/stream", requireAuth, async (req, res) => {
    const scanId = req.params.scanId;
    const access = await resolveAccess(req, scanId);
    if (!access) {
        res.status(404).json({ error: "Not found" });
        return;
    }
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    const emit = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const emitter = getEmitter(scanId);
    let closed = false;
    const onStep = (d) => { if (!closed)
        emit("step", d); };
    const onToken = (d) => { if (!closed)
        emit("token", d); };
    const onDone = (d) => { if (!closed) {
        emit("done", d);
        res.end();
    } };
    const onFail = (d) => { if (!closed) {
        emit("fail", d);
        res.end();
    } };
    emitter.on("step", onStep);
    emitter.on("token", onToken);
    emitter.on("done", onDone);
    emitter.on("fail", onFail);
    req.on("close", () => {
        closed = true;
        emitter.off("step", onStep);
        emitter.off("token", onToken);
        emitter.off("done", onDone);
        emitter.off("fail", onFail);
    });
});
// ── POST /api/attack-graph/:scanId/reset ──────────────────────────────────────
router.post("/:scanId/reset", requireAuth, async (req, res) => {
    const scanId = req.params.scanId;
    const access = await resolveAccess(req, scanId);
    if (!access) {
        res.status(404).json({ error: "Not found" });
        return;
    }
    await db.delete(attackGraphsTable).where(eq(attackGraphsTable.scanId, scanId));
    res.json({ status: "NOT_GENERATED" });
});
// ── POST /api/attack-graph/:scanId/generate ───────────────────────────────────
router.post("/:scanId/generate", requireAuth, async (req, res) => {
    const scanId = req.params.scanId;
    const nimKey = process.env.NVIDIA_NIM_API_KEY;
    if (!nimKey) {
        res.status(503).json({ error: "AI key not configured" });
        return;
    }
    const access = await resolveAccess(req, scanId);
    if (!access) {
        res.status(404).json({ error: "Not found" });
        return;
    }
    const { scan, project } = access;
    if (scan.status !== "COMPLETED") {
        res.status(400).json({ error: "Scan must be completed first" });
        return;
    }
    const [existing] = await db.select().from(attackGraphsTable).where(eq(attackGraphsTable.scanId, scanId));
    if (existing?.status === "GENERATING" && !isStale(existing)) {
        res.json({ status: "GENERATING", message: "Already running" });
        return;
    }
    // Upsert record
    let graphId;
    if (existing) {
        await db.update(attackGraphsTable)
            .set({ status: "GENERATING", errorMessage: null, graphJson: null, updatedAt: new Date() })
            .where(eq(attackGraphsTable.scanId, scanId));
        graphId = existing.id;
    }
    else {
        const [rec] = (await db.insert(attackGraphsTable).values({ scanId, status: "GENERATING" }).returning());
        graphId = rec.id;
    }
    res.json({ status: "GENERATING", id: graphId });
    // ── Background generation with SSE events ──────────────────────────────────
    const emitter = getEmitter(scanId);
    const step = (msg, num) => emitter.emit("step", { step: num, message: msg, ts: Date.now() });
    (async () => {
        try {
            step("Fetching all scan findings from database…", 1);
            const findings = await db.select().from(findingsTable).where(eq(findingsTable.scanId, scanId));
            step(`Analyzing ${findings.length} findings across ${new Set(findings.map(f => f.endpoint)).size} endpoints…`, 2);
            const findingsText = findings.map((f, i) => `Finding #${i + 1} [ID: ${f.id}]
  Title: ${f.title}
  Severity: ${f.severity}
  CVSS: ${f.cvss ?? "N/A"} | CWE: ${f.cwe ?? "N/A"} | OWASP: ${f.owasp ?? "N/A"}
  Endpoint: ${f.endpoint}
  Description: ${f.description}
  Proof of Concept: ${f.pocCode ?? "N/A"}`).join("\n\n---\n\n");
            const systemPrompt = `You are FORGE-1, an elite offensive security AI operating at the level of a senior red-team engineer from Google Project Zero or the NSA TAO. You model realistic, technically precise multi-stage attack paths — NOT generic scanner output.

Your task: analyze the provided findings and produce a structured attack graph showing EXACTLY HOW an attacker would chain these vulnerabilities from initial recon to maximum impact.

═══ CHAIN QUALITY STANDARDS ═══

**AUTOMATED vs SOCIAL-ENGINEERING CHAINS:**
- For EVERY chain, ask: "Does this require tricking a human victim (phishing, clickjacking, social engineering)?"
- If YES → Mark it "requiresVictim": true. Also generate a parallel fully-automated version that needs NO victim interaction.
- IMPORTANT: Fully-automated chains (credential stuffing, brute-force, direct exploitation, API abuse) must be rated CRITICAL or higher than their social-engineering equivalents. An attacker running a script beats one waiting for a victim to click.
- Rate automated chains with at least +1.0 risk score bonus over social-engineering variants.

**DEEP PoC REQUIREMENTS — NEVER DO THESE:**
- ❌ NEVER write a PoC that is just: curl <url> or grep 'sensitive data'
- ❌ NEVER leave a step's payload as a generic description or placeholder
- ❌ NEVER set findingId to null when a step directly exploits a specific finding — use the exact UUID provided

**DEEP PoC REQUIREMENTS — ALWAYS DO THESE:**
- ✅ Every PoC must DEMONSTRATE the actual exploitability, not just check if an endpoint exists
- ✅ Show what the attacker specifically sends/receives at each step
- ✅ Clickjacking PoC: show the actual iframe HTML the attacker hosts, what the victim sees, and what credential is stolen
- ✅ Brute-force PoC: show the actual tool command (hydra/ffuf/burp) with realistic parameters
- ✅ Info disclosure PoC: show the specific header/response field the attacker reads and what it reveals
- ✅ Injection PoC: show the specific payload string and what the vulnerable query looks like
- ✅ CORS PoC: show the fetch() JavaScript executed from the attacker's domain

**CHAIN COMPLETENESS RULES:**
- Every chain step must have a non-placeholder payload specific to the target URL and technology
- If you don't know the exact endpoint from the findings, use /admin, /wp-admin, /api/v1/users etc. based on the technology stack disclosed in the findings
- Each step must explain WHAT THE ATTACKER GAINS — not just what they do
- Technology stack disclosed by version headers (e.g. nginx/1.18.0, WordPress 6.x) MUST be used in targeted attack steps

**CHAIN PRIORITIZATION:**
1. HIGHEST PRIORITY: Fully-automated chains (no victim required) — brute-force, credential stuffing, direct exploit, mass scanning, API enumeration
2. HIGH PRIORITY: Hybrid chains (opportunistic + social engineering)
3. LOWER PRIORITY: Pure social-engineering chains (victim must be on attacker site simultaneously)

**SELF-REVIEW BEFORE OUTPUT:**
Before generating the final JSON, mentally check each chain step:
1. Is the payload specific and technically meaningful? If no → rewrite it
2. Is findingId populated from the actual finding UUID? If not and the step exploits a specific finding → use the UUID
3. Is this chain fully automated OR clearly labeled as requiring a victim? → label it
4. Does the PoC show actual exploit execution, not just an existence check? → if not, rewrite

Return ONLY a valid JSON object with this EXACT structure (no text before or after, no markdown fences):

{
  "summary": "2-3 sentence executive summary of the overall attack surface and chained risk. Lead with the most dangerous fully-automated path.",
  "chainedRiskLevel": "CRITICAL|HIGH|MEDIUM|LOW",
  "chainedRiskScore": 7.5,
  "attackSurface": "What an attacker sees from outside: technologies, exposed paths, authentication surface",
  "chains": [
    {
      "id": "c1",
      "title": "Automated: Version Disclosure → Targeted Exploit → Admin Compromise",
      "risk": "CRITICAL",
      "riskScore": 9.1,
      "requiresVictim": false,
      "automationLevel": "FULLY_AUTOMATED",
      "mitreIds": ["T1595.002", "T1110.001", "T1078"],
      "description": "Narrative: step-by-step attacker progression from recon to impact. Reference the specific technology/version discovered.",
      "steps": [
        {
          "stepNumber": 1,
          "title": "Recon: Extract server version from disclosure header",
          "findingId": "exact-uuid-from-findings-list",
          "endpoint": "/",
          "technique": "T1595.002 Active Scanning: Vulnerability Scanning",
          "action": "Read Server/X-Powered-By header to identify exact software version",
          "payload": "Server: nginx/1.18.0 — attacker notes CVE-2021-23017 (DNS resolver RCE) or searches ExploitDB for this version",
          "poc": "curl -sI https://target.com | grep -E 'Server:|X-Powered-By:' | awk '{print $2}' # Returns: nginx/1.18.0\n# Attacker then runs: searchsploit nginx 1.18",
          "impact": "Attacker knows exact server version enabling targeted CVE lookup and exploit selection"
        }
      ]
    }
  ],
  "nodes": [
    {"id": "attacker", "type": "attacker", "label": "External Attacker", "description": "Unauthenticated threat actor running automated tooling"},
    {"id": "n-SHORTID", "type": "vulnerability", "label": "Short vuln label", "endpoint": "/actual/path", "severity": "HIGH", "findingId": "exact-uuid", "technique": "T1234"},
    {"id": "target-LABEL", "type": "target", "label": "Target asset", "description": "What is compromised: e.g. Admin Panel RCE, All User Credentials, Full Database Dump"}
  ],
  "edges": [
    {"id": "e1", "source": "attacker", "target": "n-SHORTID", "label": "Version disclosure enables targeted exploit", "chainId": "c1"}
  ]
}

NODE RULES:
- Always include exactly one "attacker" node with id="attacker"
- Include a node for EACH relevant finding (use exact finding UUIDs)
- Include 1-3 "target" nodes for what gets compromised at the end (be specific about the asset)
- All IDs must be unique and short (no spaces, no special chars except hyphens)
- ALL edge source/target values MUST exactly match existing node IDs

CHAIN RULES:
- Create 2-4 chains ordered by risk score descending (highest first)
- Chain 1 must be the most dangerous fully-automated path
- Each chain shows attacker progression from INITIAL ACCESS → PERSISTENCE → IMPACT
- If technology stack is disclosed (WordPress, Nginx version, PHP, etc.) — generate a targeted chain for that specific tech`;
            const userPrompt = `TARGET: ${project.targetUrl}
TECH STACK HINT: ${project.targetType}
SCAN SUMMARY: ${scan.criticalCount} critical, ${scan.highCount} high, ${scan.mediumCount} medium, ${scan.lowCount} low findings

FINDINGS (use the exact Finding ID UUIDs in your chain steps — never make up or omit IDs):
${findingsText}

CRITICAL REQUIREMENT: Before writing the JSON, complete this mental checklist for each chain step:
1. Does this step have a real, specific payload (not a generic grep or curl ping)? → If no, write a realistic one
2. Does findingId reference one of the exact UUIDs above? → If this step exploits a specific finding, use the UUID
3. Does the PoC show actual execution output or attacker action, not just an existence check? → if no, rewrite it
4. Is this chain automated or does it require a victim? → set requiresVictim and automationLevel accordingly
5. Are fully-automated chains rated HIGHER than social-engineering chains? → adjust riskScore accordingly

Now generate the complete attack graph JSON with deep, technically accurate detail:`;
            step("Connecting to NVIDIA NIM (llama-3.1-70b)…", 3);
            const primaryModel = NIM_MODEL;
            const fallbackModel = "meta/llama-3.1-70b-instruct";
            const runGeneration = async (model) => {
                const isGlm = model.includes("glm-5");
                const nimResp = await fetch(`${NIM_BASE}/chat/completions`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${nimKey}`,
                    },
                    body: JSON.stringify({
                        model: model,
                        max_tokens: 6000,
                        stream: true,
                        temperature: 0.15,
                        top_p: 0.9,
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: userPrompt },
                        ],
                        ...(isGlm ? { "extra_body": { "reasoning": true } } : {})
                    }),
                    signal: AbortSignal.timeout(120_000),
                });
                if (!nimResp.ok) {
                    const errText = await nimResp.text();
                    throw new Error(`NIM API error ${nimResp.status}: ${errText.slice(0, 300)}`);
                }
                step(`NVIDIA NIM (${model}) is generating attack paths…`, 4);
                // Stream tokens
                const reader = nimResp.body.getReader();
                const decoder = new TextDecoder();
                let fullContent = "";
                let buffer = "";
                while (true) {
                    const { done, value } = await reader.read();
                    if (done)
                        break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || "";
                    for (const line of lines) {
                        if (!line.startsWith("data: "))
                            continue;
                        const data = line.slice(6).trim();
                        if (data === "[DONE]")
                            break;
                        try {
                            const parsed = JSON.parse(data);
                            const token = parsed.choices?.[0]?.delta?.content || "";
                            if (token) {
                                fullContent += token;
                                emitter.emit("token", { token });
                            }
                        }
                        catch { }
                    }
                }
                step("Parsing and validating attack graph…", 5);
                // Extract JSON
                const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
                if (!jsonMatch)
                    throw new Error("NIM did not return valid JSON");
                const parsed = JSON.parse(jsonMatch[0]);
                // Validate
                if (!parsed.chains || !Array.isArray(parsed.chains))
                    throw new Error("Missing chains array");
                if (!parsed.nodes || !Array.isArray(parsed.nodes))
                    throw new Error("Missing nodes array");
                if (!parsed.edges || !Array.isArray(parsed.edges))
                    throw new Error("Missing edges array");
                // Ensure attacker node
                if (!parsed.nodes.find((n) => n.id === "attacker")) {
                    parsed.nodes.unshift({ id: "attacker", type: "attacker", label: "External Attacker", description: "Unauthenticated threat actor" });
                }
                // Validate edge references
                const nodeIds = new Set(parsed.nodes.map((n) => n.id));
                parsed.edges = parsed.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
                const riskLevel = parsed.chainedRiskLevel || "HIGH";
                const riskScore = typeof parsed.chainedRiskScore === "number" ? parsed.chainedRiskScore : 7.0;
                await db.update(attackGraphsTable)
                    .set({
                    status: "COMPLETE",
                    graphJson: JSON.stringify(parsed),
                    chainedRiskLevel: riskLevel,
                    chainedRiskScore: riskScore,
                    updatedAt: new Date(),
                })
                    .where(eq(attackGraphsTable.id, graphId));
                emitter.emit("done", {
                    status: "COMPLETE",
                    chainedRiskLevel: riskLevel,
                    chainedRiskScore: riskScore,
                    graph: parsed,
                });
            };
            try {
                await runGeneration(primaryModel);
            }
            catch (err) {
                if (primaryModel !== fallbackModel) {
                    step("Primary model failed, attempting fallback to Llama-3.1...", 4);
                    await runGeneration(fallbackModel);
                }
                else {
                    throw err;
                }
            }
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await db.update(attackGraphsTable)
                .set({ status: "FAILED", errorMessage: msg, updatedAt: new Date() })
                .where(eq(attackGraphsTable.id, graphId));
            emitter.emit("fail", { error: msg });
        }
        finally {
            setTimeout(() => emitters.delete(scanId), 30_000);
        }
    })();
});
export default router;
