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
}

export type ScanMode = "PASSIVE" | "ACTIVE" | "CONTINUOUS";

export interface ScanContext {
  scanId: string;
  targetUrl: string;
  scanMode: ScanMode;
  reachable: boolean;
  httpStatus: number;
  resHeaders: Record<string, string>;
  bodyText: string;
  addLog: (level: string, message: string) => Promise<void>;
}
