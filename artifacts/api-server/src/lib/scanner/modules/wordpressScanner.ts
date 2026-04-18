/**
 * WordPress Deep Scanner Module (#3)
 * Goes beyond detecting /wp-admin to enumerate WP version, plugins,
 * XML-RPC exposure, and common WP-specific vulnerabilities.
 */
import type { ScanContext, FindingInput } from "./types.js";

const WP_PATHS = [
  "/readme.html",
  "/wp-login.php",
  "/wp-admin/",
  "/xmlrpc.php",
  "/wp-cron.php",
  "/wp-json/wp/v2/users",     // user enumeration
  "/wp-json/wp/v2/posts",
  "/?author=1",               // author enumeration bypass
  "/wp-content/debug.log",
];

const COMMON_PLUGINS = [
  "contact-form-7",
  "woocommerce",
  "elementor",
  "yoast-seo",
  "wordfence",
  "akismet",
  "jetpack",
  "wpforms-lite",
  "advanced-custom-fields",
  "all-in-one-seo-pack",
  "revolution-slider",        // known vuln history
  "wp-file-manager",          // critical RCE CVE-2020-25213
  "duplicator",               // known data exposure
  "easy-wp-smtp",
];

export async function runWordPressModule(ctx: ScanContext): Promise<FindingInput[]> {
  const { technologies, safeFetch, targetUrl, addLog } = ctx;
  const isWP = technologies.includes("WordPress") ||
    ctx.bodyText.includes("wp-content") ||
    ctx.bodyText.includes("wp-includes");

  if (!isWP) return [];

  await addLog("info", "WordPress detected — running deep WP scanner");
  const findings: FindingInput[] = [];
  const base = targetUrl.replace(/\/$/, "");

  // ── 1. Detect WP version ──────────────────────────────────────────────────
  const readmeRes = await safeFetch(`${base}/readme.html`);
  if (readmeRes?.ok) {
    const body = await readmeRes.text();
    const versionMatch = body.match(/Version\s+([\d.]+)/i);
    const version = versionMatch?.[1];

    findings.push({
      title: "WordPress readme.html Exposed",
      description: version
        ? `WordPress version ${version} detected via /readme.html. This file publicly discloses the exact CMS version, enabling targeted CVE exploitation.`
        : "/readme.html accessible — discloses WordPress installation presence and potentially version info.",
      endpoint: `${base}/readme.html`,
      severity: version ? "MEDIUM" : "LOW",
      cvss: version ? "5.3" : "3.7",
      cwe: "CWE-200",
      owasp: "A05:2021 – Security Misconfiguration",
      evidence: version ? `WordPress version: ${version}` : "File accessible",
      pocCode: `curl -s ${base}/readme.html | grep -i version`,
      fixPatch: `# Delete or restrict access to readme.html\nnginx: location = /readme.html { deny all; return 403; }\nOr: rm ${base}/readme.html`,
      fixExplanation: "Remove readme.html from your web root or block access via server config. WordPress does not need this file to function.",
      tags: ["wordpress", "information-disclosure", "version-exposure"],
      confidence: 0.95,
    });
  }

  // ── 2. XML-RPC exposure ────────────────────────────────────────────────────
  const xmlrpcRes = await safeFetch(`${base}/xmlrpc.php`, { method: "POST" });
  if (xmlrpcRes && (xmlrpcRes.status === 200 || xmlrpcRes.status === 405)) {
    const body = (await xmlrpcRes.text().catch(() => "")) || "";
    const isXmlRpc = body.includes("XML-RPC") || body.includes("xmlrpc");

    if (xmlrpcRes.status === 200 || isXmlRpc) {
      findings.push({
        title: "WordPress XML-RPC Interface Exposed",
        description: "xmlrpc.php is publicly accessible. This enables brute-force amplification attacks (1 HTTP request = 1000 login attempts via system.multicall) and historical exploits including CVE-2020-28032. If XML-RPC is not used, it should be blocked entirely.",
        endpoint: `${base}/xmlrpc.php`,
        severity: "HIGH",
        cvss: "7.5",
        cwe: "CWE-307",
        owasp: "A07:2021 – Identification and Authentication Failures",
        pocCode: `curl -s -X POST ${base}/xmlrpc.php \\\n  -H "Content-Type: text/xml" \\\n  -d '<?xml version="1.0"?><methodCall><methodName>system.listMethods</methodName></methodCall>'`,
        evidence: `xmlrpc.php returned HTTP ${xmlrpcRes.status}`,
        tags: ["wordpress", "xmlrpc", "brute-force", "rate-limit"],
        remediationCode: [
          {
            language: "nginx",
            label: "Block xmlrpc.php (nginx)",
            code: `location = /xmlrpc.php {\n    deny all;\n    return 403;\n}`,
          },
          {
            language: "php",
            label: "Disable via wp-config.php",
            code: `add_filter('xmlrpc_enabled', '__return_false');`,
          },
        ],
        fixExplanation: "Block xmlrpc.php at the web server level unless you specifically need it for Jetpack or remote publishing.",
        confidence: 0.95,
      });
    }
  }

  // ── 3. User Enumeration via REST API ────────────────────────────────────────
  const usersRes = await safeFetch(`${base}/wp-json/wp/v2/users?per_page=10`);
  if (usersRes?.ok) {
    const users = await usersRes.json().catch(() => []) as any[];
    if (Array.isArray(users) && users.length > 0) {
      const usernames = users.map((u: any) => u.slug || u.name).filter(Boolean);
      findings.push({
        title: "WordPress User Enumeration via REST API",
        description: `The WordPress REST API exposes registered usernames without authentication. Discovered: ${usernames.join(", ")}. These can be used in targeted brute-force attacks against /wp-login.php or xmlrpc.php.`,
        endpoint: `${base}/wp-json/wp/v2/users`,
        severity: "MEDIUM",
        cvss: "5.3",
        cwe: "CWE-200",
        owasp: "A01:2021 – Broken Access Control",
        evidence: `Exposed users: ${JSON.stringify(usernames)}`,
        pocCode: `curl -s "${base}/wp-json/wp/v2/users" | jq '.[].slug'`,
        fixPatch: `// In your theme's functions.php:\nadd_filter('rest_endpoints', function($endpoints) {\n  if (isset($endpoints['/wp/v2/users'])) unset($endpoints['/wp/v2/users']);\n  return $endpoints;\n});`,
        fixExplanation: "Disable or restrict the /users REST endpoint. Use the Disable REST API plugin or custom filter.",
        tags: ["wordpress", "user-enumeration", "information-disclosure"],
        confidence: 0.95,
      });
    }
  }

  // ── 4. Plugin Discovery via /wp-content/plugins/ ──────────────────────────
  await addLog("info", "Enumerating WordPress plugins...");
  const discoveredPlugins: string[] = [];

  for (const plugin of COMMON_PLUGINS) {
    const pluginUrl = `${base}/wp-content/plugins/${plugin}/readme.txt`;
    const res = await safeFetch(pluginUrl, { timeoutMs: 4000 });
    if (res?.ok) {
      const text = await res.text().catch(() => "");
      const versionMatch = text.match(/Stable tag:\s*([\d.]+)/i);
      discoveredPlugins.push(plugin + (versionMatch ? ` v${versionMatch[1]}` : ""));
    }
  }

  if (discoveredPlugins.length > 0) {
    findings.push({
      title: "WordPress Plugin Enumeration Possible",
      description: `Plugin readme.txt files are publicly accessible. Discovered ${discoveredPlugins.length} plugins: ${discoveredPlugins.join(", ")}. Each plugin is a potential attack surface — version disclosure enables targeted CVE exploitation.`,
      endpoint: `${base}/wp-content/plugins/`,
      severity: "MEDIUM",
      cvss: "5.3",
      cwe: "CWE-200",
      owasp: "A05:2021 – Security Misconfiguration",
      evidence: `Active plugins: ${discoveredPlugins.join(", ")}`,
      pocCode: `for plugin in contact-form-7 woocommerce elementor; do\n  curl -s ${base}/wp-content/plugins/$plugin/readme.txt | grep "Stable tag"\ndone`,
      fixPatch: `# Block plugin readme.txt files (nginx)\nlocation ~* /wp-content/plugins/.+/readme\\.txt$ {\n    deny all;\n    return 403;\n}`,
      fixExplanation: "Block direct access to readme.txt files in wp-content. Keep all plugins updated to their latest versions.",
      tags: ["wordpress", "plugin-enumeration", "information-disclosure"],
      confidence: 0.9,
    });
  }

  // ── 5. Debug log exposure ──────────────────────────────────────────────────
  const debugRes = await safeFetch(`${base}/wp-content/debug.log`);
  if (debugRes?.ok) {
    const snippet = (await debugRes.text().catch(() => "")).slice(0, 500);
    findings.push({
      title: "WordPress Debug Log Publicly Accessible",
      description: "wp-content/debug.log is publicly readable. Debug logs often contain stack traces, database errors, file paths, and potentially credentials or API keys.",
      endpoint: `${base}/wp-content/debug.log`,
      severity: "HIGH",
      cvss: "7.5",
      cwe: "CWE-532",
      owasp: "A09:2021 – Security Logging and Monitoring Failures",
      evidence: snippet.slice(0, 200),
      pocCode: `curl -s ${base}/wp-content/debug.log | head -50`,
      fixPatch: `# Block debug.log (nginx)\nlocation = /wp-content/debug.log {\n    deny all;\n    return 403;\n}\n\n# Disable WP_DEBUG in production (wp-config.php)\ndefine('WP_DEBUG', false);\ndefine('WP_DEBUG_LOG', false);`,
      fixExplanation: "Disable WP_DEBUG in production and block direct access to debug.log. Never leave debug logging enabled on a live site.",
      tags: ["wordpress", "information-disclosure", "debug-log"],
      confidence: 0.98,
    });
  }

  await addLog("info", `WordPress module complete: ${findings.length} finding(s)`);
  return findings;
}
