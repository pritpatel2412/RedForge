import type { ScanContext, FindingInput } from "./types.js";

/**
 * Module 8: SSRF & Open Redirect Detection
 * - Open redirect probing (common redirect params)
 * - SSRF indicator detection (URL params that fetch external resources)
 * - Meta-refresh redirect analysis
 */

const REDIRECT_PARAMS = [
  'url', 'redirect', 'redirect_uri', 'next', 'return', 'returnUrl', 'return_to',
  'redir', 'destination', 'dest', 'go', 'target', 'to', 'out', 'continue',
  'forward', 'goto', 'link', 'view', 'login_redirect', 'checkout_url',
];

const SSRF_PARAMS = [
  'url', 'uri', 'link', 'src', 'source', 'href', 'path', 'file',
  'page', 'feed', 'host', 'site', 'proxy', 'fetch', 'load', 'img',
  'image', 'icon', 'avatar', 'favicon', 'download', 'preview', 'webhook',
];

const OPEN_REDIRECT_PAYLOADS = [
  { payload: 'https://evil.attacker.com',          desc: 'External domain redirect' },
  { payload: '//evil.attacker.com',                 desc: 'Protocol-relative redirect' },
  { payload: '/\\evil.attacker.com',                desc: 'Backslash-trick redirect' },
  { payload: 'https://evil.attacker.com%2f.target.com', desc: 'Encoded slash bypass' },
  { payload: '////evil.attacker.com',               desc: 'Multi-slash bypass' },
];

