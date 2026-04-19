export interface RemediationCode {
  language: string;           // "nginx", "apache", "express", "dns", "python", "javascript", etc.
  label: string;              // human-readable label e.g., "nginx.conf snippet"
  code: string;               // ready-to-paste code
}

export interface ComplianceMapping {
  gdpr?: string;              // e.g., "Art. 32 – Security of processing"
  pciDss?: string;            // e.g., "PCI DSS 6.6 – WAF requirement"
  iso27001?: string;          // e.g., "ISO 27001 A.14.2 – System security"
  owasp?: string;             // e.g., "A02:2021 – Cryptographic Failures"
  dpdp?: string;              // India DPDP Act, 2023 relevance
  cwe?: string;               // e.g., "CWE-319"
  nist?: string;              // e.g., "NIST SP800-53 SC-8"
}

export interface CveRecord {
  cveId: string;              // e.g., "CVE-2021-23017"
  cvssV3Score: number;
  cvssV3Vector?: string;
  severity: string;
  description: string;
  publishedDate: string;
  patchedVersion?: string;
  exploitAvailable: boolean;
  nvdUrl: string;
}

export interface ScoreBreakdown {
  baseCvss: number;
  automationBonus: number;    // +1.5 if FULLY_AUTOMATED
  noAuthBonus: number;        // +0.5 if no auth required
  chainMultiplier: number;    // counts of chained steps
  finalScore: number;
  explanation: string;
}

export interface FindingInput {
  title: string;
  description: string;
  endpoint: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  cvss?: string | null;
  cwe?: string | null;
  owasp?: string | null;
  pocCode?: string | null;
  fixPatch?: string | null;
  fixExplanation?: string | null;
  confidence?: number;
  evidence?: string | null;
  tags?: string[];

  // ─── v3.1 additions ──────────────────────────────────────────────────────
  remediationCode?: RemediationCode[];     // #1: ready-to-paste fix code snippets
  compliance?: ComplianceMapping;          // #9: GDPR / PCI / ISO / DPDP mapping
  cves?: CveRecord[];                      // #7: CVE enrichment from NVD
  taintFlows?: TaintFlow[];               // #5: DOM XSS source→sink confirmed pairs
  validationStatus?: "CONFIRMED" | "UNCONFIRMED" | "PENDING";  // #2: chain validation
}

export interface TaintFlow {
  source: string;     // e.g., "location.hash"
  sink: string;       // e.g., ".innerHTML"
  path: string;       // call-graph description
  confirmed: boolean;
}

export type ScanMode = "PASSIVE" | "ACTIVE" | "CONTINUOUS";

export interface ScanContext {
  scanId: string;
  projectId: string;
  projectData: any;
  workspacePlan?: "FREE" | "PRO" | "ENTERPRISE";
  targetUrl: string;
  hostname: string;
  scanMode: ScanMode;
  reachable: boolean;
  httpStatus: number;
  resHeaders: Record<string, string>;
  bodyText: string;
  technologies: string[];
  previousFindingTitles?: string[];       // #10: titles from last scan for diff
  addLog: (level: string, message: string) => Promise<void>;
  safeFetch: (url: string, opts?: RequestInit & { timeoutMs?: number }) => Promise<Response | null>;
}

/** Attack chain: multiple low/medium findings that combine into a high/critical exploit path */
export interface AttackChain {
  title: string;
  description: string;
  severity: "CRITICAL" | "HIGH";
  cvss: string;
  steps: string[];
  linkedFindings: string[];
  owasp: string;
  fixExplanation: string;
  scoreBreakdown?: ScoreBreakdown;        // #8: auditable score
}

/** Rule for correlating findings */
export interface CorrelationRule {
  id: string;
  requiredTags: string[][];
  chain: AttackChain;
}

/** #10: Scan diff result */
export interface ScanDiff {
  newFindings: string[];
  resolvedFindings: string[];
  regressions: string[];         // previously LOW, now HIGH etc.
  fixRate: number;               // 0–100 percentage
}
