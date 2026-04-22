import { Router } from "express";
import { db as dbRaw, projectsTable, scansTable, findingsTable, chatConversationsTable, chatMessagesTable } from "@workspace/db";
const db = dbRaw as any;
import { eq, desc, asc, and, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

const NIM_BASE  = "https://integrate.api.nvidia.com/v1";
const PRIMARY_MODEL = process.env.NVIDIA_MODEL || "meta/llama-3.1-70b-instruct";
const FALLBACK_MODEL = process.env.NVIDIA_FALLBACK_MODEL || "meta/llama-3.1-8b-instruct";

// ── In-memory prompt cache to reduce per-message DB overhead ─────────────────
const PROMPT_CACHE = new Map<string, { prompt: string; expires: number }>();
const PROMPT_TTL = 60 * 1000; // 60 seconds

// ── Helper: build system prompt ───────────────────────────────────────────────
async function buildSystemPrompt(workspace: any): Promise<string> {
  const projects = await db.select().from(projectsTable)
    .where(eq(projectsTable.workspaceId, workspace.id));

  const projectIds = projects.map((p: any) => p.id);
  const projectMap = Object.fromEntries(projects.map((p: any) => [p.id, p.name]));

  let allFindings: any[] = [];
  let recentScans: any[] = [];

  if (projectIds.length > 0) {
    // Optimized: Filter at database level and limit fetched rows
    const findings = await db.select()
      .from(findingsTable)
      .where(inArray(findingsTable.projectId, projectIds))
      .orderBy(desc(findingsTable.createdAt))
      .limit(200);
      
    allFindings = findings.map((f: any) => ({ 
      ...f, 
      projectName: projectMap[f.projectId] || "Unknown" 
    }));

    const scans = await db.select()
      .from(scansTable)
      .where(inArray(scansTable.projectId, projectIds))
      .orderBy(desc(scansTable.createdAt))
      .limit(20);
      
    recentScans = scans;
  }

  const criticalFindings = allFindings.filter((f: any) => f.severity === "CRITICAL");
  const highFindings     = allFindings.filter((f: any) => f.severity === "HIGH");
  const mediumFindings   = allFindings.filter((f: any) => f.severity === "MEDIUM");
  const lowFindings      = allFindings.filter((f: any) => f.severity === "LOW");
  const openFindings     = allFindings.filter((f: any) => f.status === "OPEN" || f.status === "IN_PROGRESS");
  const fixedFindings    = allFindings.filter((f: any) => f.status === "FIXED");
  const fixRate          = allFindings.length > 0 ? Math.round((fixedFindings.length / allFindings.length) * 100) : 0;

  const riskLevel = criticalFindings.length > 0 ? "🔴 CRITICAL RISK"
    : highFindings.length > 3   ? "🟠 HIGH RISK"
    : mediumFindings.length > 5 ? "🟡 MEDIUM RISK"
    : allFindings.length > 0    ? "🟢 LOW RISK"
    : "⚪ NOT ASSESSED";

  const findingsContext = allFindings.slice(0, 40).map((f: any) =>
    `• [${f.severity}] ${f.title}\n  Endpoint: ${f.endpoint}\n  CVSS: ${f.cvss || "N/A"} | OWASP: ${f.owasp || "N/A"} | CWE: ${f.cwe || "N/A"}\n  Status: ${f.status} | Project: ${f.projectName}\n  Description: ${(f.description || "").slice(0, 200)}`
  ).join("\n\n");

  const projectsContext = projects.map((p: any) =>
    `• ${p.name} → ${p.targetUrl} (${p.targetType})`
  ).join("\n");

  const scansContext = recentScans.slice(0, 5).map((s: any) =>
    `• Scan ${s.id.slice(0, 8)} | Status: ${s.status} | Findings: ${s.findingsCount || 0} (${s.criticalCount || 0} critical)`
  ).join("\n");

  const targetUrls = projects.map((p: any) => p.targetUrl).join(", ") || "Unknown Target";
  const scopes = projects.map((p: any) => p.targetType).join(", ") || "Web Application";

  return `╔══════════════════════════════════════════════════════════════════╗
║           REDFORGE ULTRA — SENIOR EXPERT SYSTEM PROMPT           ║
║         Target Intelligence: Senior Penetration Tester           ║
║              Accuracy Target: Zero False Positives               ║
╚══════════════════════════════════════════════════════════════════╝

You are RedForge Ultra — a senior cybersecurity expert, red-team lead,
and penetration tester with 15+ years of hands-on experience (expert-level,
operating at principal consultant quality). You have
deep expertise in web application security, API security, cloud
infrastructure, and secure development practices.

You do NOT behave like a dumb automated scanner. You think, reason,
and verify before every single conclusion.

Your accuracy standard: if a finding cannot be manually reproduced with
a curl command or Burp Suite Repeater, it does not get flagged as confirmed.

QUALITY BAR
- Your output quality target is top-tier frontier model quality or better:
  precise, low-noise, technically rigorous, and immediately actionable.
- Prefer fewer high-confidence findings over many weak findings.
- Never trade accuracy for verbosity. Evidence always wins.

ANTI-FABRICATION RULES (MANDATORY)
- Never invent evidence, endpoints, CVSS vectors, headers, body sizes, or snippets.
- Use only data present in LIVE TARGET CONTEXT and user-provided inputs.
- If required evidence is missing, explicitly state "Insufficient evidence" and mark
  verdict as NEEDS MANUAL or UNVERIFIED (never CONFIRMED).
- Do not output placeholder/example values as if they were observed results.
- If scan data is empty, state that no findings are available yet and provide only
  a manual validation plan, not fabricated findings.

═══════════════════════════════════════════════════════════════════
LIVE TARGET CONTEXT
═══════════════════════════════════════════════════════════════════
Platform targets: ${targetUrls}
Scope type: ${scopes}
Known stack signals: ${projectsContext || "Unknown"}
Business context: ${workspace.name} (${riskLevel}), fix rate ${fixRate}%

Live vulnerability data (${allFindings.length} findings):
${findingsContext || "No vulnerability data yet."}

Recent scan history:
${scansContext || "No scans completed yet."}

═══════════════════════════════════════════════════════════════════
SECTION 1 — CORE IDENTITY & THINKING MODEL
═══════════════════════════════════════════════════════════════════
Think in layers like a senior expert:

LAYER 1 — RECON THINKING
- React / Vue / Angular SPA: same shell for many routes is normal. Do not treat
  /admin, /dashboard, /wp-admin as exposed unless response contains real admin
  content, privileged data, or login artifacts tied to that route.
- WordPress: /wp-admin is meaningful only when response body and content match
  genuine WordPress login/admin structure.
- Next.js / Nuxt / SSR: verify whether /admin has actual protected content vs
  hydration shell.
- API-first: prioritize /api/* unauthenticated data exposure checks.
- Traditional server-rendered stacks: HTTP 200 on sensitive paths is more suspicious.

LAYER 2 — EVIDENCE THINKING
Evaluate before flagging:
- HTTP status code
- Response body size
- Content-Type
- First 300 chars of body
- Content match for real exposure
- Actual sensitive data visibility

Evidence quality:
- ★★★★★ CONFIRMED: direct sensitive data/admin access evidence
- ★★★★☆ STRONG: real structural evidence
- ★★★☆☆ PLAUSIBLE: circumstantial, manual check required
- ★★☆☆☆ WEAK: pattern-only, likely false positive
- ★☆☆☆☆ FALSE POS: scanner artifact, SPA shell, WAF block, wrong scope

LAYER 3 — EXPLOITABILITY THINKING
For every finding ask:
1) Can a working PoC be written now?
2) What attacker gain is realistic?
3) What prerequisites exist?
4) Are WAF/rate limits/controls blocking exploitation?
5) Can this be chained with other findings?

LAYER 4 — BUSINESS IMPACT THINKING
Map technical issue to business impact:
- data breach, account takeover, service disruption, reputational damage, legal risk.

═══════════════════════════════════════════════════════════════════
SECTION 2 — FALSE POSITIVE ELIMINATION ENGINE
═══════════════════════════════════════════════════════════════════
This is the top priority. Remove noise aggressively.

SPA TRAP RULE
- If homepage and sensitive routes return very similar body size/content and same
  shell markers, treat as SPA fallback, not endpoint exposure.
- In SPA architecture, route auth is often client-side/middleware-driven.
- Mark as FALSE POSITIVE unless route-specific sensitive content is present.

BYTE-SIZE FINGERPRINTING
- /.env real: typically KEY=VALUE text and usually larger response
- /.env fake: tiny HTML/WAF/generic page
- /wp-admin real: WordPress login/admin-like HTML with meaningful body size
- /wp-admin fake: SPA shell or tiny generic error page
- /config.json real: valid JSON object with meaningful keys/values
- /config.json fake: HTML page with text/html
- /graphql real: JSON GraphQL error/data shape
- /graphql fake: HTML shell/error page

WRONG SCOPE RULE
- Never map parent-domain findings to a scoped subdomain without evidence.
- Validate SPF/DMARC/CAA on the actual sending/owned domain in scope.

SEVERITY INFLATION GUARDRAILS
- Missing headers alone are LOW or INFO by default.
- High/Critical requires confirmed exploitability and strong evidence.

DOM XSS VERIFICATION
- Source+sink detection is potential risk, not auto-confirmed exploit.
- Confirm only when data flow is traceable, sanitization absent/bypassed,
  and payload reproduces.
- If not confirmed, classify as NEEDS MANUAL or MEDIUM with explicit test steps.

═══════════════════════════════════════════════════════════════════
SECTION 3 — BURP SUITE PARITY
═══════════════════════════════════════════════════════════════════
For every CONFIRMED or PLAUSIBLE High finding provide:
1) curl reproduction command
2) Burp Repeater exact steps
3) Payload suggestions where applicable
4) What real exploitation response looks like
5) Possible chaining opportunities

═══════════════════════════════════════════════════════════════════
SECTION 4 — SEVERITY CALIBRATION
═══════════════════════════════════════════════════════════════════
CRITICAL (9.0-10.0): remotely exploitable, PoC-ready, severe impact, strong proof.
HIGH (7.0-8.9): low-complexity exploitation with significant impact and strong evidence.
MEDIUM (4.0-6.9): conditional exploitability or manual validation pending.
LOW (1.0-3.9): hardening gaps and low-impact disclosures.
INFO (0): informational signals only.
FALSE POSITIVE: scanner artifact, wrong scope, WAF/generic/SPA fallback.

═══════════════════════════════════════════════════════════════════
SECTION 5 — MANDATORY OUTPUT FORMAT
═══════════════════════════════════════════════════════════════════
Use this structure exactly:
1) EXECUTIVE SUMMARY (risk score, confirmed count, false positives count, top 3 risks)
2) FINDINGS TABLE with verdict labels:
   - CONFIRMED
   - NEEDS MANUAL
   - FALSE POSITIVE
   - BEST PRACTICE
3) CRITICAL & HIGH DETAILS (for CONFIRMED or NEEDS MANUAL only)
4) FALSE POSITIVE EXPLAINER (why it fired, how to avoid)
5) PRIORITIZED FIX ROADMAP (today / this week / this month)
6) BOTTOM LINE (plain-English confidence and actions)

Required detail for each Critical/High entry:
- endpoint
- evidence quality
- CVSS + vector
- OWASP + CWE
- scanner evidence (status/body size/snippet)
- business impact
- reality check analysis
- reproduction (curl + Burp)
- expected real vs false-positive response
- remediation snippet
- effort to fix

═══════════════════════════════════════════════════════════════════
SECTION 6 — COMMUNICATION STYLE
═══════════════════════════════════════════════════════════════════
- Speak like a senior expert to a smart developer.
- Be direct; if posture is strong, say it clearly.
- Avoid vague language unless truly unverified.
- Do not exaggerate severity.
- Explain why each finding is or is not a risk.
- Treat false-positive detection as valuable security work.
- If uncertain, state exactly what evidence would resolve uncertainty.
- Each conclusion must be defensible against expert peer review.

BASELINE RULE
If homepage baseline response is available, compare each tested path against it.
If response size is within ±10% and content-type/body pattern matches homepage shell,
treat as SPA fallback and classify FALSE POSITIVE unless route-specific sensitive
content is present.
`;
}

// ══════════════════════════════════════════════════════════════════════════════
// CONVERSATION CRUD
// ══════════════════════════════════════════════════════════════════════════════

// List all conversations for the workspace
router.get("/conversations", requireAuth, async (req, res) => {
  const workspace = (req as any).workspace;
  const conversations = await db.select()
    .from(chatConversationsTable)
    .where(eq(chatConversationsTable.workspaceId as any, workspace.id))
    .orderBy(desc(chatConversationsTable.updatedAt));
  res.json(conversations);
});

// Create a new conversation
router.post("/conversations", requireAuth, async (req, res) => {
  const workspace = (req as any).workspace;
  const { title } = req.body;
  const [conv] = (await db.insert(chatConversationsTable).values({
    workspaceId: workspace.id,
    title: (title || "New conversation").slice(0, 500),
  }).returning()) as any;
  res.json(conv);
});

// Update conversation title
router.patch("/conversations/:id", requireAuth, async (req, res) => {
  const workspace = (req as any).workspace;
  const id = req.params.id as string;
  const { title } = req.body;
  if (!title) { res.status(400).json({ error: "title required" }); return; }
  await db.update(chatConversationsTable)
    .set({ title: title.slice(0, 500), updatedAt: new Date() })
    .where(and(eq(chatConversationsTable.id as any, id), eq(chatConversationsTable.workspaceId as any, workspace.id)));
  res.json({ ok: true });
});

// Delete a conversation
router.delete("/conversations/:id", requireAuth, async (req, res) => {
  const workspace = (req as any).workspace;
  const id = req.params.id as string;
  await db.delete(chatConversationsTable)
    .where(and(eq(chatConversationsTable.id as any, id), eq(chatConversationsTable.workspaceId as any, workspace.id)));
  res.json({ ok: true });
});

// Get messages for a conversation
router.get("/conversations/:id/messages", requireAuth, async (req, res) => {
  const workspace = (req as any).workspace;
  const id = req.params.id as string;
  const [conv] = await db.select().from(chatConversationsTable)
    .where(and(eq(chatConversationsTable.id as any, id), eq(chatConversationsTable.workspaceId as any, workspace.id)));
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }
  const messages = await db.select().from(chatMessagesTable)
    .where(eq(chatMessagesTable.conversationId as any, id))
    .orderBy(asc(chatMessagesTable.createdAt));
  res.json(messages);
});

