import type { ScanContext, FindingInput } from "./types.js";

function parseCSP(value: string): string[] {
  const issues: string[] = [];
  if (value.includes("'unsafe-inline'")) issues.push("'unsafe-inline' allows inline scripts (XSS risk)");
  if (value.includes("'unsafe-eval'")) issues.push("'unsafe-eval' allows eval() execution (XSS risk)");
  if (/\bscript-src\b[^;]*\*/.test(value) || /\bdefault-src\b[^;]*\*/.test(value)) issues.push("Wildcard (*) source allows scripts from any domain");
  if (!value.includes("default-src")) issues.push("Missing default-src directive (fallback not set)");
  if (!value.includes("frame-ancestors")) issues.push("Missing frame-ancestors directive (clickjacking risk)");
  return issues;
}

export async function runHeadersModule(ctx: ScanContext): Promise<FindingInput[]> {
  const findings: FindingInput[] = [];
  const { targetUrl, resHeaders, reachable, addLog } = ctx;

  if (!reachable) {
    await addLog("WARN", "[Module 1] Headers: target unreachable — skipping header analysis");
    return findings;
  }

  await addLog("INFO", "[Module 1] Enhanced security headers analysis (13 headers)...");

  const h = (name: string) => resHeaders[name] || resHeaders[name.toLowerCase()] || "";

  // 1. Content-Security-Policy
  const csp = h("content-security-policy");
  if (!csp) {
    await addLog("WARN", "Missing Content-Security-Policy header");
    findings.push({
      title: "Missing Content-Security-Policy (CSP) header",
      description: `No CSP header found on ${targetUrl}. Without CSP, the browser cannot restrict which scripts and resources load on the page, making cross-site scripting (XSS) attacks significantly more dangerous and effective.`,
      endpoint: targetUrl,
      severity: "MEDIUM",
      cvss: "5.4",
      cwe: "CWE-79",
      owasp: "A05",
      pocCode: `# Verify missing CSP:\ncurl -I ${targetUrl} | grep -i "content-security-policy"\n# Expected: content-security-policy: <policy>\n# Actual: (missing)`,
      fixPatch: `# Express.js:\napp.use((req, res, next) => {\n  res.setHeader('Content-Security-Policy',\n    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none';"\n  );\n  next();\n});`,
      fixExplanation: "Add a Content-Security-Policy header to all responses. Start with a report-only mode (Content-Security-Policy-Report-Only) to test your policy before enforcing it.",
    });
  } else {
    const cspIssues = parseCSP(csp);
    for (const issue of cspIssues) {
      await addLog("WARN", `CSP weakness: ${issue}`);
      findings.push({
        title: `Weak Content-Security-Policy: ${issue}`,
        description: `The CSP header is present but contains a weakness: ${issue}. Current policy: "${csp.slice(0, 200)}${csp.length > 200 ? "..." : ""}"`,
        endpoint: targetUrl,
        severity: "MEDIUM",
        cvss: "4.7",
        cwe: "CWE-79",
        owasp: "A05",
        fixExplanation: `Fix your CSP: ${issue}. Remove unsafe-inline/unsafe-eval by using nonces or hashes instead. Replace wildcards with specific trusted domains.`,
      });
    }
    if (cspIssues.length === 0) {
      await addLog("DEBUG", "CSP header present and well-configured ✓");
    }
  }

  // 2. X-Frame-Options
  const xfo = h("x-frame-options");
  if (!xfo) {
    await addLog("WARN", "Missing X-Frame-Options header");
    findings.push({
      title: "Missing X-Frame-Options header (clickjacking risk)",
      description: `No X-Frame-Options header on ${targetUrl}. Attackers can embed your page inside a transparent iframe to trick users into clicking hidden buttons (clickjacking). Modern sites should use CSP frame-ancestors instead, but XFO provides older browser coverage.`,
      endpoint: targetUrl,
      severity: "MEDIUM",
      cvss: "4.7",
      cwe: "CWE-1021",
      owasp: "A05",
      pocCode: `# Clickjacking PoC — save as clickjack.html:\n<html><body>\n  <iframe src="${targetUrl}" style="opacity:0.1;position:absolute;z-index:2;width:100%;height:100%;"></iframe>\n  <button style="position:absolute;top:200px;left:300px;">Click me!</button>\n</body></html>`,
      fixPatch: `res.setHeader('X-Frame-Options', 'DENY');\n# Or in Nginx:\nadd_header X-Frame-Options "DENY" always;`,
      fixExplanation: "Set X-Frame-Options: DENY to prevent all framing, or SAMEORIGIN to allow same-origin frames only. Prefer CSP frame-ancestors 'none' for modern browsers.",
    });
  } else if (!["DENY", "SAMEORIGIN"].some(v => xfo.toUpperCase().includes(v))) {
    await addLog("WARN", `X-Frame-Options has non-standard value: ${xfo}`);
    findings.push({
      title: `X-Frame-Options has non-standard value: "${xfo}"`,
      description: `The X-Frame-Options header value "${xfo}" is not a recognized value. Valid values are DENY and SAMEORIGIN. Invalid values may be ignored by browsers, leaving the page vulnerable to clickjacking.`,
      endpoint: targetUrl,
      severity: "LOW",
      cvss: "3.5",
      cwe: "CWE-1021",
      owasp: "A05",
      fixExplanation: `Replace "${xfo}" with either DENY (recommended) or SAMEORIGIN.`,
    });
  }

  // 3. Strict-Transport-Security
  const hsts = h("strict-transport-security");
  if (!hsts && targetUrl.startsWith("https://")) {
    await addLog("WARN", "Missing Strict-Transport-Security (HSTS) header");
    findings.push({
      title: "Missing Strict-Transport-Security (HSTS) header",
      description: `The HTTPS site ${targetUrl} does not send an HSTS header. Without HSTS, browsers may silently downgrade future connections to HTTP, enabling man-in-the-middle attacks even though HTTPS is available.`,
      endpoint: targetUrl,
      severity: "HIGH",
      cvss: "7.4",
      cwe: "CWE-319",
      owasp: "A02",
      pocCode: `# Test HSTS:\ncurl -I ${targetUrl} | grep -i "strict-transport-security"\n# Expected: strict-transport-security: max-age=31536000; includeSubDomains; preload`,
      fixPatch: `# Express.js:\nres.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');\n# Nginx:\nadd_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;`,
      fixExplanation: "Add HSTS with max-age >= 31536000 (1 year), includeSubDomains, and preload. Submit your domain to https://hstspreload.org/ for browser preload lists.",
    });
  } else if (hsts) {
    const maxAgeMatch = hsts.match(/max-age=(\d+)/i);
    const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1]) : 0;
    if (maxAge < 31536000) {
      await addLog("WARN", `HSTS max-age too short: ${maxAge} (should be >= 31536000)`);
      findings.push({
        title: `HSTS max-age too short (${maxAge}s < 31536000s)`,
        description: `The HSTS max-age of ${maxAge} seconds is below the recommended minimum of 31536000 (1 year). Short HSTS durations leave windows for SSL stripping attacks between expirations.`,
        endpoint: targetUrl,
        severity: "MEDIUM",
        cvss: "5.4",
        cwe: "CWE-319",
        owasp: "A02",
        fixExplanation: `Increase HSTS max-age to at least 31536000. Current: max-age=${maxAge}. Recommended: max-age=31536000; includeSubDomains; preload`,
      });
    }
    if (!hsts.toLowerCase().includes("includesubdomains")) {
      await addLog("WARN", "HSTS missing includeSubDomains directive");
      findings.push({
        title: "HSTS missing includeSubDomains directive",
        description: `HSTS is set but without includeSubDomains. Subdomains may still be downgraded to HTTP, allowing cookie theft and MITM attacks targeting cookies set without the Secure flag on the apex domain.`,
        endpoint: targetUrl,
        severity: "LOW",
        cvss: "3.7",
        cwe: "CWE-319",
        owasp: "A02",
        fixExplanation: "Add includeSubDomains to your HSTS header: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload",
      });
    }
  }

  // 4. X-Content-Type-Options
  const xcto = h("x-content-type-options");
  if (!xcto) {
    await addLog("WARN", "Missing X-Content-Type-Options header");
    findings.push({
      title: "Missing X-Content-Type-Options header (MIME sniffing)",
      description: `No X-Content-Type-Options header on ${targetUrl}. Browsers may MIME-sniff responses and execute JavaScript disguised as image or text files, enabling content injection attacks.`,
      endpoint: targetUrl,
      severity: "LOW",
      cvss: "3.1",
      cwe: "CWE-16",
      owasp: "A05",
      fixPatch: `res.setHeader('X-Content-Type-Options', 'nosniff');`,
      fixExplanation: "Add X-Content-Type-Options: nosniff to all responses. This single-value header prevents browsers from MIME-sniffing and forces them to respect the declared Content-Type.",
    });
  } else if (xcto.toLowerCase() !== "nosniff") {
    await addLog("WARN", `X-Content-Type-Options has unexpected value: ${xcto}`);
    findings.push({
      title: `X-Content-Type-Options has incorrect value: "${xcto}"`,
      description: `The only valid value is "nosniff". The current value "${xcto}" may not be recognized by browsers.`,
      endpoint: targetUrl,
      severity: "LOW",
      cvss: "2.5",
      cwe: "CWE-16",
      owasp: "A05",
      fixExplanation: `Replace "${xcto}" with "nosniff": X-Content-Type-Options: nosniff`,
    });
  }

  // 5. Referrer-Policy
  const rp = h("referrer-policy");
  if (!rp) {
    await addLog("WARN", "Missing Referrer-Policy header");
    findings.push({
      title: "Missing Referrer-Policy header",
      description: `No Referrer-Policy on ${targetUrl}. Browsers default to sending the full URL in the Referer header when navigating from your site to external links. This can leak sensitive URL parameters (tokens, IDs, session data) to third parties.`,
      endpoint: targetUrl,
      severity: "LOW",
      cvss: "2.7",
      cwe: "CWE-200",
      owasp: "A05",
      fixPatch: `res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');`,
      fixExplanation: "Add Referrer-Policy: strict-origin-when-cross-origin to limit referrer information sent to external sites. Avoid 'unsafe-url' which sends the full URL including query parameters.",
    });
  } else if (rp.toLowerCase() === "unsafe-url") {
    await addLog("WARN", "Referrer-Policy is set to unsafe-url — leaks full URL to third parties");
    findings.push({
      title: "Insecure Referrer-Policy: 'unsafe-url' leaks full URLs",
      description: `The Referrer-Policy is set to 'unsafe-url', which sends the complete URL (including path and query parameters) to all external sites. This can leak authentication tokens, session IDs, or sensitive data embedded in URLs.`,
      endpoint: targetUrl,
      severity: "MEDIUM",
      cvss: "4.3",
      cwe: "CWE-200",
      owasp: "A05",
      fixExplanation: "Change to 'strict-origin-when-cross-origin' or 'no-referrer' to prevent leaking URL details to third-party sites.",
    });
  }

  // 6. Permissions-Policy
  const pp = h("permissions-policy");
  if (!pp) {
    await addLog("WARN", "Missing Permissions-Policy header");
    findings.push({
      title: "Missing Permissions-Policy header",
      description: `No Permissions-Policy on ${targetUrl}. Without this header, embedded iframes and third-party scripts may be granted access to camera, microphone, geolocation, and other sensitive browser APIs without restriction.`,
      endpoint: targetUrl,
      severity: "LOW",
      cvss: "3.5",
      cwe: "CWE-284",
      owasp: "A05",
      fixPatch: `res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');`,
      fixExplanation: "Add a Permissions-Policy header to restrict access to powerful browser APIs. Disable any features your application doesn't use.",
    });
  }

  // 7. Cross-Origin-Opener-Policy (COOP)
  const coop = h("cross-origin-opener-policy");
  if (!coop) {
    await addLog("WARN", "Missing Cross-Origin-Opener-Policy (COOP) header");
    findings.push({
      title: "Missing Cross-Origin-Opener-Policy (COOP) header",
      description: `No COOP header on ${targetUrl}. Without COOP, cross-origin windows can access your window object via opener references, enabling cross-origin attacks. COOP also enables access to SharedArrayBuffer and high-resolution timers when combined with COEP.`,
      endpoint: targetUrl,
      severity: "LOW",
      cvss: "3.5",
      cwe: "CWE-346",
      owasp: "A05",
      fixPatch: `res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');`,
      fixExplanation: "Set Cross-Origin-Opener-Policy: same-origin to isolate your browsing context from cross-origin windows. Use same-origin-allow-popups if you open trusted popup windows.",
    });
  }

  // 8. Cross-Origin-Embedder-Policy (COEP)
  const coep = h("cross-origin-embedder-policy");
  if (!coep) {
    await addLog("WARN", "Missing Cross-Origin-Embedder-Policy (COEP) header");
    findings.push({
      title: "Missing Cross-Origin-Embedder-Policy (COEP) header",
      description: `No COEP header on ${targetUrl}. COEP prevents the page from loading cross-origin resources that don't grant explicit permission, protecting against Spectre-class timing attacks.`,
      endpoint: targetUrl,
      severity: "LOW",
      cvss: "3.0",
      cwe: "CWE-346",
      owasp: "A05",
      fixPatch: `res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');`,
      fixExplanation: "Set Cross-Origin-Embedder-Policy: require-corp. Combine with COOP: same-origin to enable cross-origin isolation and access to high-resolution timers.",
    });
  }

  // 9. Cross-Origin-Resource-Policy (CORP)
  const corp = h("cross-origin-resource-policy");
  if (!corp) {
    await addLog("DEBUG", "Cross-Origin-Resource-Policy not set (informational)");
    findings.push({
      title: "Missing Cross-Origin-Resource-Policy (CORP) header",
      description: `No CORP header. Without CORP, your resources can be loaded by any cross-origin page, enabling side-channel attacks like Spectre to read resource data from another origin.`,
      endpoint: targetUrl,
      severity: "LOW",
      cvss: "2.5",
      cwe: "CWE-346",
      owasp: "A05",
      fixPatch: `res.setHeader('Cross-Origin-Resource-Policy', 'same-site');`,
      fixExplanation: "Set Cross-Origin-Resource-Policy: same-site (or same-origin for stricter isolation) to prevent cross-origin embeds of your resources.",
    });
  }

  // 10. Server header — version disclosure
  const serverHdr = h("server");
  if (serverHdr) {
    const versionPattern = /[\d]+\.[\d]+/;
    if (versionPattern.test(serverHdr)) {
      await addLog("WARN", `Server header exposes version number: "${serverHdr}"`);
      findings.push({
        title: `Server header exposes version: "${serverHdr}"`,
        description: `The Server header reveals the exact server software version: "${serverHdr}". Attackers can use this to look up version-specific CVEs and craft targeted exploits without scanning.`,
        endpoint: targetUrl,
        severity: "LOW",
        cvss: "3.7",
        cwe: "CWE-200",
        owasp: "A05",
        pocCode: `curl -I ${targetUrl} | grep -i "^server:"`,
        fixExplanation: `Remove or genericize the Server header. For Nginx: server_tokens off; For Apache: ServerTokens Prod; ServerSignature Off; For Express: app.disable('x-powered-by');`,
      });
    }
  }

  // 11. X-Powered-By — tech disclosure
  const xpb = h("x-powered-by");
  if (xpb) {
    await addLog("WARN", `X-Powered-By header discloses technology: "${xpb}"`);
    findings.push({
      title: `Technology stack disclosed via X-Powered-By: "${xpb}"`,
      description: `The X-Powered-By header reveals backend technology: "${xpb}". This aids attackers in identifying framework-specific vulnerabilities and tailoring their attack vectors.`,
      endpoint: targetUrl,
      severity: "LOW",
      cvss: "3.7",
      cwe: "CWE-200",
      owasp: "A05",
      pocCode: `curl -I ${targetUrl} | grep -i "x-powered-by"`,
      fixPatch: `// Express.js — remove x-powered-by:\napp.disable('x-powered-by');\n// Or use helmet:\nimport helmet from 'helmet';\napp.use(helmet());`,
      fixExplanation: "Suppress the X-Powered-By header entirely. In Express.js: app.disable('x-powered-by'). Using helmet() handles this automatically along with other security headers.",
    });
  }

  // 12. Cache-Control on sensitive paths
  const cacheControl = h("cache-control");
  if (reachable && (
    targetUrl.includes("/auth") || targetUrl.includes("/login") ||
    targetUrl.includes("/dashboard") || targetUrl.includes("/admin")
  )) {
    if (!cacheControl || (!cacheControl.includes("no-store") && !cacheControl.includes("private"))) {
      await addLog("WARN", `Cache-Control may allow sensitive page caching: "${cacheControl || 'missing'}"`);
      findings.push({
        title: "Sensitive page may be cached by browsers or proxies",
        description: `The authenticated/sensitive URL ${targetUrl} does not set Cache-Control: no-store or private. Shared caches (proxies, CDNs) or browser back-button cache may serve stale authenticated content to subsequent users.`,
        endpoint: targetUrl,
        severity: "MEDIUM",
        cvss: "4.3",
        cwe: "CWE-524",
        owasp: "A02",
        fixPatch: `res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');`,
        fixExplanation: "Set Cache-Control: no-store on all authenticated/sensitive responses to prevent caching. Use private for user-specific responses. Add Pragma: no-cache for legacy HTTP/1.0 support.",
      });
    }
  }

  await addLog("DEBUG", `[Module 1] Headers complete — ${findings.length} issue(s) found`);
  return findings;
}
