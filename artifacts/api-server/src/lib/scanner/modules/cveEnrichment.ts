/**
 * CVE Enrichment Module (#7)
 * Queries the NVD (National Vulnerability Database) API for CVEs
 * matching detected software versions.
 */
import type { CveRecord } from "./types.js";

const NVD_API = "https://services.nvd.nist.gov/rest/json/cves/2.0";

// ─── Known version → CVE keyword map ─────────────────────────────────────────
// We query NVD with vendor+product+version keywords. Extend as needed.
const VERSION_PATTERNS: { pattern: RegExp; keyword: string; product: string }[] = [
  { pattern: /nginx\/([\d.]+)/i,           keyword: "nginx",         product: "nginx" },
  { pattern: /apache\/([\d.]+)/i,          keyword: "apache",        product: "apache" },
  { pattern: /php\/([\d.]+)/i,             keyword: "php",           product: "php" },
  { pattern: /wordpress\/([\d.]+)/i,       keyword: "wordpress",     product: "wordpress" },
  { pattern: /openssl\/([\d.]+)/i,         keyword: "openssl",       product: "openssl" },
  { pattern: /express\/([\d.]+)/i,         keyword: "express",       product: "expressjs" },
  { pattern: /node[.\/ ]v?([\d.]+)/i,      keyword: "node.js",       product: "node.js" },
  { pattern: /laravel[.\/ ]v?([\d.]+)/i,   keyword: "laravel",       product: "laravel" },
  { pattern: /django[.\/ ]([\d.]+)/i,      keyword: "django",        product: "django" },
  { pattern: /rails[.\/ ]v?([\d.]+)/i,     keyword: "ruby on rails", product: "ruby_on_rails" },
  { pattern: /jquery[.\/ ]v?([\d.]+)/i,    keyword: "jquery",        product: "jquery" },
];

// ─── Static CVE fallback library (used when NVD is rate-limited or unavailable)
const STATIC_CVE_MAP: Record<string, CveRecord[]> = {
  "nginx/1.24": [
    {
      cveId: "CVE-2023-44487",
      cvssV3Score: 7.5,
      severity: "HIGH",
      description: "HTTP/2 Rapid Reset Attack — allows remote attackers to cause denial of service by sending a series of RST_STREAM frames.",
      publishedDate: "2023-10-10",
      patchedVersion: "1.25.3",
      exploitAvailable: true,
      nvdUrl: "https://nvd.nist.gov/vuln/detail/CVE-2023-44487",
    },
    {
      cveId: "CVE-2021-23017",
      cvssV3Score: 7.7,
      severity: "HIGH",
      description: "Off-by-one error in the resolver allows remote DNS server to cause a 1-byte memory overwrite.",
      publishedDate: "2021-05-25",
      patchedVersion: "1.21.0",
      exploitAvailable: false,
      nvdUrl: "https://nvd.nist.gov/vuln/detail/CVE-2021-23017",
    },
  ],
  "nginx/1.18": [
    {
      cveId: "CVE-2021-23017",
      cvssV3Score: 7.7,
      severity: "HIGH",
      description: "Off-by-one error in the resolver allows remote DNS server to cause a 1-byte memory overwrite.",
      publishedDate: "2021-05-25",
      patchedVersion: "1.21.0",
      exploitAvailable: false,
      nvdUrl: "https://nvd.nist.gov/vuln/detail/CVE-2021-23017",
    },
  ],
  "apache/2.4": [
    {
      cveId: "CVE-2023-25690",
      cvssV3Score: 9.8,
      severity: "CRITICAL",
      description: "HTTP request splitting vulnerability in mod_proxy; allows SSRF and request smuggling.",
      publishedDate: "2023-03-07",
      patchedVersion: "2.4.56",
      exploitAvailable: true,
      nvdUrl: "https://nvd.nist.gov/vuln/detail/CVE-2023-25690",
    },
  ],
  "wordpress/6": [
    {
      cveId: "CVE-2023-2745",
      cvssV3Score: 6.4,
      severity: "MEDIUM",
      description: "Directory traversal in WordPress core allows Contributor+ roles to perform path traversal attacks.",
      publishedDate: "2023-05-17",
      patchedVersion: "6.2.1",
      exploitAvailable: false,
      nvdUrl: "https://nvd.nist.gov/vuln/detail/CVE-2023-2745",
    },
  ],
  "openssl/1.1": [
    {
      cveId: "CVE-2022-0778",
      cvssV3Score: 7.5,
      severity: "HIGH",
      description: "Infinite loop in BN_mod_sqrt() when parsing certificates with invalid explicit elliptic curve parameters.",
      publishedDate: "2022-03-15",
      patchedVersion: "1.1.1n",
      exploitAvailable: false,
      nvdUrl: "https://nvd.nist.gov/vuln/detail/CVE-2022-0778",
    },
  ],
  "jquery/3.": [
    {
      cveId: "CVE-2020-11022",
      cvssV3Score: 6.9,
      severity: "MEDIUM",
      description: "Cross-site scripting via passing HTML from untrusted sources to $() even after sanitizing it.",
      publishedDate: "2020-04-29",
      patchedVersion: "3.5.0",
      exploitAvailable: false,
      nvdUrl: "https://nvd.nist.gov/vuln/detail/CVE-2020-11022",
    },
  ],
};