// Append messages to a conversation
router.post("/conversations/:id/messages", requireAuth, async (req, res) => {
  const workspace = (req as any).workspace;
  const id = req.params.id as string;
  const { messages: msgs } = req.body;
  const [conv] = await db.select().from(chatConversationsTable)
    .where(and(eq(chatConversationsTable.id as any, id), eq(chatConversationsTable.workspaceId as any, workspace.id)));
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }
  if (Array.isArray(msgs) && msgs.length > 0) {
    await db.insert(chatMessagesTable).values(
      msgs.map((m: any) => ({
        conversationId: id,
        role: m.role,
        content: m.content,
        imagePreview: m.imagePreview || null,
        imageName: m.imageName || null,
      }))
    );
    await db.update(chatConversationsTable)
      .set({ updatedAt: new Date() })
      .where(eq(chatConversationsTable.id as any, id));
  }
  res.json({ ok: true });
});

// ── Delete last N messages from a conversation ────────────────────────────────
router.delete("/conversations/:id/messages/tail", requireAuth, async (req, res) => {
  const workspace = (req as any).workspace;
  const id = req.params.id as string;
  const count = Math.max(1, parseInt((req.query.count as string) || "1", 10));
  const [conv] = await db.select().from(chatConversationsTable)
    .where(and(eq(chatConversationsTable.id as any, id), eq(chatConversationsTable.workspaceId as any, workspace.id)));
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }

  const all = await db.select({ id: chatMessagesTable.id })
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.conversationId as any, id))
    .orderBy(asc(chatMessagesTable.createdAt));

  const toDelete = all.slice(-count).map((m: any) => m.id);
  if (toDelete.length > 0) {
    for (const mid of toDelete) {
      await db.delete(chatMessagesTable).where(eq(chatMessagesTable.id as any, mid));
    }
  }
  res.json({ ok: true, deleted: toDelete.length });
});

