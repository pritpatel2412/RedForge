import { db, scansTable, findingsTable, scanLogsTable, projectsTable, workspacesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendScanComplete, sendCriticalFinding } from "../notifications/slack.js";
import type { ScanMode, FindingInput } from "./modules/types.js";
import { runHeadersModule } from "./modules/headers.js";
import { runInfoDisclosureModule } from "./modules/infoDisclosure.js";
import { runAuthSecurityModule } from "./modules/authSecurity.js";
import { runBusinessLogicModule } from "./modules/businessLogic.js";
import { runTLSCookiesModule } from "./modules/tlsCookies.js";
import { runSupplyChainModule } from "./modules/supplyChain.js";

const APP_URL = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : process.env.APP_URL || "http://localhost:3000";

const SCANNER_UA = "RedForge-Scanner/2.1 Security-Assessment (+https://redforge.io)";

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function safeFetch(url: string, opts: RequestInit & { timeoutMs?: number } = {}): Promise<Response | null> {
  try {
    const { timeoutMs = 8000, ...fetchOpts } = opts;
    const res = await fetch(url, {
      ...fetchOpts,
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": SCANNER_UA, ...(fetchOpts.headers || {}) },
    });
    return res;
  } catch {
    return null;
  }
}

async function addLog(scanId: string, level: string, message: string) {
  await db.insert(scanLogsTable).values({ scanId, level, message });
  await sleep(200 + Math.random() * 300);
}