async function queryNvd(keyword: string, version: string): Promise<CveRecord[]> {
  try {
    const params = new URLSearchParams({
      keywordSearch: `${keyword} ${version}`,
      resultsPerPage: "5",
      startIndex: "0",
    });
    const res = await fetch(`${NVD_API}?${params}`, {
      headers: { "User-Agent": "RedForge-Scanner/3.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];

    const json = await res.json() as any;
    const items = json?.vulnerabilities ?? [];

    return items.slice(0, 5).map((item: any) => {
      const cve = item.cve;
      const metrics = cve.metrics?.cvssMetricV31?.[0] || cve.metrics?.cvssMetricV30?.[0];
      const cvssData = metrics?.cvssData;
      const descs = cve.descriptions?.find((d: any) => d.lang === "en");
      return {
        cveId: cve.id,
        cvssV3Score: cvssData?.baseScore ?? 0,
        cvssV3Vector: cvssData?.vectorString,
        severity: cvssData?.baseSeverity || metrics?.baseSeverity || "UNKNOWN",
        description: descs?.value || "No description available",
        publishedDate: cve.published?.slice(0, 10) || "",
        exploitAvailable: false,
        nvdUrl: `https://nvd.nist.gov/vuln/detail/${cve.id}`,
      } as CveRecord;
    });
  } catch {
    return [];
  }
}

function staticLookup(versionString: string): CveRecord[] {
  const lower = versionString.toLowerCase();
  for (const [key, cves] of Object.entries(STATIC_CVE_MAP)) {
    if (lower.includes(key)) return cves;
  }
  return [];
}

/**
 * Extract version strings from scan body text and headers.
 * Returns enriched CVE records grouped by detected software.
 */
export async function enrichCVEs(
  bodyText: string,
  headers: Record<string, string>
): Promise<{ software: string; version: string; cves: CveRecord[] }[]> {
  const combined = bodyText.slice(0, 100000) + "\n" +
    Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join("\n");

  const results: { software: string; version: string; cves: CveRecord[] }[] = [];

  for (const { pattern, keyword, product } of VERSION_PATTERNS) {
    const match = combined.match(pattern);
    if (!match) continue;

    const fullVersion = match[0];
    const numericVersion = match[1];

    // Try NVD first, fall back to static if rate-limited
    let cves = await queryNvd(keyword, numericVersion);
    if (!cves.length) {
      cves = staticLookup(fullVersion.toLowerCase());
    }

    if (cves.length) {
      results.push({ software: product, version: fullVersion, cves });
    }
  }

  return results;
}

/**
 * Attach CVEs to findings that reference known software versions.
 */
export function attachCvesToFinding(
  findingTitle: string,
  findingEvidence: string | null | undefined,
  cveData: { software: string; version: string; cves: CveRecord[] }[]
): CveRecord[] {
  if (!cveData.length) return [];
  const combined = (findingTitle + " " + (findingEvidence || "")).toLowerCase();

  for (const { software, cves } of cveData) {
    if (combined.includes(software.toLowerCase()) || combined.includes("version")) {
      return cves;
    }
  }
  return [];
}
