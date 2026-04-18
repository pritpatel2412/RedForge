import type { ScanContext, FindingInput } from "./types.js";

/**
 * Module 10: API Security & Infrastructure Probing
 * - HTTP method enumeration (OPTIONS, TRACE, PUT, DELETE)
 * - GraphQL introspection detection
 * - Verbose error/stack trace detection
 * - Debug endpoint discovery
 * - Directory traversal probing
 * - WAF detection & fingerprinting
 * - TRACE method (Cross-Site Tracing / XST)
 */

const DEBUG_ENDPOINTS = [
  { path: '/debug',              label: 'Debug panel' },
  { path: '/debug/vars',         label: 'Go debug vars' },
  { path: '/debug/pprof',        label: 'Go pprof profiler' },
  { path: '/_debug',             label: 'Debug endpoint' },
  { path: '/actuator',           label: 'Spring Boot Actuator' },
  { path: '/actuator/health',    label: 'Spring Boot health' },
  { path: '/actuator/env',       label: 'Spring Boot environment (CRITICAL)' },
  { path: '/actuator/beans',     label: 'Spring Boot beans' },
  { path: '/actuator/mappings',  label: 'Spring Boot URL mappings' },
  { path: '/__debug__',          label: 'Django debug toolbar' },
  { path: '/elmah.axd',          label: '.NET ELMAH error logs' },
  { path: '/trace',              label: 'Spring Boot trace' },
  { path: '/metrics',            label: 'Metrics endpoint' },
  { path: '/prometheus',         label: 'Prometheus metrics' },
  { path: '/server-info',        label: 'Server info' },
  { path: '/server-status',      label: 'Apache server-status' },
  { path: '/.well-known/openid-configuration', label: 'OpenID configuration' },
  { path: '/api/v1',             label: 'API v1 root' },
  { path: '/api/docs',           label: 'API documentation' },
  { path: '/api-docs',           label: 'Swagger docs' },
];

const DIRECTORY_TRAVERSAL_PAYLOADS = [
  { payload: '../../../etc/passwd',     marker: 'root:' },
  { payload: '..%2F..%2F..%2Fetc%2Fpasswd', marker: 'root:' },
  { payload: '....//....//....//etc/passwd', marker: 'root:' },
  { payload: '..\\..\\..\\windows\\win.ini', marker: '[fonts]' },
];

const STACK_TRACE_PATTERNS = [
  /at\s+\S+\s+\([^)]+:\d+:\d+\)/i,                    // Node.js stack trace
  /Traceback \(most recent call last\)/,                  // Python
  /java\.lang\.\w+Exception/,                            // Java
  /Microsoft\.AspNetCore|System\.Web/,                   // .NET
  /Fatal error:.*in\s+\/[^\s]+\.php/i,                  // PHP
  /goroutine\s+\d+\s+\[/,                               // Go
  /SQLSTATE\[\w+\]/,                                      // PDO/SQL
  /#\d+\s+\/[^\s]+\.rb:\d+/,                            // Ruby
  /panic:\s+runtime\s+error/,                            // Go panic
  /Caused by:/,                                           // Java chained
];

const WAF_SIGNATURES: { name: string; headerPattern: RegExp; bodyPattern?: RegExp }[] = [
  { name: 'Cloudflare',      headerPattern: /cf-ray|cloudflare/i },
  { name: 'AWS WAF',         headerPattern: /x-amzn-waf/i },
  { name: 'Akamai',          headerPattern: /akamai|x-akamai/i },
  { name: 'Imperva/Incapsula', headerPattern: /incap_ses|visid_incap|x-cdn.*imperva/i },
  { name: 'Sucuri',          headerPattern: /x-sucuri|sucuri/i },
  { name: 'ModSecurity',     headerPattern: /mod_security|modsecurity/i, bodyPattern: /ModSecurity/i },
  { name: 'F5 BIG-IP',       headerPattern: /bigip|f5/i },
  { name: 'Fastly',          headerPattern: /x-fastly|fastly/i },
  { name: 'Barracuda',       headerPattern: /barra_counter_session/i },
  { name: 'Varnish',         headerPattern: /x-varnish|via.*varnish/i },
  { name: 'DDoS-Guard',      headerPattern: /ddos-guard/i },
];