export async function runRealScan(scanId: string, rawTargetUrl: string, scanMode: ScanMode = "PASSIVE"): Promise<void> {
  let targetUrl = rawTargetUrl.trim().replace(/\/+$/, "");
  targetUrl = targetUrl.replace(/^(https?:\/\/)(https?:\/\/)/, "$1");

  await sleep(400);
  await db.update(scansTable)
    .set({ status: "RUNNING", startedAt: new Date() })
    .where(eq(scansTable.id, scanId));

  const findings: FindingInput[] = [];

  try {
    await addLog(scanId, "INFO", `╔══════════════════════════════════════════════════════╗`);
    await addLog(scanId, "INFO", `║  RedForge Security Assessment Engine v2.1            ║`);
    await addLog(scanId, "INFO", `║  Target: ${targetUrl.slice(0, 42).padEnd(42)} ║`);
    await addLog(scanId, "INFO", `║  Mode:   ${scanMode.padEnd(42)} ║`);
    await addLog(scanId, "INFO", `╚══════════════════════════════════════════════════════╝`);

    // ── Phase 1: Target Verification ────────────────────────────────────────
    await addLog(scanId, "INFO", "Phase 1/8 — Target verification & initial fingerprinting...");

    let homeResp: Response | null = null;
    let resHeaders: Record<string, string> = {};
    let reachable = false;
    let httpStatus = 0;
    let bodyText = "";

    homeResp = await safeFetch(targetUrl, { redirect: "follow", timeoutMs: 12000 });

    if (homeResp) {
      reachable = true;
      httpStatus = homeResp.status;
      resHeaders = Object.fromEntries(homeResp.headers.entries());
      try { bodyText = await homeResp.text(); } catch { bodyText = ""; }
      await addLog(scanId, "INFO", `✓ Target reachable — HTTP ${httpStatus} (${bodyText.length} bytes, ${resHeaders["content-type"] || "unknown content-type"})`);
      if (resHeaders["server"]) {
        await addLog(scanId, "DEBUG", `Server: ${resHeaders["server"]} | Content-Length: ${resHeaders["content-length"] || "unknown"}`);
      }
    } else {
      await addLog(scanId, "WARN", `Target ${targetUrl} did not respond — running passive analysis only`);
    }

    const scanCtx = {
      scanId,
      targetUrl,
      scanMode,
      reachable,
      httpStatus,
      resHeaders,
      bodyText,
      addLog: (level: string, message: string) => addLog(scanId, level, message),
    };

    // ── Phase 2: SSL/TLS basic check ────────────────────────────────────────
    await addLog(scanId, "INFO", "Phase 2/8 — SSL/TLS & cookie security...");
    const tlsFindings = await runTLSCookiesModule(scanCtx);
    findings.push(...tlsFindings);
    await addLog(scanId, "INFO", `✓ Phase 2 complete — ${tlsFindings.length} TLS/cookie issue(s)`);

    if (!targetUrl.startsWith("https://")) {
      // homeResp was fetched with redirect: "follow", so homeResp.url is the final URL
      const finalUrl = homeResp?.url || targetUrl;
      if (finalUrl.startsWith("https://")) {
        await addLog(scanId, "DEBUG", `HTTP URL redirects to HTTPS (${finalUrl}) — redirect in place ✓`);
      } else {
        await addLog(scanId, "ERROR", "⚠️  Plain HTTP in use — data transmitted unencrypted (no HTTPS redirect detected)");
        findings.push({
          title: "Unencrypted HTTP transport in use",
          description: `The target ${targetUrl} uses plain HTTP and does not redirect to HTTPS. Session tokens, passwords, and sensitive data are visible to any network observer or man-in-the-middle attacker.`,
          endpoint: targetUrl,
          severity: "HIGH",
          cvss: "7.5",
          cwe: "CWE-319",
          owasp: "A02",
          pocCode: `# Intercept unencrypted traffic:\nmitmproxy --mode transparent --listen-port 8080\n\n# Or capture with tcpdump:\ntcpdump -i eth0 -A host ${new URL(targetUrl).hostname}`,
          fixPatch: `# Nginx — force HTTPS redirect:\nserver {\n    listen 80;\n    server_name yourdomain.com;\n    return 301 https://$host$request_uri;\n}`,
          fixExplanation: "Obtain a TLS certificate (Let's Encrypt via certbot) and redirect all HTTP to HTTPS. Add HSTS to prevent downgrade attacks.",
        });
      }
    }

    // ── Phase 3: Security Headers (Module 1) ────────────────────────────────
    await addLog(scanId, "INFO", "Phase 3/8 — Enhanced security headers analysis (13 headers)...");
    const headerFindings = await runHeadersModule(scanCtx);
    findings.push(...headerFindings);
    await addLog(scanId, "INFO", `✓ Phase 3 complete — ${headerFindings.length} header issue(s)`);

    // ── Phase 4: CORS Misconfiguration ──────────────────────────────────────
    await addLog(scanId, "INFO", "Phase 4/8 — CORS policy analysis...");
    const corsResp = await safeFetch(targetUrl, {
      headers: { "Origin": "https://evil.attacker.com" },
      timeoutMs: 7000,
    });

    if (corsResp) {
      const acao = corsResp.headers.get("access-control-allow-origin");
      const acac = corsResp.headers.get("access-control-allow-credentials");

      if (acao === "*") {
        await addLog(scanId, "ERROR", "⚠️  CORS wildcard origin: Access-Control-Allow-Origin: *");
        findings.push({
          title: "CORS policy allows all origins (wildcard *)",
          description: `The server responds with "Access-Control-Allow-Origin: *" for cross-origin requests. Any website can make requests to your API on behalf of your users.`,
          endpoint: targetUrl,
          severity: "MEDIUM",
          cvss: "6.1",
          cwe: "CWE-942",
          owasp: "A05",
          pocCode: `curl -H "Origin: https://evil.attacker.com" -I ${targetUrl}\n# Look for: Access-Control-Allow-Origin: *`,
          fixPatch: `const ALLOWED_ORIGINS = ['https://yourdomain.com'];\napp.use((req, res, next) => {\n  const origin = req.headers.origin;\n  if (ALLOWED_ORIGINS.includes(origin)) {\n    res.setHeader('Access-Control-Allow-Origin', origin);\n  }\n  next();\n});`,
          fixExplanation: "Replace the wildcard CORS origin with an explicit allowlist. Never combine Access-Control-Allow-Origin: * with Access-Control-Allow-Credentials: true.",
        });
      } else if (acao === "https://evil.attacker.com") {
        await addLog(scanId, "ERROR", "⚠️  CORS reflects arbitrary origin — critical misconfiguration");
        findings.push({
          title: "CORS reflects arbitrary request origin (critical)",
          description: `The server blindly reflects the Origin header, granting any domain cross-origin access. Combined with credentials, this enables full CSRF and cross-origin data theft.`,
          endpoint: targetUrl,
          severity: "CRITICAL",
          cvss: "9.1",
          cwe: "CWE-942",
          owasp: "A05",
          pocCode: `curl -H "Origin: https://evil.attacker.com" -I ${targetUrl}\n# Response: Access-Control-Allow-Origin: https://evil.attacker.com`,
          fixExplanation: "Implement a strict origin allowlist. Never dynamically reflect the Origin header. Validate origins server-side against a predefined list.",
        });
      } else {
        await addLog(scanId, "DEBUG", `CORS policy: ${acao || "not set"} — no wildcard detected ✓`);
      }
    }
    await addLog(scanId, "INFO", "✓ Phase 4 complete — CORS analysis done");

    // ── Phase 5: Information Disclosure (Module 2) ───────────────────────────
    await addLog(scanId, "INFO", "Phase 5/8 — Information disclosure scanner (tech stack, JS bundles, paths)...");
    const infoFindings = await runInfoDisclosureModule(scanCtx);
    findings.push(...infoFindings);
    await addLog(scanId, "INFO", `✓ Phase 5 complete — ${infoFindings.length} disclosure issue(s)`);

    // ── Phase 6: Auth Security (Module 3) — PASSIVE-safe ────────────────────
    await addLog(scanId, "INFO", "Phase 6/8 — Authentication security scanner...");
    const authFindings = await runAuthSecurityModule(scanCtx);
    findings.push(...authFindings);
    await addLog(scanId, "INFO", `✓ Phase 6 complete — ${authFindings.length} auth issue(s)`);

    // ── Phase 7: Active-only phases (SQL, rate limit, admin panel, business logic)
    if (scanMode === "ACTIVE") {
      await addLog(scanId, "INFO", "Phase 7/8 — ACTIVE mode: SQL injection, rate limiting, admin panel probing...");

      // SQL Injection Probe
      const sqliProbeEndpoints = [
        `${targetUrl}/api/users?id=`,
        `${targetUrl}/api/search?q=`,
        `${targetUrl}/search?q=`,
        `${targetUrl}/api/products?id=`,
        `${targetUrl}/?id=`,
      ];
      const sqliPayloads = ["'", "1'", "' OR '1'='1"];
      const sqliErrorPatterns = [
        "sql syntax", "mysql_", "postgresql", "sqlite", "ora-0", "odbc driver",
        "jdbc", "syntax error", "unclosed quotation", "unterminated string",
        "pg_query()", "pg::error", "activerecord::", "sqlexception",
      ];

      let sqliFound = false;
      for (const ep of sqliProbeEndpoints) {
        if (sqliFound) break;
        for (const payload of sqliPayloads.slice(0, 2)) {
          const r = await safeFetch(`${ep}${encodeURIComponent(payload)}`, { timeoutMs: 5000 });
          if (!r) continue;
          let body = "";
          try { body = (await r.text()).toLowerCase(); } catch { continue; }
          const match = sqliErrorPatterns.find(p => body.includes(p));
          if (match) {
            await addLog(scanId, "ERROR", `⚠️  SQL error pattern detected at ${ep}`);
            findings.push({
              title: "SQL error messages exposed — potential SQL injection",
              description: `The endpoint ${ep} returned a SQL error ("${match}") when injected with payload: "${payload}". This strongly indicates unsanitized user input is being concatenated into SQL queries.`,
              endpoint: ep,
              severity: "CRITICAL",
              cvss: "9.8",
              cwe: "CWE-89",
              owasp: "A03",
              pocCode: `curl "${ep}${payload}"\n# Union-based:\ncurl "${ep}' UNION SELECT 1,username,password FROM users--"`,
              fixPatch: `// ✅ Parameterized query:\nconst result = await db.query('SELECT * FROM users WHERE id = $1', [req.query.id]);`,
              fixExplanation: "Always use parameterized queries or an ORM. Never concatenate user input into SQL strings.",
            });
            sqliFound = true;
            break;
          }
        }
      }
      if (!sqliFound) await addLog(scanId, "DEBUG", "No SQL error patterns detected ✓");

      // Rate limiting on auth endpoints
      const authEndpoints = [
        `${targetUrl}/api/auth/login`,
        `${targetUrl}/api/login`,
        `${targetUrl}/login`,
      ];

      for (const ep of authEndpoints) {
        const results = await Promise.all(
          Array.from({ length: 6 }, (_, i) =>
            safeFetch(ep, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: `probe${i}@redforge-scan.io`, password: "WrongPass!" }),
              timeoutMs: 5000,
            }).then(r => r?.status ?? 0)
          )
        );
        const nonZero = results.filter(s => s > 0);
        if (nonZero.length === 0) continue;
        const endpointExists = nonZero.some(s => s !== 404 && s !== 410);
        if (!endpointExists) continue;

        const hasRateLimit = results.some(s => s === 429 || s === 503);
        if (!hasRateLimit) {
          await addLog(scanId, "WARN", `No rate limiting on ${ep} — ${nonZero.length} rapid requests accepted`);
          findings.push({
            title: "Missing rate limiting on authentication endpoint",
            description: `${ep} accepted ${nonZero.length} rapid login attempts without HTTP 429. Automated credential stuffing can run unchallenged.`,
            endpoint: ep,
            severity: "MEDIUM",
            cvss: "5.9",
            cwe: "CWE-307",
            owasp: "A07",
            fixPatch: `import rateLimit from 'express-rate-limit';\nconst authLimiter = rateLimit({ windowMs: 15*60*1000, max: 5 });\nrouter.post('/auth/login', authLimiter, loginHandler);`,
            fixExplanation: "Implement rate limiting with express-rate-limit. Use exponential backoff and account lockout after repeated failures.",
          });
          break;
        } else {
          await addLog(scanId, "DEBUG", `Rate limiting active on ${ep} (HTTP 429 received) ✓`);
          break;
        }
      }

      // Business logic (Module 4)
      await addLog(scanId, "INFO", "Running business logic vulnerability detection...");
      const bizFindings = await runBusinessLogicModule(scanCtx);
      findings.push(...bizFindings);
      await addLog(scanId, "DEBUG", `Business logic: ${bizFindings.length} issue(s) found`);

      await addLog(scanId, "INFO", `✓ Phase 7 complete — ${findings.length} total findings so far`);
    } else {
      await addLog(scanId, "INFO", "Phase 7/8 — Skipped (PASSIVE mode): SQL injection, rate limiting, admin probing");
      await addLog(scanId, "DEBUG", "Switch to ACTIVE mode to enable intrusive probing modules");
    }

    // ── Phase 8: Dependency & Supply Chain (Module 6) ─────────────────────
    await addLog(scanId, "INFO", "Phase 8/8 — Dependency & supply chain analysis...");
    const supplyFindings = await runSupplyChainModule(scanCtx);
    findings.push(...supplyFindings);
    await addLog(scanId, "INFO", `✓ Phase 8 complete — ${supplyFindings.length} supply chain issue(s)`);

    // ── AI-Powered Deep Analysis ──────────────────────────────────────────
    const nimKey = process.env.NVIDIA_NIM_API_KEY;
    const primaryModel = process.env.NVIDIA_MODEL || "zhipuai/glm-5-plus";
    const fallbackModel = "meta/llama-3.1-70b-instruct";

    if (nimKey) {
      const runAiAnalysis = async (model: string) => {
        await addLog(scanId, "INFO", `Running AI-powered deep analysis (NVIDIA NIM · ${model})...`);
        
        const headersSummary = reachable
          ? Object.entries(resHeaders).map(([k, v]) => `${k}: ${v}`).join("\n").slice(0, 2000)
          : "(target did not respond)";
        const bodySnippet = reachable ? bodyText.slice(0, 3000) : "";
        const foundSoFar = findings.map(f => f.title).join(", ");

        const userPrompt = `You are performing a black-box security assessment of ${targetUrl}.

HTTP Response Headers:
${headersSummary}

HTTP Status: ${httpStatus} | Scan mode: ${scanMode}
Page source snippet (first 3000 chars):
${bodySnippet}

Already identified findings: ${foundSoFar || "none yet"}

Based on the headers, status code, and page content, identify 1-3 ADDITIONAL security issues not already listed above. Focus on issues definitively detectable from this HTTP response data.

Respond ONLY with a JSON array (no markdown, no explanation outside JSON):
[
  {
    "title": "Brief finding title",
    "description": "Detailed description",
    "severity": "CRITICAL|HIGH|MEDIUM|LOW",
    "cvss": "numeric score like 7.5",
    "cwe": "CWE-XXX",
    "owasp": "AXX like A01",
    "fixExplanation": "Concrete remediation steps"
  }
]
Only include findings you are confident about. If none, return [].`;

        const aiResp = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${nimKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: "system", content: "You are a senior penetration tester. Output structured JSON arrays only — never markdown code blocks." },
              { role: "user", content: userPrompt },
            ],
          }),
          signal: AbortSignal.timeout(60000), // Increased for GLM reasoning
        });

        if (!aiResp.ok) {
          const errText = await aiResp.text();
          throw new Error(`AI API error ${aiResp.status}: ${errText.slice(0, 300)}`);
        }

        const aiData = await aiResp.json() as any;
        const aiText = (aiData.choices?.[0]?.message?.content || "[]").trim();
        const jsonMatch = aiText.match(/\[[\s\S]*\]/);
        
        if (jsonMatch) {
          const aiFindings = JSON.parse(jsonMatch[0]);
          if (Array.isArray(aiFindings) && aiFindings.length > 0) {
            let addedCount = 0;
            for (const af of aiFindings.slice(0, 4)) {
              if (af.title && af.severity && ["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(af.severity)) {
                findings.push({
                  title: af.title,
                  description: af.description || "",
                  endpoint: targetUrl,
                  severity: af.severity,
                  cvss: af.cvss ? String(af.cvss) : null,
                  cwe: af.cwe || null,
                  owasp: af.owasp || null,
                  fixExplanation: af.fixExplanation || null,
                });
                addedCount++;
              }
            }
            await addLog(scanId, "INFO", `✓ AI analysis complete — ${addedCount} additional finding(s)`);
          } else {
            await addLog(scanId, "INFO", "✓ AI analysis complete — no additional findings beyond automated checks");
          }
        }
      };

      try {
        await runAiAnalysis(primaryModel);
      } catch (err) {
        if (primaryModel !== fallbackModel) {
          await addLog(scanId, "WARN", `Primary AI model (${primaryModel}) failed, attempting fallback...`);
          try {
            await runAiAnalysis(fallbackModel);
          } catch (fallbackErr) {
            await addLog(scanId, "DEBUG", "AI analysis skipped — both primary and fallback failed");
          }
        } else {
          await addLog(scanId, "DEBUG", `AI analysis skipped — ${err instanceof Error ? err.message : "API error"}`);
        }
      }
    }

    // ── Finalize Results ────────────────────────────────────────────────────
    // 1. Deduplicate by title+CWE — merge same-issue findings across endpoints
    const dedupMap = new Map<string, FindingInput & { _endpoints: string[] }>();
    for (const finding of findings) {
      const key = `${finding.title}::${finding.cwe || ""}`;
      if (dedupMap.has(key)) {
        const existing = dedupMap.get(key)!;
        if (!existing._endpoints.includes(finding.endpoint)) {
          existing._endpoints.push(finding.endpoint);
        }
      } else {
        dedupMap.set(key, { ...finding, _endpoints: [finding.endpoint] });
      }
    }

    const dedupedFindings: FindingInput[] = [];
    for (const entry of dedupMap.values()) {
      const { _endpoints, ...finding } = entry;
      if (_endpoints.length > 1) {
        finding.description =
          finding.description +
          `\n\n**Affected Endpoints (${_endpoints.length}):**\n` +
          _endpoints.map(e => `• ${e}`).join("\n");
      }
      dedupedFindings.push(finding);
    }

    const rawCount = findings.length;
    const totalFindings = dedupedFindings.length;
    const deduped = rawCount - totalFindings;
    await addLog(scanId, "INFO", `╔══════════════════════════════════════════════════════╗`);
    await addLog(scanId, "INFO", `║  SCAN COMPLETE                                       ║`);
    await addLog(scanId, "INFO", `║  Total findings: ${String(totalFindings).padEnd(34)} ║`);
    if (deduped > 0) {
      await addLog(scanId, "INFO", `║  Deduplicated: ${String(deduped + " duplicates merged").padEnd(36)} ║`);
    }
    await addLog(scanId, "INFO", `╚══════════════════════════════════════════════════════╝`);

    const scan = await db.select().from(scansTable).where(eq(scansTable.id, scanId)).limit(1).then(r => r[0]);
    if (!scan) return;

    let criticalCount = 0, highCount = 0, mediumCount = 0, lowCount = 0;
    const insertedFindings: any[] = [];

    for (const finding of dedupedFindings) {
      const sev = finding.severity || "LOW";
      if (sev === "CRITICAL") criticalCount++;
      else if (sev === "HIGH") highCount++;
      else if (sev === "MEDIUM") mediumCount++;
      else lowCount++;

      const [ins] = await db.insert(findingsTable).values({
        scanId,
        projectId: scan.projectId,
        title: finding.title,
        description: finding.description,
        endpoint: finding.endpoint,
        severity: sev,
        status: "OPEN",
        cvss: finding.cvss || null,
        cwe: finding.cwe || null,
        owasp: finding.owasp || null,
        pocCode: finding.pocCode || null,
        fixPatch: finding.fixPatch || null,
        fixExplanation: finding.fixExplanation || null,
      }).returning();

      insertedFindings.push(ins);
    }

    // 2. Risk score formula (applied after deduplication):
    //    min(10, (critical×10 + high×7 + medium×4 + low×1) / 20)
    const riskScore = Math.min(10, (criticalCount * 10 + highCount * 7 + mediumCount * 4 + lowCount * 1) / 20);

    await db.update(scansTable).set({
      status: "COMPLETED",
      completedAt: new Date(),
      findingsCount: totalFindings,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      riskScore,
    }).where(eq(scansTable.id, scanId));

    await addLog(scanId, "INFO", `Scan complete. ${totalFindings} finding(s): ${criticalCount} critical, ${highCount} high, ${mediumCount} medium, ${lowCount} low | Risk score: ${riskScore.toFixed(1)}/10`);

    // Slack notifications
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, scan.projectId)).limit(1);
    if (project) {
      const [workspace] = await db.select().from(workspacesTable).where(eq(workspacesTable.id, project.workspaceId)).limit(1);
      const webhookUrl = workspace?.slackWebhookUrl;
      if (webhookUrl) {
        const criticals = insertedFindings.filter(f => f.severity === "CRITICAL");
        for (const f of criticals) {
          await sendCriticalFinding(f, project.name, APP_URL, webhookUrl).catch(() => {});
        }
        await sendScanComplete(
          { id: scanId, findingsCount: findings.length, criticalCount, highCount },
          project.name,
          APP_URL,
          webhookUrl
        ).catch(() => {});
      }
    }

  } catch (err) {
    console.error("Scan error:", err);
    await db.update(scansTable).set({
      status: "FAILED",
      completedAt: new Date(),
    }).where(eq(scansTable.id, scanId));
    await db.insert(scanLogsTable).values({
      scanId,
      level: "ERROR",
      message: `Scan failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    });
  }
}
