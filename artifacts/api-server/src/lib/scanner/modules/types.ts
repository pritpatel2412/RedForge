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
  confidence?: number;        // 0.0–1.0 confidence score
  evidence?: string | null;   // raw response data proving the finding
  tags?: string[];             // e.g. ["xss", "reflected", "param:q"]
}

export type ScanMode = "PASSIVE" | "ACTIVE" | "CONTINUOUS";

export interface ScanContext {
  scanId: string;
  targetUrl: string;
  hostname: string;
  scanMode: ScanMode;
  reachable: boolean;
  httpStatus: number;
  resHeaders: Record<string, string>;
  bodyText: string;
  technologies: string[];
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
  linkedFindings: string[];   // titles of constituent findings
  owasp: string;
  fixExplanation: string;
}

/** Rule for correlating findings */
export interface CorrelationRule {
  id: string;
  requiredTags: string[][];   // OR-groups: [[tag1a, tag1b], [tag2]] = (tag1a OR tag1b) AND tag2
  chain: AttackChain;
}
