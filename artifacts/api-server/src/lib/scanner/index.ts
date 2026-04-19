import { db, scansTable, findingsTable, scanLogsTable, projectsTable, workspacesTable, workspaceMembersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { sendScanComplete, sendCriticalFinding } from "../notifications/slack.js";
import { createNotification } from "../notifications/create.js";
import type { ScanMode, FindingInput, ScanContext } from "./modules/types.js";
import { isAtLeastPlan } from "../plan.js";

// ── Module imports ────────────────────────────────────────────────────────────
import { runHeadersModule }        from "./modules/headers.js";
import { runInfoDisclosureModule } from "./modules/infoDisclosure.js";
import { runAuthSecurityModule }   from "./modules/authSecurity.js";
import { runBusinessLogicModule }  from "./modules/businessLogic.js";
import { runTLSCookiesModule }     from "./modules/tlsCookies.js";
import { runSupplyChainModule }    from "./modules/supplyChain.js";
import { runXSSDetectionModule }   from "./modules/xssDetection.js";
import { runSSRFRedirectModule }   from "./modules/ssrfRedirect.js";
import { runDNSSecurityModule }    from "./modules/dnsSecurity.js";
import { runAPISecurityModule }    from "./modules/apiSecurity.js";
import { runWordPressModule }      from "./modules/wordpressScanner.js";
import { runGitHubSASTModule }      from "./modules/github.js";
import { runAutonomousPentestAgent } from "./modules/autonomousAgent.js";
import { correlateFindings, computeRiskScore } from "./modules/correlationEngine.js";
import { enrichWithRemediation }  from "./modules/remediationEngine.js";
import { enrichWithCompliance }   from "./modules/complianceMapping.js";
import { enrichCVEs, attachCvesToFinding } from "./modules/cveEnrichment.js";
import { computeScanDiff }        from "./modules/scanDiff.js";

// ── Constants ─────────────────────────────────────────────────────────────────
const APP_URL = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : process.env.APP_URL || "http://localhost:3000";

const SCANNER_UA = "RedForge-Scanner/3.1 (+https://redforge.io)";
const ENGINE_VERSION = "3.1";

// ── Utilities ─────────────────────────────────────────────────────────────────
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function addLog(scanId: string, level: string, message: string) {
  await db.insert(scanLogsTable).values({ scanId, level, message });
  await sleep(150 + Math.random() * 150);
}

async function safeFetch(
  url: string,
  opts: RequestInit & { timeoutMs?: number } = {}
): Promise<Response | null> {
  try {
    const { timeoutMs = 8000, ...fetchOpts } = opts;
    return await fetch(url, {
      ...fetchOpts,
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": SCANNER_UA, ...(fetchOpts.headers || {}) },
    });
  } catch {
    return null;
  }
}

/**
 * Technology fingerprinting - runs upfront so all modules can benefit
 */
function detectTechnologies(bodyText: string, headers: Record<string, string>): string[] {
  const techs: string[] = [];
  const all = (bodyText.slice(0, 50000) + Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\n')).toLowerCase();

  const signatures: [string, RegExp][] = [
    ['Next.js',     /__next_data__|_next\//i],
    ['React',       /react(?:\.development|\.production|\.min)?\.js|__react/i],
    ['Vue.js',      /vue(?:\.runtime|\.min)?\.js|__vue__|vue-router/i],
    ['Angular',     /angular(?:\.min)?\.js|ng-version|ng-app/i],
    ['WordPress',   /wp-content\/|wp-includes\//i],
    ['Django',      /csrfmiddlewaretoken|django/i],
    ['Laravel',     /laravel|livewire/i],
    ['Rails',       /x-runtime.*ruby|rails/i],
    ['Express.js',  /x-powered-by.*express/i],
    ['GraphQL',     /graphql|graph_ql/i],
    ['Stripe',      /stripe\.(com|js)|pk_live_|pk_test_/i],
    ['Cloudflare',  /cf-ray|cloudflare/i],
    ['AWS',         /amazonaws\.com|x-amz-|cloudfront/i],
    ['Vercel',      /x-vercel-id|vercel\.app/i],
    ['Supabase',    /supabase\.co/i],
    ['Firebase',    /firebase\.googleapis\.com/i],
    ['Spring Boot', /actuator|x-application-context/i],
  ];

  for (const [name, pattern] of signatures) {
    if (pattern.test(all)) techs.push(name);
  }
  return techs;
}

/**
 * Deduplicate findings by title+CWE, merging endpoints
 */
function deduplicateFindings(findings: FindingInput[]): FindingInput[] {
  const dedupMap = new Map<string, FindingInput & { _endpoints: string[] }>();
  for (const f of findings) {
    const key = `${f.title.slice(0, 80)}::${f.cwe || ''}`;
    if (dedupMap.has(key)) {
      const existing = dedupMap.get(key)!;
      if (!existing._endpoints.includes(f.endpoint)) {
        existing._endpoints.push(f.endpoint);
      }
    } else {
      dedupMap.set(key, { ...f, _endpoints: [f.endpoint] });
    }
  }

  return [...dedupMap.values()].map(({ _endpoints, ...f }) => {
    if (_endpoints.length > 1) {
      f.description += `\n\n**Affected endpoints (${_endpoints.length}):**\n${_endpoints.map(e => `• ${e}`).join('\n')}`;
    }
    return f;
  });
}

/**
 * Run a module safely — catches & logs module crashes without aborting the scan
 */
async function runModuleSafe(
  name: string,
  scanId: string,
  fn: () => Promise<FindingInput[]>
): Promise<FindingInput[]> {
  try {
    return await fn();
  } catch (err) {
    await db.insert(scanLogsTable).values({
      scanId,
      level: "ERROR",
      message: `Module ${name} crashed: ${err instanceof Error ? err.message : String(err)}`,
    }).catch(() => {});
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────
export async function runRealScan(
  scanId: string,
  rawTargetUrl: string,
  scanMode: ScanMode = "PASSIVE"
): Promise<void> {
  // Clean URL
  let targetUrl = rawTargetUrl.trim().replace(/\/+$/, "");
  targetUrl = targetUrl.replace(/^(https?:\/\/)(https?:\/\/)/, "$1");

  // Safety check: Don't run multiple scans for the same project concurrently
  const currentScan = await db.select().from(scansTable).where(eq(scansTable.id, scanId)).limit(1).then(r => r[0]) as any;
  if (!currentScan) return;

  const currentProject = await db.select().from(projectsTable).where(eq(projectsTable.id, currentScan.projectId)).limit(1).then(r => r[0]) as any;
  if (!currentProject) return;

  const [workspace] = await db.select().from(workspacesTable)
    .where(eq(workspacesTable.id as any, currentProject.workspaceId))
    .limit(1) as any;
  const workspacePlan = (workspace?.plan || "FREE") as any;

  const activeScan = await db.select().from(scansTable)
    .where(and(eq(scansTable.projectId, currentScan.projectId), eq(scansTable.status, "RUNNING")))
    .limit(1)
    .then((r: any[]) => r[0]);

  if (activeScan && activeScan.id !== scanId) {
    await db.update(scansTable)
      .set({ status: "FAILED", completedAt: new Date() })
      .where(eq(scansTable.id, scanId));
    await addLog(scanId, "ERROR", "Scan aborted: Another scan is already running for this project.");
    return;
  }

  await sleep(300);
  await db.update(scansTable)
    .set({ status: "RUNNING", startedAt: new Date() })
    .where(eq(scansTable.id, scanId));

  const findings: FindingInput[] = [];
  const addLogLocal = (level: string, msg: string) => addLog(scanId, level, msg);

  try {
    // ── Banner ─────────────────────────────────────────────────────────────
    await addLog(scanId, "INFO", `╔══════════════════════════════════════════════════════════╗`);
    await addLog(scanId, "INFO", `║  RedForge Security Engine v${ENGINE_VERSION}                        ║`);
    await addLog(scanId, "INFO", `║  Target: ${targetUrl.slice(0, 47).padEnd(47)} ║`);
    await addLog(scanId, "INFO", `║  Mode:   ${scanMode.padEnd(47)} ║`);
    await addLog(scanId, "INFO", `║  Modules: 10 active | Correlation engine: ON              ║`);
    await addLog(scanId, "INFO", `╚══════════════════════════════════════════════════════════╝`);

    // ── Phase 1: Initial Fingerprinting ────────────────────────────────────
    await addLog(scanId, "INFO", "Phase 1 — Target fingerprinting & initial HTTP probe...");

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
      await addLog(scanId, "INFO", `✓ Target reachable — HTTP ${httpStatus} (${bodyText.length} bytes, ${resHeaders["content-type"] || "unknown"})`);
    } else {
      await addLog(scanId, "WARN", `Target ${targetUrl} did not respond — passive/DNS analysis only`);
    }

    // Extract hostname
    let hostname = "";
    try { hostname = new URL(targetUrl).hostname; } catch { hostname = targetUrl; }

    // Technology fingerprinting
    const technologies = detectTechnologies(bodyText, resHeaders);
    if (technologies.length > 0) {
      await addLog(scanId, "INFO", `Detected: ${technologies.join(', ')}`);
    }

    // Check plain HTTP → HTTPS
    if (!targetUrl.startsWith("https://")) {
      const finalUrl = homeResp?.url || targetUrl;
      if (!finalUrl.startsWith("https://")) {
        findings.push({
          title: "Unencrypted HTTP transport in use",
          description: `The target ${targetUrl} uses plain HTTP with no redirect to HTTPS. All data including credentials are transmitted unencrypted.`,
          endpoint: targetUrl,
          severity: "HIGH",
          cvss: "7.5",
          cwe: "CWE-319",
          owasp: "A02",
          tags: ["tls", "http"],
          pocCode: `tcpdump -i eth0 -A host ${hostname}`,
          fixExplanation: "Obtain a TLS certificate (Let's Encrypt via certbot) and redirect all HTTP to HTTPS with HSTS.",
        });
      }
    }

    // Shared scan context for all modules
    const ctx: ScanContext = {
      scanId,
      projectId: currentScan.projectId,
      projectData: currentProject,
      workspacePlan,
      targetUrl,
      hostname,
      scanMode,
      reachable,
      httpStatus,
      resHeaders,
      bodyText,
      technologies,
      addLog: addLogLocal,
      safeFetch,
    };

    // CORS probe (inline — fast, doesn't need a module)
    const corsResp = await safeFetch(targetUrl, {
      headers: { "Origin": "https://evil.attacker.com" },
      timeoutMs: 6000,
    });
    if (corsResp) {
      const acao = corsResp.headers.get("access-control-allow-origin");
      if (acao === "*") {
        findings.push({
          title: "CORS policy allows all origins (wildcard *)",
          description: `The server responds with "Access-Control-Allow-Origin: *". Any website can make requests to your API on behalf of users.`,
          endpoint: targetUrl,
          severity: "MEDIUM",
          cvss: "6.1",
          cwe: "CWE-942",
          owasp: "A05",
          tags: ["cors", "wildcard"],
          fixExplanation: "Replace wildcard CORS with an explicit origin allowlist.",
        });
      } else if (acao === "https://evil.attacker.com") {
        findings.push({
          title: "CORS reflects arbitrary origin — critical misconfiguration",
          description: "The server blindly reflects the Origin header, granting any domain full cross-origin access.",
          endpoint: targetUrl,
          severity: "CRITICAL",
          cvss: "9.1",
          cwe: "CWE-942",
          owasp: "A05",
          tags: ["cors", "reflected-origin"],
          fixExplanation: "Implement a strict origin allowlist. Never dynamically reflect the Origin header.",
        });
      }
    }

    await addLog(scanId, "INFO", "✓ Phase 1 complete — starting parallel module execution...");

    // ── Phase 2: Parallel Module Execution ─────────────────────────────────
    await addLog(scanId, "INFO", "Phase 2 — Running 10 security modules in parallel...");

    const [
      tlsFindings,
      headerFindings,
      infoFindings,
      authFindings,
      supplyFindings,
      xssFindings,
      ssrfFindings,
      dnsFindings,
      apiFindings,
      wpFindings,
      githubFindings,
    ] = await Promise.all([
      runModuleSafe("TLS/Cookies",         scanId, () => runTLSCookiesModule(ctx)),
      runModuleSafe("Headers",             scanId, () => runHeadersModule(ctx)),
      runModuleSafe("Info Disclosure",     scanId, () => runInfoDisclosureModule(ctx)),
      runModuleSafe("Auth Security",       scanId, () => runAuthSecurityModule(ctx)),
      runModuleSafe("Supply Chain",        scanId, () => runSupplyChainModule(ctx)),
      runModuleSafe("XSS Detection",       scanId, () => runXSSDetectionModule(ctx)),
      runModuleSafe("SSRF/Redirect",       scanId, () => runSSRFRedirectModule(ctx)),
      runModuleSafe("DNS Security",        scanId, () => runDNSSecurityModule(ctx)),
      runModuleSafe("API Security",        scanId, () => runAPISecurityModule(ctx)),
      runModuleSafe("WordPress",           scanId, () => runWordPressModule(ctx)),
      runModuleSafe("GitHub SAST",         scanId, () => runGitHubSASTModule(ctx)),
    ] as any);

    findings.push(...tlsFindings, ...headerFindings, ...infoFindings,
      ...authFindings, ...supplyFindings, ...xssFindings, ...ssrfFindings,
      ...dnsFindings, ...apiFindings, ...wpFindings, ...githubFindings);

    await addLog(scanId, "INFO", `✓ Parallel modules complete — ${findings.length} raw findings`);

    // ── Phase 3: Active-Only Modules ────────────────────────────────────────
    const canActive = isAtLeastPlan(workspacePlan, "PRO");
    if (scanMode === "ACTIVE" && !canActive) {
      await addLog(scanId, "WARN", "ACTIVE mode requires PRO plan — running PASSIVE modules only.");
      scanMode = "PASSIVE";
      (ctx as any).scanMode = "PASSIVE";
    }

    if (scanMode === "ACTIVE") {
      await addLog(scanId, "INFO", "Phase 3 — ACTIVE mode: SQL injection, rate limiting, business logic...");

      // SQL Injection Probe
      const sqliEndpoints = [
        `${targetUrl}/api/users?id=`,
        `${targetUrl}/api/search?q=`,
        `${targetUrl}/search?q=`,
        `${targetUrl}/?id=`,
      ];
      const sqliPayloads = ["'", "1' OR '1'='1", "1; DROP TABLE users--"];
      const sqliErrorPatterns = [
        "sql syntax", "mysql_", "postgresql", "sqlite", "ora-0",
        "syntax error", "unclosed quotation", "pg_query", "sqlexception",
        "unterminated string", "activerecord::",
      ];

      let sqliFound = false;
      outer: for (const ep of sqliEndpoints) {
        for (const payload of sqliPayloads.slice(0, 2)) {
          const r = await safeFetch(`${ep}${encodeURIComponent(payload)}`, { timeoutMs: 5000 });
          if (!r) continue;
          let body = "";
          try { body = (await r.text()).toLowerCase(); } catch { continue; }
          const match = sqliErrorPatterns.find(p => body.includes(p));
          if (match) {
            findings.push({
              title: "SQL injection — error-based disclosure confirmed",
              description: `The endpoint ${ep} returned SQL error pattern "${match}" when injected with "${payload}". This strongly indicates unsanitized input in SQL queries.`,
              endpoint: ep,
              severity: "CRITICAL",
              cvss: "9.8",
              cwe: "CWE-89",
              owasp: "A03",
              tags: ["sqli", "error-based"],
              pocCode: `curl "${ep}${payload}"\ncurl "${ep}' UNION SELECT 1,username,password FROM users--"`,
              fixExplanation: "Use parameterized queries exclusively. Never concatenate user input into SQL strings.",
            });
            sqliFound = true;
            break outer;
          }
        }
      }
      if (!sqliFound) await addLog(scanId, "DEBUG", "No SQL error patterns detected ✓");

      // Rate limiting probe
      const authEps = [`${targetUrl}/api/auth/login`, `${targetUrl}/api/login`, `${targetUrl}/login`];
      for (const ep of authEps) {
        const results = await Promise.all(
          Array.from({ length: 6 }, (_, i) =>
            safeFetch(ep, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: `probe${i}@rf-scan.io`, password: "WrongPass!1" }),
              timeoutMs: 5000,
            }).then(r => r?.status ?? 0)
          )
        );
        const nonZero = results.filter(s => s > 0);
        if (!nonZero.length || nonZero.every(s => s === 404 || s === 410)) continue;

        const hasRateLimit = results.some(s => s === 429 || s === 503);
        if (!hasRateLimit) {
          await addLog(scanId, "WARN", `No rate limiting on ${ep}`);
          findings.push({
            title: "Missing rate limiting on authentication endpoint",
            description: `${ep} accepted ${nonZero.length} rapid login requests without HTTP 429.`,
            endpoint: ep,
            severity: "MEDIUM",
            cvss: "5.9",
            cwe: "CWE-307",
            owasp: "A07",
            tags: ["rate-limit", "brute-force", "auth"],
            fixExplanation: "Add express-rate-limit with max 5 attempts per 15 minutes. Use account lockout and exponential backoff.",
          });
          break;
        }
      }

      // Business logic
      const bizFindings = await runModuleSafe("Business Logic", scanId, () => runBusinessLogicModule(ctx));
      findings.push(...bizFindings);

      await addLog(scanId, "INFO", `✓ Phase 3 complete — ${findings.length} total findings`);
    } else {
      await addLog(scanId, "INFO", "Phase 3 — Skipped (PASSIVE mode). Switch to ACTIVE for SQLi, rate limit, business logic probing.");
    }

    // ── Phase 3.5: Autonomous Pentesting Agent (adaptive loop) ─────────────
    const agentEnabled = process.env.ENABLE_AGENTIC_SCANNER !== "false" && isAtLeastPlan(workspacePlan, "PRO");
    if (agentEnabled) {
      const agentFindings = await runModuleSafe("Autonomous Agent", scanId, () =>
        runAutonomousPentestAgent(ctx, findings),
      );
      findings.push(...agentFindings);
    } else {
      await addLog(scanId, "INFO", "Phase AGENT — disabled (requires PRO or ENABLE_AGENTIC_SCANNER=false)");
    }

    // ── Phase 4: AI Deep Analysis (NVIDIA NIM) ──────────────────────────────
    const nimKey = process.env.NVIDIA_NIM_API_KEY;
    // nvidia/llama-3.1-nemotron-70b-instruct: NVIDIA's RLHF fine-tune of Llama 3.1 70B
    // Outperforms base Llama on reasoning & structured output — ideal for security analysis
    const primaryModel = process.env.NVIDIA_MODEL || "nvidia/llama-3.1-nemotron-70b-instruct";
    const fallbackModel = "meta/llama-3.1-70b-instruct";

    if (nimKey && isAtLeastPlan(workspacePlan, "PRO")) {
      const runAI = async (model: string) => {
        await addLog(scanId, "INFO", `Phase 4 — AI deep analysis (NVIDIA NIM · ${model})...`);
        const headersSummary = reachable
          ? Object.entries(resHeaders).map(([k, v]) => `${k}: ${v}`).join('\n').slice(0, 2000)
          : "(unreachable)";
        const foundSoFar = findings.map(f => f.title).join(', ').slice(0, 800);
        const techStr = technologies.join(', ') || 'unknown';

        const prompt = `You are a senior penetration tester performing black-box security assessment of ${targetUrl}.

Technology stack: ${techStr}
HTTP Status: ${httpStatus} | Mode: ${scanMode}
Response headers:\n${headersSummary}

Page source snippet:\n${bodyText.slice(0, 2000)}

Known findings so far: ${foundSoFar || 'none'}

Identify 1-3 HIGH or CRITICAL security issues NOT already listed. Focus only on issues definitively detectable from this data. For tech-specific issues, leverage the detected stack: ${techStr}.

Respond ONLY with a JSON array (no markdown):
[{"title":"...","description":"...","severity":"CRITICAL|HIGH|MEDIUM|LOW","cvss":"7.5","cwe":"CWE-XXX","owasp":"AXX","fixExplanation":"..."}]
If none, return [].`;

        const aiResp = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${nimKey}` },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: "You are a senior penetration tester. Output JSON arrays only." },
              { role: "user", content: prompt },
            ],
          }),
          signal: AbortSignal.timeout(60000),
        });

        if (!aiResp.ok) throw new Error(`AI API ${aiResp.status}`);
        const aiData = await aiResp.json() as any;
        const aiText = (aiData.choices?.[0]?.message?.content || "[]").trim();
        const jsonMatch = aiText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return;

        const aiFindings = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(aiFindings)) return;

        let added = 0;
        for (const af of aiFindings.slice(0, 4)) {
          if (af.title && ["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(af.severity)) {
            findings.push({
              title: af.title,
              description: af.description || "",
              endpoint: targetUrl,
              severity: af.severity,
              cvss: af.cvss ? String(af.cvss) : null,
              cwe: af.cwe || null,
              owasp: af.owasp || null,
              fixExplanation: af.fixExplanation || null,
              confidence: 0.7,
              tags: ["ai-generated"],
            });
            added++;
          }
        }
        await addLog(scanId, "INFO", `✓ AI analysis complete — ${added} additional finding(s)`);
      };

      try {
        await runAI(primaryModel);
      } catch {
        if (primaryModel !== fallbackModel) {
          await addLog(scanId, "WARN", "Primary AI model failed, trying fallback...");
          try { await runAI(fallbackModel); } catch { /* skip */ }
        }
      }
    }

    // ── Phase 5: Correlation Engine — Attack Chain Analysis ─────────────────
    await addLog(scanId, "INFO", "Phase 5 — Running attack chain correlation engine...");
    const chainFindings = correlateFindings(findings);

    if (chainFindings.length > 0) {
      await addLog(scanId, "INFO", `⚠️  ${chainFindings.length} multi-stage attack chain(s) detected!`);
      for (const chain of chainFindings) {
        await addLog(scanId, "ERROR", `🔗 Attack chain: ${chain.title.replace('🔗 ', '')}`);
      }
      findings.push(...chainFindings);
    } else {
      await addLog(scanId, "INFO", "✓ No multi-stage attack chains detected");
    }

    // ── Phase 6: Deduplication & Scoring ────────────────────────────────────
    await addLog(scanId, "INFO", "Phase 6 — Deduplication & risk scoring...");
    const dedupedFindings = deduplicateFindings(findings);
    const rawCount = findings.length;
    const deduped = rawCount - dedupedFindings.length;

    // Count by severity
    let criticalCount = 0, highCount = 0, mediumCount = 0, lowCount = 0, infoCount = 0;
    for (const f of dedupedFindings) {
      if (f.severity === "CRITICAL") criticalCount++;
      else if (f.severity === "HIGH") highCount++;
      else if (f.severity === "MEDIUM") mediumCount++;
      else if (f.severity === "LOW") lowCount++;
      else infoCount++;
    }

    const riskScore = computeRiskScore(dedupedFindings);
    const totalFindings = dedupedFindings.length;

    await addLog(scanId, "INFO", `╔══════════════════════════════════════════════════════════╗`);
    await addLog(scanId, "INFO", `║  SCAN COMPLETE                                           ║`);
    await addLog(scanId, "INFO", `║  Findings: ${String(totalFindings).padEnd(45)} ║`);
    await addLog(scanId, "INFO", `║  Critical: ${String(criticalCount).padEnd(45)} ║`);
    await addLog(scanId, "INFO", `║  High: ${String(highCount).padEnd(49)} ║`);
    await addLog(scanId, "INFO", `║  Risk Score: ${riskScore.toFixed(1)}/10${' '.repeat(39)} ║`);
    if (deduped > 0) {
      await addLog(scanId, "INFO", `║  Deduplicated: ${String(deduped + ' duplicates merged').padEnd(42)} ║`);
    }
    await addLog(scanId, "INFO", `╚══════════════════════════════════════════════════════════╝`);

    // ── Phase 6.5: Enrichment Pass ──────────────────────────────────────────
    await addLog(scanId, "INFO", "Phase 6.5 — Enrichment: remediation code · CVE lookup · compliance mapping · scan diff...");

    // Run CVE enrichment and enrichment passes in parallel
    const cveData = await enrichCVEs(bodyText, resHeaders).catch(() => []);

    // Apply all enrichment passes
    let enrichedFindings = enrichWithRemediation(dedupedFindings);
    enrichedFindings = enrichWithCompliance(enrichedFindings);

    // Attach CVEs to matching findings
    enrichedFindings = enrichedFindings.map(f => ({
      ...f,
      cves: attachCvesToFinding(f.title, f.evidence, cveData),
    }));

    // Count enriched findings
    const remCount  = enrichedFindings.filter(f => f.remediationCode?.length).length;
    const cveCount  = enrichedFindings.filter(f => f.cves?.length).length;
    const compCount = enrichedFindings.filter(f => f.compliance).length;
    await addLog(scanId, "INFO", `✓ Enrichment complete: ${remCount} with fix code · ${cveCount} with CVEs · ${compCount} with compliance mapping`);

    // Scan diff (compare to previous scan)
    const scan = await db.select().from(scansTable).where(eq(scansTable.id, scanId)).limit(1).then(r => r[0]);
    let scanDiff = null;
    if (scan) {
      const severityMap: Record<string, string> = {};
      enrichedFindings.forEach(f => { severityMap[f.title] = f.severity; });
      scanDiff = await computeScanDiff(
        scanId,
        scan.projectId,
        enrichedFindings.map(f => f.title),
        severityMap
      ).catch(() => null);
      if (scanDiff) {
        await addLog(scanId, "INFO",
          `Scan diff: ${scanDiff.newFindings.length} new · ${scanDiff.resolvedFindings.length} resolved · fix rate ${scanDiff.fixRate}%`);
      }
    }

    // ── Persist Findings ─────────────────────────────────────────────────────
    if (!currentScan) return;

    const insertedFindings: any[] = [];
    for (const f of enrichedFindings) {
      const remCode = f.remediationCode ? JSON.stringify(f.remediationCode) : null;
      const compliance = f.compliance   ? JSON.stringify(f.compliance)       : null;
      const cves       = f.cves?.length ? JSON.stringify(f.cves)             : null;

      const [ins] = await db.insert(findingsTable).values({
        scanId,
        projectId: scan.projectId,
        title: f.title,
        description: f.description,
        endpoint: f.endpoint,
        severity: f.severity === "INFO" ? "LOW" : f.severity,
        status: "OPEN",
        cvss: f.cvss || null,
        cwe: f.cwe || null,
        owasp: f.owasp || null,
        pocCode: f.pocCode || null,
        fixPatch: f.fixPatch || (remCode ? `See remediationCode field` : null),
        fixExplanation: f.fixExplanation || null,
      }).returning();
      insertedFindings.push(ins);
    }

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

    // ── Slack Notifications ──────────────────────────────────────────────────
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, scan.projectId)).limit(1);
    if (project) {
      const [workspace] = await db.select().from(workspacesTable).where(eq(workspacesTable.id, project.workspaceId)).limit(1);

      // ── In-app notifications for all workspace members ──────────────────────
      const members = await db.select().from(workspaceMembersTable)
        .where(eq(workspaceMembersTable.workspaceId as any, project.workspaceId));

      for (const member of members) {
        // Overall scan complete notification
        const emoji = criticalCount > 0 ? "🚨" : highCount > 0 ? "⚠️" : "✅";
        const type  = criticalCount > 0 ? "error" : highCount > 0 ? "warning" : "success";
        createNotification({
          userId:      member.userId,
          workspaceId: project.workspaceId,
          type,
          title:       `${emoji} Scan complete — ${project.name}`,
          body:        `Found ${totalFindings} issue${totalFindings !== 1 ? "s" : ""} (${criticalCount} critical, ${highCount} high). Risk score: ${riskScore.toFixed(1)}/10`,
          link:        `/scans/${scanId}`,
        }).catch(() => {});

        // Per-critical finding urgent notification
        const criticalFindings = insertedFindings.filter(f => f.severity === "CRITICAL");
        for (const cf of criticalFindings.slice(0, 3)) {
          createNotification({
            userId:      member.userId,
            workspaceId: project.workspaceId,
            type:        "error",
            title:       `🔴 Critical: ${cf.title.slice(0, 80)}`,
            body:        `Detected on ${project.name}. ${cf.description?.slice(0, 120) || ""}`,
            link:        `/findings?scan=${scanId}`,
          }).catch(() => {});
        }
      }

      // Slack resolution: Project webhook takes precedence over Workspace webhook
      const webhookUrl = project.slackWebhookUrl || workspace?.slackWebhookUrl;

      if (webhookUrl) {
        const criticals = insertedFindings.filter(f => f.severity === "CRITICAL");
        for (const f of criticals) {
          await sendCriticalFinding(f, project.name, APP_URL, webhookUrl).catch(() => {});
        }
        await sendScanComplete(
          { id: scanId, findingsCount: totalFindings, criticalCount, highCount },
          project.name, APP_URL, webhookUrl
        ).catch(() => {});
      }
    }

  } catch (err) {
    await db.update(scansTable).set({ status: "FAILED", completedAt: new Date() })
      .where(eq(scansTable.id, scanId)).catch(() => {});
    await db.insert(scanLogsTable).values({
      scanId,
      level: "ERROR",
      message: `Scan failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    }).catch(() => {});

    // Notify workspace members of failure
    try {
      const [scan] = await db.select().from(scansTable).where(eq(scansTable.id, scanId)).limit(1);
      if (scan) {
        const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, scan.projectId)).limit(1);
        if (project) {
          const members = await db.select().from(workspaceMembersTable)
            .where(eq(workspaceMembersTable.workspaceId as any, project.workspaceId));
          for (const member of members) {
            createNotification({
              userId:      member.userId,
              workspaceId: project.workspaceId,
              type:        "error",
              title:       `❌ Scan failed — ${project.name}`,
              body:        `The scan could not complete. ${err instanceof Error ? err.message.slice(0, 100) : "Unknown error"}`,
              link:        `/scans/${scanId}`,
            }).catch(() => {});
          }
        }
      }
    } catch { /* ignore — failure notification is best-effort */ }
  }
}
