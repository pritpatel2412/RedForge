import { Link } from "wouter";
import { ArrowLeft, GitCommit, Cpu, Shield, Zap, Link2 } from "lucide-react";

const BADGE_COLORS: Record<string, string> = {
  major:   "bg-primary/12 border-primary/30 text-primary",
  minor:   "bg-violet-500/12 border-violet-500/30 text-violet-400",
  fix:     "bg-amber-500/12 border-amber-500/30 text-amber-400",
  security:"bg-emerald-500/12 border-emerald-500/30 text-emerald-400",
};

const BADGE_LABELS: Record<string, string> = {
  major:   "MAJOR",
  minor:   "MINOR",
  fix:     "FIX",
  security:"SECURITY",
};

const UPDATES = [
  {
    version: "v3.0.0",
    date: "April 18, 2026",
    type: "major",
    title: "Security Engine v3 — Parallel Orchestration & Attack Chain Correlation",
    icon: Cpu,
    changes: [
      "Complete orchestration engine rewrite — all 10 modules now run in parallel via Promise.all for significantly faster scan times",
      "New Attack Chain Correlation Engine: automatically links individual findings into multi-stage exploit paths (CRITICAL severity chains)",
      "7 attack chain templates: XSS→Session Hijacking, SSRF→Cloud Credential Theft, Subdomain Takeover→CORS, Credential Stuffing, TLS Downgrade MITM, and more",
      "Confidence-weighted risk scoring — attack chain findings carry double weight, raising risk score accuracy",
      "Module 7 — XSS Detection: reflected XSS probing with reflection verification, DOM-based source/sink analysis (17 sources, 14 sinks), error-page XSS",
      "Module 8 — SSRF & Open Redirect: active redirect parameter probing (22 params, 5 bypass payloads), SSRF indicator detection, meta-refresh analysis",
      "Module 9 — DNS Security: SPF/DMARC/CAA verification via DNS-over-HTTPS, Certificate Transparency subdomain enumeration, dangling CNAME / subdomain takeover detection",
      "Module 10 — API Security: WAF fingerprinting (11 vendors), HTTP method enumeration + TRACE/XST detection, GraphQL introspection, 20 debug endpoints, directory traversal probing",
      "Technology fingerprinting phase — 17-signature detection (Next.js, React, Django, Laravel, Rails, Cloudflare, AWS, Vercel, Supabase, etc.) feeds context to all modules",
      "Crash-isolated module execution — individual module failures no longer abort full scans",
      "Finding deduplication with endpoint merging across all active modules",
      "AI model upgraded to NVIDIA Nemotron-70b-instruct (RLHF fine-tuned, superior security reasoning vs. base Llama)"
    ]
  },
  {
    version: "v2.2.0",
    date: "April 17, 2026",
    type: "fix",
    title: "Production Stability — OAuth, Routing & Vercel Build Fixes",
    icon: Shield,
    changes: [
      "Fixed Google OAuth failures on Vercel — enforced APP_URL for canonical callback URLs instead of inferring from request headers",
      "Auth session cookies now set with Secure: true on HTTPS environments, fixing silent drop on Vercel",
      "Resolved 404 errors on /channel and /status routes — all traffic now routed through Express.js SPA handler",
      "Eliminated Vercel TypeScript build errors by refactoring api/index.ts to import only built dist artifacts",
      "Fixed NVIDIA NIM 404 — invalid model zhipuai/glm-5-plus replaced with confirmed NIM catalog models"
    ]
  },
  {
    version: "v2.1.0",
    date: "April 15, 2026",
    type: "minor",
    title: "Hardened Scanning Modules + New Type System",
    icon: Zap,
    changes: [
      "Extended ScanContext type with hostname, technologies array, shared safeFetch, and new AttackChain/CorrelationRule types",
      "Headers module: added 13 security header checks including Permissions-Policy, Cross-Origin headers, and COEP/COOP",
      "TLS/Cookies module: tagged cookie findings (httponly, ssl, tls, csrf) for correlation engine compatibility",
      "Auth security module: tagged CAPTCHA and MFA findings for credential stuffing chain detection",
      "Supply chain module: improved SRI validation for CDN-hosted scripts"
    ]
  },
  {
    version: "v2.0.0",
    date: "April 10, 2026",
    type: "major",
    title: "AI Engine Rewrite — NVIDIA NIM Integration",
    icon: Link2,
    changes: [
      "Rebuilt the core scanning engine with a modular, phase-based architecture",
      "Integrated NVIDIA NIM API for AI-powered deep analysis phase",
      "Auto-generation of fix patches and exploit PoC code for all findings",
      "Real-time SSE log streaming to Scan detail view — watch every probe live",
      "Completely redesigned dark-mode professional interface",
      "Slack webhook integration for Critical finding instant alerts",
      "CORS reflection detection (wildcard and reflected-origin variants)",
      "Added CVSS scores, CWE identifiers, and OWASP category mapping to all findings"
    ]
  }
];