export async function runAPISecurityModule(ctx: ScanContext): Promise<FindingInput[]> {
  const findings: FindingInput[] = [];
  const { targetUrl, resHeaders, bodyText, reachable, scanMode, addLog, safeFetch } = ctx;

  await addLog("INFO", "[Module 10] API security & infrastructure probing...");

  if (!reachable) {
    await addLog("WARN", "[Module 10] Target unreachable — skipping");
    return findings;
  }

  const allHeaderStr = Object.entries(resHeaders).map(([k, v]) => `${k}: ${v}`).join('\n').toLowerCase();

  // 1. WAF Detection & Fingerprinting
  await addLog("DEBUG", "Fingerprinting WAF/CDN...");
  const detectedWafs: string[] = [];
  for (const waf of WAF_SIGNATURES) {
    if (waf.headerPattern.test(allHeaderStr) || (waf.bodyPattern && waf.bodyPattern.test(bodyText || ''))) {
      detectedWafs.push(waf.name);
    }
  }

  if (detectedWafs.length > 0) {
    await addLog("INFO", `WAF/CDN detected: ${detectedWafs.join(', ')}`);
    findings.push({
      title: `WAF/CDN detected: ${detectedWafs.join(', ')}`,
      description: `The application is protected by ${detectedWafs.join(', ')}. While this provides a layer of defense, WAF rules can often be bypassed with encoding tricks, HTTP parameter pollution, or protocol-level attacks. Security should not rely solely on WAF protection.`,
      endpoint: targetUrl,
      severity: "INFO",
      cvss: "0.0",
      cwe: "CWE-693",
      owasp: "A05",
      confidence: 0.9,
      tags: ["waf", ...detectedWafs.map(w => `waf:${w.toLowerCase().replace(/\s+/g, '-')}`)],
      fixExplanation: "WAF is a good defense-in-depth measure but should not be the sole security control. Ensure application-level security (input validation, parameterized queries, output encoding) is robust independent of the WAF.",
    });
  }

  // 2. HTTP Method Enumeration
  if (scanMode === "ACTIVE") {
    await addLog("DEBUG", "Enumerating HTTP methods...");
    const dangerousMethods = ['PUT', 'DELETE', 'TRACE', 'PATCH'];
    const optionsResp = await safeFetch(targetUrl, { method: 'OPTIONS', timeoutMs: 6000 });

    if (optionsResp) {
      const allowHeader = optionsResp.headers.get('allow') || optionsResp.headers.get('access-control-allow-methods') || '';
      if (allowHeader) {
        const allowedMethods = allowHeader.split(',').map(m => m.trim().toUpperCase());
        const dangerousAllowed = allowedMethods.filter(m => dangerousMethods.includes(m));

        if (dangerousAllowed.includes('TRACE')) {
          await addLog("ERROR", "⚠️  TRACE method enabled — Cross-Site Tracing (XST) risk");
          findings.push({
            title: "TRACE HTTP method enabled — Cross-Site Tracing (XST) vulnerability",
            description: `The server accepts TRACE requests (Allow: ${allowHeader}). The TRACE method echoes back the full request including authentication headers. Combined with XSS, an attacker can use XMLHttpRequest TRACE to steal HttpOnly cookies and Authorization headers that are otherwise inaccessible via JavaScript.`,
            endpoint: targetUrl,
            severity: "MEDIUM",
            cvss: "5.9",
            cwe: "CWE-693",
            owasp: "A05",
            confidence: 0.85,
            tags: ["http-methods", "trace", "xst"],
            pocCode: `# Test TRACE method:\ncurl -X TRACE ${targetUrl} -H "Cookie: session=secret123"\n# If the response reflects the Cookie header → XST confirmed`,
            fixExplanation: "Disable the TRACE HTTP method on your web server. For Nginx: add 'if ($request_method = TRACE) { return 405; }'. For Apache: 'TraceEnable off'.",
          });
        }

        if (dangerousAllowed.filter(m => m !== 'TRACE' && m !== 'PATCH').length > 0) {
          const methods = dangerousAllowed.filter(m => m !== 'TRACE' && m !== 'PATCH');
          await addLog("WARN", `Dangerous HTTP methods allowed: ${methods.join(', ')}`);
          findings.push({
            title: `Dangerous HTTP methods enabled: ${methods.join(', ')}`,
            description: `The server accepts ${methods.join(', ')} HTTP methods (Allow: ${allowHeader}). PUT enables file upload/overwrite, DELETE allows resource destruction. If not properly authenticated, these methods can be exploited to modify or destroy resources.`,
            endpoint: targetUrl,
            severity: "MEDIUM",
            cvss: "5.3",
            cwe: "CWE-749",
            owasp: "A05",
            confidence: 0.7,
            tags: ["http-methods", ...methods.map(m => m.toLowerCase())],
            pocCode: `# Test PUT method:\ncurl -X PUT ${targetUrl}/test.txt -d "Uploaded by RedForge scanner"\n# Test DELETE:\ncurl -X DELETE ${targetUrl}/test-resource`,
            fixExplanation: "Disable unnecessary HTTP methods. Only allow GET, POST, and HEAD for standard web pages. Require authentication for PUT, DELETE, and PATCH endpoints.",
          });
        }
      }
    }
  }

  // 3. GraphQL Introspection Check
  await addLog("DEBUG", "Checking for GraphQL introspection...");
  const graphqlEndpoints = [`${targetUrl}/graphql`, `${targetUrl}/api/graphql`, `${targetUrl}/gql`];

  for (const gqlUrl of graphqlEndpoints) {
    const gqlResp = await safeFetch(gqlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ __schema { types { name } } }' }),
      timeoutMs: 6000,
    });

    if (!gqlResp) continue;
    let gqlBody = '';
    try { gqlBody = await gqlResp.text(); } catch { continue; }

    if (gqlBody.includes('__schema') && gqlBody.includes('types')) {
      const typeCount = (gqlBody.match(/"name"/g) || []).length;
      await addLog("ERROR", `⚠️  GraphQL introspection enabled at ${gqlUrl} — ${typeCount} types exposed`);
      findings.push({
        title: `GraphQL introspection enabled — full schema exposed (${typeCount} types)`,
        description: `GraphQL introspection is enabled at ${gqlUrl}. The complete API schema including all types, queries, mutations, and fields is publicly accessible. This gives attackers a complete map of the API surface including internal types like User, Admin, Payment, etc.`,
        endpoint: gqlUrl,
        severity: "MEDIUM",
        cvss: "5.3",
        cwe: "CWE-200",
        owasp: "A05",
        confidence: 0.95,
        tags: ["graphql", "introspection", "api-schema"],
        pocCode: `# Full introspection query:\ncurl -X POST ${gqlUrl} \\\n  -H "Content-Type: application/json" \\\n  -d '{"query":"{ __schema { queryType { name } mutationType { name } types { name kind fields { name type { name } } } } }"}'`,
        fixPatch: `// Disable introspection in production:\n// Apollo Server:\nnew ApolloServer({\n  introspection: process.env.NODE_ENV !== 'production',\n});\n\n// graphql-yoga:\ncreateSchema({ maskedErrors: true })`,
        fixExplanation: "Disable GraphQL introspection in production. Use query depth limiting, cost analysis, and field-level authorization to prevent abuse.",
      });
      break;
    }
  }

  // 4. Debug/Admin Endpoint Discovery
  if (scanMode === "ACTIVE") {
    await addLog("DEBUG", `Probing ${DEBUG_ENDPOINTS.length} debug/admin endpoints...`);

    for (const { path, label } of DEBUG_ENDPOINTS) {
      let probeUrl: string;
      try { probeUrl = new URL(path, targetUrl).toString(); } catch { continue; }

      const resp = await safeFetch(probeUrl, { timeoutMs: 5000 });
      if (!resp || resp.status !== 200) continue;

      let body = '';
      try { body = await resp.text(); } catch { continue; }

      // Filter out SPA catch-all responses
      const isGenericHtml = body.toLowerCase().includes('<!doctype html') && body.length < 5000;
      if (isGenericHtml && !body.toLowerCase().includes(label.toLowerCase())) continue;

      // Detect actual content
      const isActualContent = body.includes('{') || body.includes('beans') || body.includes('mappings') ||
        body.includes('metrics') || body.includes('status') || body.length > 500;

      if (isActualContent) {
        const isCritical = path.includes('env') || path.includes('pprof') || path.includes('elmah');
        await addLog("ERROR", `⚠️  ${label} accessible: ${path} (${body.length} bytes)`);
        findings.push({
          title: `${label} publicly accessible: ${path}`,
          description: `The endpoint ${probeUrl} returned HTTP 200 with ${body.length} bytes of content. ${isCritical ? 'This endpoint may expose environment variables, secrets, or internal state.' : 'This debug/admin endpoint reveals internal application details.'}`,
          endpoint: probeUrl,
          severity: isCritical ? "CRITICAL" : "HIGH",
          cvss: isCritical ? "9.1" : "7.5",
          cwe: "CWE-215",
          owasp: "A05",
          confidence: 0.8,
          tags: ["debug", "admin", `endpoint:${path}`],
          pocCode: `curl -s "${probeUrl}" | head -50`,
          fixExplanation: `Block access to ${path} in production. For Spring Boot: management.endpoints.web.exposure.include=health,info (remove sensitive actuators). Add authentication to all debug/admin endpoints.`,
        });
      }
    }
  }

  // 5. Verbose Error / Stack Trace Detection
  if (scanMode === "ACTIVE") {
    await addLog("DEBUG", "Probing for verbose error messages...");
    const errorTriggers = [
      `${targetUrl}/api/undefined`,
      `${targetUrl}/api/null`,
      `${targetUrl}/api/%00`,
      `${targetUrl}/api/../../../etc/passwd`,
      `${targetUrl}/api/test?id=NaN`,
    ];

    for (const errorUrl of errorTriggers) {
      const resp = await safeFetch(errorUrl, { timeoutMs: 5000 });
      if (!resp) continue;

      let body = '';
      try { body = await resp.text(); } catch { continue; }

      for (const pattern of STACK_TRACE_PATTERNS) {
        if (pattern.test(body)) {
          const matchStr = body.match(pattern)?.[0] || '';
          await addLog("ERROR", `⚠️  Stack trace leaked at ${errorUrl}`);
          findings.push({
            title: "Verbose error response exposes stack trace / internal paths",
            description: `The endpoint ${errorUrl} returned an error response containing a stack trace or internal path information. Detected pattern: "${matchStr.slice(0, 100)}". This reveals internal file paths, framework versions, and code structure to attackers.`,
            endpoint: errorUrl,
            severity: "MEDIUM",
            cvss: "5.3",
            cwe: "CWE-209",
            owasp: "A05",
            confidence: 0.9,
            evidence: body.slice(0, 400),
            tags: ["error-disclosure", "stack-trace"],
            fixPatch: `// Express.js — custom error handler:\napp.use((err, req, res, next) => {\n  console.error(err); // log internally\n  res.status(err.status || 500).json({\n    error: 'Internal server error' // generic message\n  });\n});`,
            fixExplanation: "Configure a custom error handler that returns generic error messages in production. Log detailed errors server-side only. Set NODE_ENV=production or equivalent to disable debug mode.",
          });
          break;
        }
      }
    }
  }

  // 6. Directory Traversal (ACTIVE only)
  if (scanMode === "ACTIVE") {
    await addLog("DEBUG", "Probing for directory traversal...");
    const traversalEndpoints = [
      `${targetUrl}/api/file?path=`,
      `${targetUrl}/api/download?file=`,
      `${targetUrl}/api/read?name=`,
      `${targetUrl}/static/`,
      `${targetUrl}/assets/`,
    ];

    for (const endpoint of traversalEndpoints) {
      for (const { payload, marker } of DIRECTORY_TRAVERSAL_PAYLOADS.slice(0, 2)) {
        const testUrl = `${endpoint}${encodeURIComponent(payload)}`;
        const resp = await safeFetch(testUrl, { timeoutMs: 5000 });
        if (!resp) continue;
        let body = '';
        try { body = await resp.text(); } catch { continue; }

        if (body.includes(marker)) {
          await addLog("ERROR", `⚠️  DIRECTORY TRAVERSAL at ${endpoint}`);
          findings.push({
            title: "Directory traversal — arbitrary file read confirmed",
            description: `The endpoint ${endpoint} is vulnerable to directory traversal. Injecting "${payload}" returned file contents containing "${marker}". An attacker can read any file on the server including /etc/shadow, application source code, database credentials, and private keys.`,
            endpoint: testUrl,
            severity: "CRITICAL",
            cvss: "9.8",
            cwe: "CWE-22",
            owasp: "A01",
            confidence: 0.95,
            tags: ["path-traversal", "file-read", "lfi"],
            pocCode: `# Read /etc/passwd:\ncurl "${testUrl}"\n\n# Read application config:\ncurl "${endpoint}${encodeURIComponent('../../../app/.env')}"`,
            fixExplanation: "Never use user input directly in file paths. Use path.basename() to strip directory components. Validate against an allowlist of permitted files. Use a chroot jail or containerized filesystem.",
          });
          break;
        }
      }
    }
  }

  await addLog("DEBUG", `[Module 10] API security complete — ${findings.length} issue(s) found`);
  return findings;
}
