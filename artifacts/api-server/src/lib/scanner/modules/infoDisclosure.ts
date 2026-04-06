import type { ScanContext, FindingInput } from "./types.js";

const TECH_PATTERNS: { name: string; pattern: RegExp; category: string }[] = [
  { name: "Next.js", pattern: /__NEXT_DATA__|_next\/|next\.js/i, category: "Frontend Framework" },
  { name: "React", pattern: /react(?:\.development|\.production|\.min)?\.js|__react/i, category: "Frontend Framework" },
  { name: "Vue.js", pattern: /vue(?:\.runtime|\.min)?\.js|__VUE__|vue-router/i, category: "Frontend Framework" },
  { name: "Angular", pattern: /angular(?:\.min)?\.js|ng-version|ng-app/i, category: "Frontend Framework" },
  { name: "WordPress", pattern: /wp-content\/|wp-includes\/|wordpress/i, category: "CMS" },
  { name: "Django", pattern: /django|csrfmiddlewaretoken/i, category: "Backend Framework" },
  { name: "Laravel", pattern: /laravel|livewire/i, category: "Backend Framework" },
  { name: "Ruby on Rails", pattern: /rails|x-runtime.*ruby/i, category: "Backend Framework" },
  { name: "Vercel", pattern: /x-vercel-id|vercel\.app|\.vercel\./i, category: "Hosting / CDN" },
  { name: "Netlify", pattern: /netlify|x-nf-request-id/i, category: "Hosting / CDN" },
  { name: "Cloudflare", pattern: /cf-ray|cloudflare|__cfduid/i, category: "CDN / WAF" },
  { name: "AWS", pattern: /\.amazonaws\.com|x-amz-|cloudfront\.net|aws-/i, category: "Cloud Infrastructure" },
  { name: "Stripe", pattern: /stripe\.com\/v3|stripe\.js|pk_live_|pk_test_/i, category: "Payment Processor" },
  { name: "PayPal", pattern: /paypal\.com\/sdk|paypalobjects\.com/i, category: "Payment Processor" },
  { name: "Supabase", pattern: /supabase\.co|supabase\.js/i, category: "Database / BaaS" },
  { name: "Firebase", pattern: /firebase\.googleapis\.com|firebaseapp\.com/i, category: "Database / BaaS" },
  { name: "Sentry", pattern: /sentry\.io|raven\.js|@sentry/i, category: "Error Monitoring" },
  { name: "Google Analytics", pattern: /google-analytics\.com|gtag|UA-\d{5,}/i, category: "Analytics" },
  { name: "Segment", pattern: /segment\.com\/analytics|cdn\.segment\.com/i, category: "Analytics" },
];

const API_KEY_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: "OpenAI API Key", pattern: /sk-[a-zA-Z0-9]{32,}/ },
  { name: "Anthropic API Key", pattern: /sk-ant-[a-zA-Z0-9\-]{50,}/ },
  { name: "Google API Key", pattern: /AIza[0-9A-Za-z\-_]{35}/ },
  { name: "AWS Access Key", pattern: /AKIA[0-9A-Z]{16}/ },
  { name: "Stripe Live Key", pattern: /sk_live_[0-9a-zA-Z]{24,}/ },
  { name: "Stripe Publishable (Live)", pattern: /pk_live_[0-9a-zA-Z]{24,}/ },
  { name: "Supabase Service Key", pattern: /eyJ[a-zA-Z0-9\-_]{50,}\.eyJ[a-zA-Z0-9\-_]{50,}/ },
  { name: "Twilio Account SID", pattern: /AC[a-f0-9]{32}/ },
  { name: "SendGrid API Key", pattern: /SG\.[a-zA-Z0-9\-_]{22,}\.[a-zA-Z0-9\-_]{43,}/ },
  { name: "GitHub Personal Token", pattern: /ghp_[a-zA-Z0-9]{36}/ },
];

const ENV_VAR_PATTERNS = [/NEXT_PUBLIC_[A-Z_]+/g, /REACT_APP_[A-Z_]+/g, /VITE_[A-Z_]+/g];
const INTERNAL_PATH_PATTERNS = /["'](\/api\/admin|\/internal\/|\/v[0-9]+\/secret|\/private\/|\/debug\/|\/management\/)[^"']*/gi;
const SENSITIVE_ROBOTS_PATHS = ["/admin", "/backup", "/api", "/internal", "/private", "/config", "/secret", "/staging", "/test", "/dev"];

async function safeFetch(url: string): Promise<{ status: number; body: string } | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "RedForge-Scanner/2.1 Security-Assessment (+https://redforge.io)" },
      redirect: "manual",
    });
    let body = "";
    try { body = await res.text(); } catch { body = ""; }
    return { status: res.status, body };
  } catch {
    return null;
  }
}

