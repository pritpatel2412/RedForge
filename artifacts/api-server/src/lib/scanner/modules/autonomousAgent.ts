import type { FindingInput, ScanContext } from "./types.js";

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function candidateAdminPaths(bodyText: string, targetUrl: string): string[] {
  const found = new Set<string>();
  const re = /\/(?:admin|dashboard|manage|console|internal|backoffice)[a-z0-9\-/_]*/gi;
  let m: RegExpExecArray | null = null;

  while ((m = re.exec(bodyText)) !== null) {
    const p = m[0];
    if (p.length > 1 && p.length < 80) found.add(p);
  }

  // Always include common auth-sensitive routes.
  ["/admin", "/admin/login", "/dashboard", "/console", "/manage"].forEach((p) =>
    found.add(p),
  );

  return [...found]
    .slice(0, 12)
    .map((p) => `${targetUrl.replace(/\/+$/, "")}${p.startsWith("/") ? p : `/${p}`}`);
}

export async function runAutonomousPentestAgent(
  ctx: ScanContext,
  existingFindings: FindingInput[],
): Promise<FindingInput[]> {
  const findings: FindingInput[] = [];
  const { addLog, safeFetch, bodyText, targetUrl, reachable } = ctx;

  if (!reachable) return findings;

  await addLog(
    "INFO",
    "Phase AGENT — Autonomous probe planner started (adaptive follow-up checks)...",
  );

  const hasAuthRisk = existingFindings.some((f) =>
    (f.tags || []).some((t) => t.includes("auth") || t.includes("rate-limit")),
  );
  const hasInfoDisclosure = existingFindings.some((f) =>
    (f.tags || []).some((t) => t.includes("info") || t.includes("disclosure")),
  );

  const probeTargets = candidateAdminPaths(bodyText, targetUrl);
  await addLog(
    "INFO",
    `AGENT decision: selected ${probeTargets.length} high-value routes for auth-bypass checks`,
  );

  for (const endpoint of probeTargets.slice(0, hasInfoDisclosure ? 10 : 6)) {
    const baseResp = await safeFetch(endpoint, { timeoutMs: 4500, redirect: "manual" });
    if (!baseResp) continue;

    const code = baseResp.status;
    const wwwAuth = (baseResp.headers.get("www-authenticate") || "").toLowerCase();
    const location = (baseResp.headers.get("location") || "").toLowerCase();
    const text = ((await baseResp.text().catch(() => "")) || "").toLowerCase();

    const looksProtected =
      code === 401 ||
      code === 403 ||
      location.includes("login") ||
      wwwAuth.includes("basic") ||
      text.includes("sign in") ||
      text.includes("log in");

    if (!looksProtected && code < 400) {
      findings.push({
        title: "Sensitive admin surface appears accessible without auth challenge",
        description: `Autonomous probe reached ${endpoint} with HTTP ${code} and did not detect an authentication challenge/redirect. This may expose privileged pages or metadata.`,
        endpoint,
        severity: hasAuthRisk ? "HIGH" : "MEDIUM",
        cvss: hasAuthRisk ? "8.2" : "6.5",
        cwe: "CWE-285",
        owasp: "A01",
        tags: ["ai-agent", "authz", "admin-surface", "autonomous-probe"],
        fixExplanation:
          "Enforce server-side authorization checks for all admin routes and APIs. Do not rely on client-side route guards.",
      });
    }

    // Adaptive decision: only run header-bypass tests on routes that looked protected.
    if (!looksProtected) continue;
    const bypassHeadersList: Array<Record<string, string>> = [
      { "X-Original-URL": "/admin" },
      { "X-Rewrite-URL": "/admin" },
      { "X-Forwarded-For": "127.0.0.1" },
    ];

    for (const h of bypassHeadersList) {
      const bypassResp = await safeFetch(endpoint, { headers: h, timeoutMs: 4500, redirect: "manual" });
      if (!bypassResp) continue;
      const bypassCode = bypassResp.status;
      if ((code === 401 || code === 403) && bypassCode >= 200 && bypassCode < 400) {
        findings.push({
          title: "Potential auth bypass via trusted proxy/header confusion",
          description: `Autonomous agent observed a status change on ${endpoint}: baseline ${code}, with crafted headers ${JSON.stringify(h)} returned ${bypassCode}. This can indicate upstream trust boundary misconfiguration.`,
          endpoint,
          severity: "HIGH",
          cvss: "8.6",
          cwe: "CWE-441",
          owasp: "A01",
          tags: ["ai-agent", "auth-bypass", "header-confusion", "autonomous-probe"],
          pocCode: `curl -i "${endpoint}" -H "${Object.keys(h)[0]}: ${Object.values(h)[0]}"`,
          fixExplanation:
            "Ignore spoofable forwarding headers from untrusted clients. Enforce auth checks at the application layer after path normalization.",
        });
        break;
      }
    }
  }

  const dedupKey = new Set<string>();
  const deduped = findings.filter((f) => {
    const key = `${f.title}::${f.endpoint}`;
    if (dedupKey.has(key)) return false;
    dedupKey.add(key);
    return true;
  });

  await addLog(
    "INFO",
    `✓ AGENT phase complete — ${deduped.length} adaptive finding(s) from autonomous probes`,
  );
  return uniq(deduped);
}