// ── Generate follow-up suggestions ───────────────────────────────────────────
router.post("/followups", requireAuth, async (req, res) => {
  const { lastResponse, topic } = req.body;
  const nimKey = process.env.NVIDIA_NIM_API_KEY;
  if (!nimKey) { res.json({ suggestions: [] }); return; }

  try {
    const nimResp = await fetch(`${NIM_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${nimKey}` },
      body: JSON.stringify({
        model: "meta/llama-3.1-8b-instruct", // Fast model for simple follow-up generations
        max_tokens: 200,
        stream: false,
        messages: [
          {
            role: "system",
            content: "You are a security expert assistant. Generate exactly 3 short, specific follow-up questions a security professional would ask after receiving this response. Return ONLY a JSON array of 3 strings, nothing else. Example: [\"How do I exploit this?\", \"What's the fix?\", \"Is this in OWASP Top 10?\"]",
          },
          {
            role: "user",
            content: `Context: ${topic || "security finding"}\n\nAI Response summary: ${(lastResponse || "").slice(0, 600)}\n\nGenerate 3 follow-up questions as a JSON array of strings.`,
          },
        ],
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (nimResp.ok) {
      const data = await nimResp.json() as any;
      const raw = data.choices?.[0]?.message?.content || "[]";
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) {
          res.json({ suggestions: parsed.slice(0, 3).map((s: any) => String(s)) });
          return;
        }
      }
    }
  } catch {}
  res.json({ suggestions: [] });
});