export default function Changelog() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden animate-in fade-in duration-500">
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="orb absolute top-1/3 -right-60 w-[500px] h-[500px] bg-violet-600" style={{ opacity: 0.04 }} />
        <div className="orb absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-orange-600" style={{ opacity: 0.04 }} />
      </div>

      <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none" style={{ paddingTop: "16px" }}>
        <header
          className="pointer-events-auto w-full mx-4 flex items-center justify-between"
          style={{
            maxWidth: "1200px",
            padding: "12px 24px",
            borderRadius: "20px",
            background: "oklch(8% 0 0 / 0.88)",
            backdropFilter: "blur(20px) saturate(1.4)",
            border: "1px solid oklch(100% 0 0 / 0.10)",
            boxShadow: "0 4px 32px oklch(0% 0 0 / 0.4)",
          }}
        >
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="flex items-center justify-center shrink-0 w-[34px] h-[34px]">
              <img src="/logo.png" alt="RedForge" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold tracking-tight text-white text-[17px]">RedForge</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
              BETA
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-7">
            <Link href="/#features" className="text-muted-foreground hover:text-white transition-colors font-medium text-sm">Features</Link>
            <Link href="/#pricing" className="text-muted-foreground hover:text-white transition-colors font-medium text-sm">Pricing</Link>
            <Link href="/changelog" className="text-white transition-colors font-medium text-sm">Changelog</Link>
            <Link href="/status" className="text-muted-foreground hover:text-white transition-colors font-medium text-sm">Status</Link>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <Link href="/signin" className="font-medium text-muted-foreground hover:text-white transition-colors text-sm px-3 py-2">Sign In</Link>
            <Link href="/signup" className="rounded-full bg-primary text-white font-semibold hover:bg-primary/90 glow-red-sm hover:glow-red transition-all duration-300 whitespace-nowrap text-sm px-5 py-2">
              Start Free Trial
            </Link>
          </div>
        </header>
      </div>

      <main className="relative z-10 flex-1 p-6 md:p-12 pt-32">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="text-sm text-muted-foreground hover:text-white flex items-center gap-2 w-fit mb-8">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>

          <div className="mb-12">
            <h1 className="text-4xl font-bold text-white mb-3">Changelog</h1>
            <p className="text-lg text-muted-foreground">
              New updates and improvements to RedForge.{" "}
              <span className="text-primary font-semibold">Engine v3.0 is now live.</span>
            </p>
          </div>

          <div className="space-y-12">
            {UPDATES.map((update) => {
              const Icon = update.icon;
              return (
                <div key={update.version} className="relative pl-8 md:pl-0">
                  <div className="md:grid md:grid-cols-4 md:gap-8">
                    <div className="mb-4 md:mb-0 pt-1">
                      <div className="text-sm font-medium text-primary sticky top-24">{update.date}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-1">{update.version}</div>
                      <span className={`inline-flex mt-2 items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wide ${BADGE_COLORS[update.type]}`}>
                        {BADGE_LABELS[update.type]}
                      </span>
                    </div>
                    <div className="md:col-span-3 bg-card border border-border p-6 md:p-8 rounded-2xl relative hover:border-white/15 transition-colors duration-200">
                      <div className="absolute -left-12 md:-left-4 top-6 w-8 h-8 bg-background border border-border rounded-full flex items-center justify-center">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-5">{update.title}</h3>
                      <ul className="space-y-3">
                        {update.changes.map((change, i) => (
                          <li key={i} className="text-zinc-300 text-sm flex items-start gap-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                            <span className="leading-relaxed">{change}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-16 p-6 rounded-2xl border border-white/8 bg-card text-center">
            <p className="text-sm text-muted-foreground mb-1">Want to see what's coming next?</p>
            <a href="mailto:try.prit24@gmail.com" className="text-primary hover:underline text-sm font-medium">
              Contact us for early access to upcoming features →
            </a>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/6 py-10 px-6" style={{ background: "oklch(5% 0 0)" }}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">© 2026 RedForge, Inc. All rights reserved.</p>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-muted-foreground">All systems operational</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
