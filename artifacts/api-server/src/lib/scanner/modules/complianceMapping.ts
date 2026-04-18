/**
 * Compliance Mapping Engine (#9)
 * Maps findings to GDPR, PCI DSS, ISO 27001, DPDP Act (India), and NIST controls.
 */
import type { FindingInput, ComplianceMapping } from "./types.js";

// ─── Compliance Rule Library ──────────────────────────────────────────────────

interface ComplianceRule {
  tags?: string[];
  titleKeywords?: string[];
  mapping: ComplianceMapping;
}

const COMPLIANCE_RULES: ComplianceRule[] = [
  // TLS / Encryption
  {
    tags: ["hsts", "tls", "ssl", "https"],
    titleKeywords: ["tls", "ssl", "hsts", "https", "encryption", "certificate"],
    mapping: {
      gdpr: "Art. 32 – Security of processing (encryption in transit)",
      pciDss: "PCI DSS 4.2.1 – Encrypt transmission of cardholder data",
      iso27001: "ISO 27001 A.10.1 – Cryptography controls",
      nist: "NIST SP800-53 SC-8 – Transmission Confidentiality and Integrity",
      dpdp: "DPDP Act 2023 § 8(4) – Data fiduciary security obligations",
    },
  },
  // Authentication
  {
    tags: ["auth", "brute-force", "captcha", "mfa", "rate-limit"],
    titleKeywords: ["login", "password", "authentication", "brute force", "captcha", "mfa"],
    mapping: {
      gdpr: "Art. 32 – Appropriate technical measures to ensure data security",
      pciDss: "PCI DSS 8.2 – Identify users and authenticate access",
      iso27001: "ISO 27001 A.9.4 – System and application access control",
      nist: "NIST SP800-53 IA-5 – Authenticator Management",
      dpdp: "DPDP Act 2023 § 8(4) – Reasonable security safeguards",
    },
  },
  // XSS
  {
    tags: ["xss", "reflected", "dom-xss", "stored-xss"],
    titleKeywords: ["xss", "cross-site scripting"],
    mapping: {
      gdpr: "Art. 32(2) – Ongoing confidentiality of processing systems",
      pciDss: "PCI DSS 6.3.2 – Protect web applications from known vulnerabilities",
      iso27001: "ISO 27001 A.14.2.1 – Secure development policy",
      nist: "NIST SP800-53 SI-10 – Information Input Validation",
      dpdp: "DPDP Act 2023 § 8(4) – Prevent unauthorized access to personal data",
    },
  },
  // SQL Injection / Injection
  {
    tags: ["sqli", "injection"],
    titleKeywords: ["sql injection", "injection"],
    mapping: {
      gdpr: "Art. 32 – Technical measures to ensure data integrity",
      pciDss: "PCI DSS 6.3.1 – Protect against injection vulnerabilities (OWASP A03)",
      iso27001: "ISO 27001 A.14.2.5 – Secure system engineering principles",
      nist: "NIST SP800-53 SI-10 – Information Input Validation",
      dpdp: "DPDP Act 2023 § 8(4) – Protection of personal data from unauthorized access",
    },
  },
  // CSRF
  {
    tags: ["csrf"],
    titleKeywords: ["csrf", "cross-site request forgery"],
    mapping: {
      gdpr: "Art. 25 – Data protection by design and by default",
      pciDss: "PCI DSS 6.3.2 – Address common vulnerabilities",
      iso27001: "ISO 27001 A.14.2.1 – Secure development policy",
      nist: "NIST SP800-53 SC-23 – Session Authenticity",
    },
  },
  // Cookies
  {
    tags: ["cookie", "httponly", "secure"],
    titleKeywords: ["cookie", "session", "httponly", "secure flag"],
    mapping: {
      gdpr: "Art. 5(1)(f) – Integrity and confidentiality of processing",
      pciDss: "PCI DSS 6.3.3 – All software components protected from known vulnerabilities",
      iso27001: "ISO 27001 A.9.4.2 – Secure log-on procedures",
      nist: "NIST SP800-53 SC-23 – Session Authenticity",
      dpdp: "DPDP Act 2023 § 8(4) – Implement security safeguards",
    },
  },
  // CORS
  {
    tags: ["cors"],
    titleKeywords: ["cors", "cross-origin"],
    mapping: {
      gdpr: "Art. 32 – Technical measures for data security",
      pciDss: "PCI DSS 6.3.2 – Common web application vulnerabilities",
      iso27001: "ISO 27001 A.13.1 – Network security management",
      nist: "NIST SP800-53 AC-4 – Information Flow Enforcement",
    },
  },
  // Information Disclosure
  {
    tags: ["information-disclosure", "version-exposure", "debug-log"],
    titleKeywords: ["disclosure", "exposed", "version", "server header", "debug", "stack trace"],
    mapping: {
      gdpr: "Art. 32(2) – Ensure ongoing confidentiality of processing systems",
      pciDss: "PCI DSS 2.2.1 – Implement only necessary services",
      iso27001: "ISO 27001 A.18.1.3 – Protection of records",
      nist: "NIST SP800-53 SI-12 – Information Management",
      dpdp: "DPDP Act 2023 § 8(1) – Accurate and complete personal data",
    },
  },
  // DNS / Email Security
  {
    tags: ["spf", "dmarc", "dkim", "email"],
    titleKeywords: ["spf", "dmarc", "dkim", "email security", "email spoofing"],
    mapping: {
      gdpr: "Art. 32 – Technical measures to ensure security (phishing prevention)",
      pciDss: "PCI DSS 12.5.2 – Protect against social engineering attacks",
      iso27001: "ISO 27001 A.13.2.3 – Electronic messaging",
      nist: "NIST SP800-53 SI-8 – Spam Protection",
      dpdp: "DPDP Act 2023 § 8(4) – Protect personal data from phishing/social engineering",
    },
  },
  // SSRF
  {
    tags: ["ssrf"],
    titleKeywords: ["ssrf", "server-side request forgery"],
    mapping: {
      gdpr: "Art. 32 – Technical security measures",
      pciDss: "PCI DSS 6.3.2 – Common web application attack patterns",
      iso27001: "ISO 27001 A.13.1.3 – Segregation in networks",
      nist: "NIST SP800-53 AC-4 – Information Flow Enforcement",
      dpdp: "DPDP Act 2023 § 8(4) – Protect data from unauthorized access via intermediaries",
    },
  },
  // Supply Chain
  {
    tags: ["sri", "cdn", "third-party"],
    titleKeywords: ["subresource integrity", "sri", "cdn", "third-party script"],
    mapping: {
      gdpr: "Art. 28 – Processor obligations; Art. 32 – Appropriate security measures",
      pciDss: "PCI DSS 6.3.3 – All software components from trusted sources",
      iso27001: "ISO 27001 A.15.2 – Supplier service delivery management",
      nist: "NIST SP800-53 SA-12 – Supply Chain Protection",
    },
  },
  // Open Redirect
  {
    tags: ["open-redirect"],
    titleKeywords: ["open redirect", "redirect"],
    mapping: {
      gdpr: "Art. 32 – Technical measures for data security (phishing via redirects)",
      pciDss: "PCI DSS 6.3.2 – Open redirects as OWASP Top 10 pattern",
      iso27001: "ISO 27001 A.14.2.1 – Secure development policy",
      nist: "NIST SP800-53 SI-10 – Input Validation",
    },
  },
  // Access Control
  {
    tags: ["idor", "access-control"],
    titleKeywords: ["idor", "access control", "authorization", "privilege"],
    mapping: {
      gdpr: "Art. 5(1)(f) – Integrity and confidentiality; Art. 32 – Technical measures",
      pciDss: "PCI DSS 7.2 – Establish access control system",
      iso27001: "ISO 27001 A.9.1 – Access control policy",
      nist: "NIST SP800-53 AC-3 – Access Enforcement",
      dpdp: "DPDP Act 2023 § 6 – Valid consent and purpose limitation",
    },
  },
  // Security Headers (catch-all)
  {
    tags: ["headers", "missing-header"],
    titleKeywords: ["missing", "header", "permissions-policy"],
    mapping: {
      gdpr: "Art. 25 – Data protection by design and by default",
      pciDss: "PCI DSS 6.3.2 – Security configuration standards",
      iso27001: "ISO 27001 A.14.1.2 – Securing application services on public networks",
      nist: "NIST SP800-53 SC-5 – Denial of Service Protection; SC-8 – Transmission Integrity",
    },
  },
];

export function enrichWithCompliance(findings: FindingInput[]): FindingInput[] {
  return findings.map(finding => {
    if (finding.compliance) return finding; // already mapped

    const titleLower = finding.title.toLowerCase();
    const findingTags = finding.tags || [];

    for (const rule of COMPLIANCE_RULES) {
      const tagMatch   = rule.tags?.some(t => findingTags.includes(t));
      const titleMatch = rule.titleKeywords?.some(kw => titleLower.includes(kw));

      if (tagMatch || titleMatch) {
        return {
          ...finding,
          compliance: {
            ...rule.mapping,
            owasp: finding.owasp || rule.mapping.owasp,
            cwe: finding.cwe    || rule.mapping.cwe,
          },
        };
      }
    }
    return finding;
  });
}