// ══════════════════════════════════════════════════════════════════════════════
// STREAMING CHAT (existing endpoint)
// ══════════════════════════════════════════════════════════════════════════════
router.post("/", requireAuth, async (req, res) => {
  const workspace = (req as any).workspace;
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array required" });
    return;
  }

  const nimKey = process.env.NVIDIA_NIM_API_KEY;
  if (!nimKey) {
    res.status(503).json({ error: "AI_KEY_MISSING" });
    return;
  }

  // Check for cached prompt first
  const cached = PROMPT_CACHE.get(workspace.id);
  let systemPrompt: string;
  if (cached && cached.expires > Date.now()) {
    systemPrompt = cached.prompt;
  } else {
    systemPrompt = await buildSystemPrompt(workspace);
    PROMPT_CACHE.set(workspace.id, { 
      prompt: systemPrompt, 
      expires: Date.now() + PROMPT_TTL 
    });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Send an immediate keep-alive ping and a small padding to flush browser buffers
  res.write(': keep-alive\n');
  res.write(': ' + ' '.repeat(1024) + '\n\n');
  if (typeof (res as any).flush === "function") (res as any).flush();

  const primaryModel = PRIMARY_MODEL;
  const fallbackModel = FALLBACK_MODEL;

  const runStream = async (model: string, isFallback: boolean = false) => {
    const isGlm = model.includes("glm-5");
    const nimResp = await fetch(`${NIM_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${nimKey}`,
      },
      body: JSON.stringify({
        model: model,
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.slice(-20).map((m: any) => ({ role: m.role, content: m.content })),
        ],
        ...(isGlm ? { "extra_body": { "reasoning": true } } : {})
      }),
      signal: AbortSignal.timeout(60000), // 60 seconds (better fit for Vercel/Replit)
    });

    if (!nimResp.ok) {
      const errText = await nimResp.text();
      throw new Error(`NVIDIA NIM error ${nimResp.status} [Model: ${model}]: ${errText.slice(0, 200)}`);
    }

    const reader = nimResp.body?.getReader();
    if (!reader) throw new Error("No stream body");

    const decoder = new TextDecoder();
    let streamBuffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        streamBuffer += decoder.decode(value, { stream: true });
        const lines = streamBuffer.split("\n");
        streamBuffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          
          const rawData = trimmed.slice(6).trim();
          if (rawData === "[DONE]") return true;

          try {
            const parsed = JSON.parse(rawData);
            const text = parsed.choices?.[0]?.delta?.content;
            if (text) {
              // To ensure "token-by-token" look, if we get a large chunk, we send it character by character
              // with a tiny delay if needed, but usually just splitting the writes is enough to trigger 
              // the stream reader on the frontend.
              for (const char of text) {
                res.write(`data: ${JSON.stringify({ text: char })}\n\n`);
                if (typeof (res as any).flush === "function") (res as any).flush();
                // Tiny break to ensure separate network packets for the "token-by-token" feel
                await new Promise(resolve => setTimeout(resolve, 1));
              }
            }
            if (parsed.choices?.[0]?.finish_reason === "stop") return true;
          } catch (e) {
            // Ignore parse errors for partial chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
    return true;
  };

  try {
    const success = await runStream(primaryModel);
    if (success) {
      res.write(`event: done\ndata: {}\n\n`);
      res.end();
    }
  } catch (err) {
    if (primaryModel !== fallbackModel) {
      console.error("[Chat Stream] Primary model failed:", err);
      try {
        // Notify client we are switching to fallback
        res.write(`data: ${JSON.stringify({ text: "\n\n*(Primary model too slow or unavailable, switching to secondary...)*\n\n" })}\n\n`);
        await runStream(fallbackModel, true);
        res.write(`event: done\ndata: {}\n\n`);
        res.end();
      } catch (fallbackErr) {
        console.error("[Chat Stream] Fallback model also failed:", fallbackErr);
        const errorMsg = fallbackErr instanceof Error ? fallbackErr.message : "All AI models are currently unavailable.";
        res.write(`event: error\ndata: ${JSON.stringify({ message: errorMsg })}\n\n`);
        res.end();
      }
    } else {
      console.error("[Chat Stream] Model failed:", err);
      const errorMsg = err instanceof Error ? err.message : "AI model failed to respond.";
      res.write(`event: error\ndata: ${JSON.stringify({ message: errorMsg })}\n\n`);
      res.end();
    }
  }
});

export default router;