export async function runSSRFRedirectModule(ctx: ScanContext): Promise<FindingInput[]> {
  const findings: FindingInput[] = [];
  const { targetUrl, bodyText, reachable, scanMode, addLog, safeFetch } = ctx;

  await addLog("INFO", "[Module 8] SSRF & open redirect detection...");

  if (!reachable) {
    await addLog("WARN", "[Module 8] Target unreachable — skipping");
    return findings;
  }

  // Phase 1: Detect redirect/URL parameters in page source
  const allParams: string[] = [];
  if (bodyText) {
    // Extract from forms
    const inputPattern = /<input[^>]+name=["']([^"']+)["'][^>]*/gi;
    let inputMatch;
    while ((inputMatch = inputPattern.exec(bodyText)) !== null) {
      allParams.push(inputMatch[1].toLowerCase());
    }

    // Extract from href/action attributes
    const linkPattern = /(?:href|action|data-url)=["']([^"']*\?[^"']*)["']/gi;
    let linkMatch;
    while ((linkMatch = linkPattern.exec(bodyText)) !== null) {
      try {
        const url = new URL(linkMatch[1], targetUrl);
        url.searchParams.forEach((_, key) => allParams.push(key.toLowerCase()));
      } catch { /* ignore */ }
    }
  }

  const redirectParamsInPage = allParams.filter(p => REDIRECT_PARAMS.includes(p));
  const ssrfParamsInPage = allParams.filter(p => SSRF_PARAMS.includes(p));

  // Phase 2: Open Redirect Probing (ACTIVE mode)
  if (scanMode === "ACTIVE") {
    await addLog("INFO", "Probing for open redirect vulnerabilities...");

    const paramsToTest = [...new Set([...redirectParamsInPage, ...REDIRECT_PARAMS.slice(0, 6)])];
    const loginEndpoints = [
      targetUrl,
      `${targetUrl}/login`,
      `${targetUrl}/auth/login`,
      `${targetUrl}/auth/callback`,
      `${targetUrl}/oauth/callback`,
      `${targetUrl}/logout`,
    ];

    let redirectFound = false;
    for (const endpoint of loginEndpoints) {
      if (redirectFound) break;
      for (const param of paramsToTest.slice(0, 5)) {
        if (redirectFound) break;
        for (const { payload, desc } of OPEN_REDIRECT_PAYLOADS.slice(0, 3)) {
          const testUrl = `${endpoint}${endpoint.includes('?') ? '&' : '?'}${param}=${encodeURIComponent(payload)}`;
          const resp = await safeFetch(testUrl, {
            timeoutMs: 6000,
            redirect: 'manual' as any,
          });

          if (!resp) continue;

          const location = resp.headers.get('location') || '';
          const isRedirect = resp.status >= 300 && resp.status < 400;

          if (isRedirect && (location.includes('evil.attacker.com') || location.includes('attacker.com'))) {
            await addLog("ERROR", `⚠️  Open redirect: ${param} at ${endpoint} → ${location}`);
            findings.push({
              title: `Open redirect via "${param}" parameter (${desc})`,
              description: `The endpoint ${endpoint} redirects to an attacker-controlled domain when the "${param}" parameter is set to "${payload}". Response: HTTP ${resp.status} → Location: ${location}.\n\nThis enables phishing attacks where victims click a trusted-looking URL that redirects to a malicious site.`,
              endpoint: testUrl,
              severity: "MEDIUM",
              cvss: "6.1",
              cwe: "CWE-601",
              owasp: "A01",
              confidence: 0.95,
              evidence: `HTTP ${resp.status} Location: ${location}`,
              tags: ["open-redirect", `param:${param}`, "phishing"],
              pocCode: `# Open redirect PoC:\ncurl -v "${testUrl}" 2>&1 | grep "Location:"\n# Response: Location: ${location}\n\n# Phishing attack URL:\n# ${testUrl.replace('evil.attacker.com', 'phishing-login.attacker.com')}`,
              fixPatch: `// Validate redirect targets against allowlist:\nconst ALLOWED_REDIRECTS = ['/dashboard', '/profile', '/settings'];\nconst target = req.query.${param};\nif (!target || !ALLOWED_REDIRECTS.some(p => target.startsWith(p))) {\n  return res.redirect('/dashboard'); // default safe redirect\n}`,
              fixExplanation: "Never redirect to user-supplied URLs without validation. Maintain an allowlist of valid redirect paths. If external redirects are needed, use a warning interstitial page.",
            });
            redirectFound = true;
            break;
          }

          // Check for meta-refresh or JS redirect  
          if (resp.status === 200) {
            let body = '';
            try { body = await resp.text(); } catch { body = ''; }
            const metaRefresh = body.match(/content=["']?\d+;\s*url=([^"'\s>]+)/i);
            if (metaRefresh && metaRefresh[1].includes('attacker.com')) {
              await addLog("ERROR", `⚠️  Meta-refresh redirect via ${param}`);
              findings.push({
                title: `Open redirect via meta-refresh in "${param}" parameter`,
                description: `The page at ${endpoint} uses a meta-refresh tag to redirect to an attacker-controlled URL when "${param}" is manipulated.`,
                endpoint: testUrl,
                severity: "MEDIUM",
                cvss: "5.4",
                cwe: "CWE-601",
                owasp: "A01",
                confidence: 0.85,
                tags: ["open-redirect", "meta-refresh", `param:${param}`],
                fixExplanation: "Validate all redirect targets server-side. Avoid meta-refresh with user-controlled URLs.",
              });
              redirectFound = true;
              break;
            }
          }
        }
      }
    }
  }

  // Phase 3: SSRF indicator detection
  if (ssrfParamsInPage.length > 0) {
    await addLog("WARN", `Potential SSRF parameters found: ${ssrfParamsInPage.join(', ')}`);
    findings.push({
      title: `Potential SSRF vectors: URL-accepting parameters detected (${ssrfParamsInPage.join(', ')})`,
      description: `The application accepts URL or file path parameters: ${ssrfParamsInPage.join(', ')}. If these values are used server-side to fetch resources, an attacker can:\n- Read internal network services (http://127.0.0.1, http://169.254.169.254 — AWS metadata)\n- Port-scan internal infrastructure\n- Access cloud provider metadata endpoints to steal credentials`,
      endpoint: targetUrl,
      severity: "MEDIUM",
      cvss: "6.5",
      cwe: "CWE-918",
      owasp: "A10",
      confidence: 0.5,
      tags: ["ssrf", "indicator", ...ssrfParamsInPage.map(p => `param:${p}`)],
      pocCode: `# SSRF probe — try internal addresses:\ncurl "${targetUrl}?${ssrfParamsInPage[0]}=http://127.0.0.1:80"\ncurl "${targetUrl}?${ssrfParamsInPage[0]}=http://169.254.169.254/latest/meta-data/"\ncurl "${targetUrl}?${ssrfParamsInPage[0]}=file:///etc/passwd"`,
      fixPatch: `// SSRF prevention:\nconst { URL } = require('url');\nfunction validateUrl(input) {\n  const url = new URL(input);\n  // Block internal IPs\n  const blocked = ['127.0.0.1', 'localhost', '169.254.169.254', '0.0.0.0'];\n  if (blocked.includes(url.hostname)) throw new Error('Blocked');\n  // Only allow HTTPS\n  if (url.protocol !== 'https:') throw new Error('HTTPS only');\n  return url.toString();\n}`,
      fixExplanation: "Validate and sanitize all URL inputs. Block requests to internal IP ranges (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16). Use allowlists for permitted domains. Disable HTTP redirects in server-side fetches.",
    });
  }

  // Phase 4: Check for dangerous meta-refresh redirects in page
  if (bodyText) {
    const metaRefreshPattern = /<meta[^>]+http-equiv=["']refresh["'][^>]*content=["']\d+;\s*url=([^"']+)["']/gi;
    let metaMatch;
    while ((metaMatch = metaRefreshPattern.exec(bodyText)) !== null) {
      const redirectTarget = metaMatch[1];
      try {
        const redirectUrl = new URL(redirectTarget, targetUrl);
        if (redirectUrl.hostname !== ctx.hostname) {
          findings.push({
            title: `Meta-refresh redirect to external domain: ${redirectUrl.hostname}`,
            description: `The page at ${targetUrl} contains a meta-refresh tag that redirects users to ${redirectTarget}. Cross-domain meta-refresh can be exploited for phishing if the redirect target is attacker-controlled.`,
            endpoint: targetUrl,
            severity: "LOW",
            cvss: "3.7",
            cwe: "CWE-601",
            owasp: "A01",
            confidence: 0.6,
            tags: ["open-redirect", "meta-refresh", "external"],
            fixExplanation: "Avoid meta-refresh redirects. Use server-side 301/302 redirects instead with validated targets.",
          });
        }
      } catch { /* ignore */ }
    }
  }

  await addLog("DEBUG", `[Module 8] SSRF/redirect complete — ${findings.length} issue(s) found`);
  return findings;
}