export async function runInfoDisclosureModule(ctx: ScanContext): Promise<FindingInput[]> {
  const findings: FindingInput[] = [];
  const { targetUrl, resHeaders, bodyText, reachable, addLog } = ctx;

  await addLog("INFO", "[Module 2] Information disclosure scanner — tech stack, JS bundles, paths...");

  // 1. Tech stack detection from HTML/headers
  if (reachable && bodyText) {
    const allHeaderStr = Object.entries(resHeaders).map(([k, v]) => `${k}: ${v}`).join("\n");
    const scanTarget = bodyText.slice(0, 50000) + allHeaderStr;
    const detected: { name: string; category: string }[] = [];

    for (const tech of TECH_PATTERNS) {
      if (tech.pattern.test(scanTarget)) {
        detected.push({ name: tech.name, category: tech.category });
      }
    }

    if (detected.length > 0) {
      const techList = detected.map(t => `${t.name} (${t.category})`).join(", ");
      await addLog("DEBUG", `Technology stack detected: ${techList}`);
      findings.push({
        title: `Technology stack disclosed: ${detected.map(t => t.name).join(", ")}`,
        description: `The application exposes technology stack details in HTML source, script references, or response headers. Detected: ${techList}. This information helps attackers target version-specific vulnerabilities.`,
        endpoint: targetUrl,
        severity: "LOW",
        cvss: "3.7",
        cwe: "CWE-200",
        owasp: "A05",
        pocCode: `# Check tech disclosure:\ncurl -s ${targetUrl} | grep -i "next\\|react\\|vue\\|angular\\|wp-content"`,
        fixExplanation: "Remove or obfuscate framework-specific identifiers in HTML output. Avoid using default generator meta tags. Use framework bundlers to remove framework-identifying comments.",
      });
    }
  }

  // 2. JS bundle analysis for secrets and env vars
  if (reachable && bodyText) {
    const scriptSrcPattern = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi;
    const scriptUrls: string[] = [];
    let match;
    while ((match = scriptSrcPattern.exec(bodyText)) !== null) {
      const src = match[1];
      if (!src.startsWith("http") && !src.startsWith("//")) {
        try {
          scriptUrls.push(new URL(src, targetUrl).toString());
        } catch { /* ignore */ }
      } else if (src.startsWith("//")) {
        scriptUrls.push("https:" + src);
      } else {
        scriptUrls.push(src);
      }
    }

    await addLog("DEBUG", `Found ${scriptUrls.length} JS bundle(s) to analyze for secrets`);

    for (const scriptUrl of scriptUrls.slice(0, 6)) {
      if (scriptUrl.includes("cdn") || scriptUrl.includes("unpkg") || scriptUrl.includes("jsdelivr")) continue;

      const result = await safeFetch(scriptUrl);
      if (!result || result.status !== 200) continue;

      const jsBody = result.body.slice(0, 100000);

      // Check for hardcoded API keys
      for (const keyPat of API_KEY_PATTERNS) {
        if (keyPat.pattern.test(jsBody)) {
          await addLog("ERROR", `⚠️  Potential hardcoded ${keyPat.name} found in ${scriptUrl}`);
          findings.push({
            title: `Hardcoded ${keyPat.name} exposed in JavaScript bundle`,
            description: `A pattern matching ${keyPat.name} was detected in the JavaScript bundle at ${scriptUrl}. Hardcoded credentials in client-side JavaScript are fully visible to any user and can be extracted to abuse your API accounts.`,
            endpoint: scriptUrl,
            severity: "CRITICAL",
            cvss: "9.1",
            cwe: "CWE-798",
            owasp: "A07",
            pocCode: `# Extract from bundle:\ncurl -s "${scriptUrl}" | grep -oP '(sk-|AKIA|AIza|pk_live_)[a-zA-Z0-9_-]+'`,
            fixExplanation: `Remove all hardcoded API keys from client-side code. Move secrets to server-side environment variables. Rotate the exposed ${keyPat.name} immediately — it must be considered compromised.`,
          });
          break;
        }
      }

      // Check for exposed env vars
      const envVarsFound: string[] = [];
      for (const envPattern of ENV_VAR_PATTERNS) {
        const envMatches = jsBody.match(envPattern) || [];
        envVarsFound.push(...envMatches);
      }

      if (envVarsFound.length > 0) {
        const uniqueEnvVars = [...new Set(envVarsFound)].slice(0, 10);
        await addLog("WARN", `Exposed env var names in JS bundle: ${uniqueEnvVars.join(", ")}`);
        findings.push({
          title: `Environment variable names exposed in JavaScript bundle`,
          description: `The bundle at ${scriptUrl} exposes environment variable names: ${uniqueEnvVars.join(", ")}. While NEXT_PUBLIC_, REACT_APP_, and VITE_ prefixed variables are intentionally public, their presence reveals your tech stack and may include sensitive values that shouldn't be public.`,
          endpoint: scriptUrl,
          severity: "MEDIUM",
          cvss: "4.3",
          cwe: "CWE-200",
          owasp: "A05",
          fixExplanation: "Audit all public environment variables. Never pass secrets through NEXT_PUBLIC_, REACT_APP_, or VITE_ prefixes — these are bundled into client-side code. Keep secrets server-side only.",
        });
      }

      // Check for internal API paths
      const internalPaths: string[] = [];
      let pathMatch;
      const pathPatternCopy = new RegExp(INTERNAL_PATH_PATTERNS.source, "gi");
      while ((pathMatch = pathPatternCopy.exec(jsBody)) !== null) {
        internalPaths.push(pathMatch[0].replace(/^["']/, "").replace(/["']$/, ""));
      }
      if (internalPaths.length > 0) {
        const uniquePaths = [...new Set(internalPaths)].slice(0, 8);
        await addLog("WARN", `Internal API paths found in JS bundle: ${uniquePaths.join(", ")}`);
        findings.push({
          title: "Internal/admin API paths exposed in JavaScript bundle",
          description: `The JavaScript bundle at ${scriptUrl} contains references to internal API paths: ${uniquePaths.join(", ")}. These paths reveal the API surface to attackers, enabling targeted probing of admin and internal endpoints.`,
          endpoint: scriptUrl,
          severity: "MEDIUM",
          cvss: "4.3",
          cwe: "CWE-200",
          owasp: "A05",
          fixExplanation: "Ensure internal API paths are not referenced in client-side bundles unless necessary. Protect all admin/internal routes with strong authentication and authorization checks.",
        });
      }
    }
  }

  // 3. robots.txt analysis
  try {
    const robotsUrl = new URL("/robots.txt", targetUrl).toString();
    const result = await safeFetch(robotsUrl);
    if (result && result.status === 200 && result.body.length > 10 && !result.body.toLowerCase().includes("<!doctype html")) {
      const disallowedLines = result.body.split("\n")
        .filter(l => l.trim().toLowerCase().startsWith("disallow:"))
        .map(l => l.replace(/disallow:\s*/i, "").trim())
        .filter(p => p && p !== "/");

      const sensitivePaths = disallowedLines.filter(p =>
        SENSITIVE_ROBOTS_PATHS.some(sp => p.toLowerCase().includes(sp))
      );

      if (sensitivePaths.length > 0) {
        await addLog("WARN", `robots.txt reveals sensitive paths: ${sensitivePaths.slice(0, 5).join(", ")}`);
        findings.push({
          title: `robots.txt reveals sensitive paths: ${sensitivePaths.slice(0, 3).join(", ")}`,
          description: `The /robots.txt file contains Disallow entries that reveal the existence of sensitive directories: ${sensitivePaths.join(", ")}. While robots.txt is meant to guide crawlers, it effectively acts as a directory listing for attackers — they target Disallowed paths specifically.`,
          endpoint: robotsUrl,
          severity: "LOW",
          cvss: "3.7",
          cwe: "CWE-200",
          owasp: "A05",
          pocCode: `curl -s "${robotsUrl}"\n# Look for sensitive Disallow entries`,
          fixExplanation: "Avoid listing sensitive paths in robots.txt — use proper access controls instead. Paths like /admin, /backup, and /api should be protected via authentication, not hidden via robots.txt.",
        });
      } else {
        await addLog("DEBUG", `robots.txt found — ${disallowedLines.length} disallowed path(s), no sensitive paths`);
      }
    }
  } catch { /* ignore */ }

  // 4. Sensitive path probing
  const sensitivePaths = [
    { path: "/.env",            label: ".env secrets file",       severity: "CRITICAL" as const, cvss: "9.8" },
    { path: "/.git/HEAD",       label: "Git repository exposed",  severity: "CRITICAL" as const, cvss: "9.1" },
    { path: "/config.json",     label: "Config JSON exposed",     severity: "HIGH" as const,     cvss: "7.5" },
    { path: "/api/health",      label: "Health endpoint",         severity: "LOW" as const,      cvss: "3.7" },
    { path: "/api/version",     label: "Version endpoint",        severity: "LOW" as const,      cvss: "3.7" },
    { path: "/swagger.json",    label: "Swagger/OpenAPI docs",    severity: "MEDIUM" as const,   cvss: "5.3" },
    { path: "/openapi.json",    label: "OpenAPI spec exposed",    severity: "MEDIUM" as const,   cvss: "5.3" },
    { path: "/graphql",         label: "GraphQL endpoint",        severity: "MEDIUM" as const,   cvss: "5.3" },
    { path: "/admin",           label: "Admin panel",             severity: "HIGH" as const,     cvss: "7.5" },
    { path: "/wp-admin",        label: "WordPress admin",         severity: "HIGH" as const,     cvss: "7.5" },
    { path: "/phpmyadmin",      label: "phpMyAdmin exposed",      severity: "CRITICAL" as const, cvss: "9.8" },
    { path: "/.well-known/security.txt", label: "security.txt",  severity: "LOW" as const,      cvss: "0.0" },
  ];

  await addLog("DEBUG", `Probing ${sensitivePaths.length} sensitive paths...`);

  // Helper: confirm if target is actually running WordPress
  // Only trust /wp-login.php returning 200, or X-Powered-By: WordPress header
  const isConfirmedWordPress = async (): Promise<boolean> => {
    const xpb = resHeaders["x-powered-by"] || resHeaders["X-Powered-By"] || "";
    if (/wordpress/i.test(xpb)) return true;
    const loginResult = await safeFetch(new URL("/wp-login.php", targetUrl).toString());
    return loginResult?.status === 200;
  };

  for (const sp of sensitivePaths) {
    let probeUrl: string;
    try { probeUrl = new URL(sp.path, targetUrl).toString(); } catch { continue; }

    const result = await safeFetch(probeUrl);
    if (!result) continue;

    const status = result.status;
    if (status === 200) {
      const isHtml = result.body.toLowerCase().includes("<!doctype html") || result.body.toLowerCase().includes("<html");
      if (!isHtml || sp.path === "/graphql" || sp.path === "/admin" || sp.path === "/wp-admin") {
        // For /wp-admin specifically — 200 with HTML is only real if it's WordPress
        if (sp.path === "/wp-admin" && isHtml) {
          const confirmed = await isConfirmedWordPress();
          if (!confirmed) {
            await addLog("DEBUG", `Path /wp-admin returned 200 but WordPress not confirmed — skipping false positive`);
            continue;
          }
        }
        await addLog("ERROR", `⚠️  EXPOSED: ${sp.path} → HTTP 200 (${result.body.length} bytes)`);
        findings.push({
          title: `${sp.label} publicly accessible: ${sp.path}`,
          description: `The path ${probeUrl} returned HTTP 200 with ${result.body.length} bytes. ${sp.path === "/.env" ? "This file may contain database credentials, API keys, and secrets." : sp.path.includes("swagger") || sp.path.includes("openapi") ? "Full API documentation is publicly accessible, revealing all endpoints, parameters, and authentication methods." : "This sensitive resource is accessible without authentication."}`,
          endpoint: probeUrl,
          severity: sp.severity,
          cvss: sp.cvss,
          cwe: "CWE-538",
          owasp: "A05",
          pocCode: `curl -s "${probeUrl}" | head -30`,
          fixExplanation: `Block access to ${sp.path} via web server configuration. Require authentication for any admin or API documentation endpoints.`,
        });
      }
    } else if (status === 403) {
      await addLog("DEBUG", `Path ${sp.path} exists but is blocked (HTTP 403)`);
      if (sp.severity === "CRITICAL" || sp.severity === "HIGH") {
        // /wp-admin 403 is NOT evidence of WordPress — require confirmation before flagging
        if (sp.path === "/wp-admin") {
          const confirmed = await isConfirmedWordPress();
          if (!confirmed) {
            await addLog("DEBUG", `Path /wp-admin returned 403 but WordPress not confirmed — skipping false positive`);
            continue;
          }
        }
        findings.push({
          title: `${sp.label} exists but blocked: ${sp.path} (HTTP 403)`,
          description: `The path ${probeUrl} returned HTTP 403 (Forbidden), confirming the resource exists but is access-controlled. A 403 response reveals the path exists — consider returning 404 instead to avoid path enumeration.`,
          endpoint: probeUrl,
          severity: "LOW",
          cvss: "2.7",
          cwe: "CWE-200",
          owasp: "A05",
          fixExplanation: `Return HTTP 404 instead of 403 for sensitive paths to avoid confirming their existence. Configure your web server to return 404 for blocked resources.`,
        });
      }
    }
  }

  await addLog("DEBUG", `[Module 2] Info disclosure complete — ${findings.length} issue(s) found`);
  return findings;
}
