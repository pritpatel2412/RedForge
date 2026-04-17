import { Link } from "wouter";
import { ArrowLeft, GitCommit } from "lucide-react";

export default function Changelog() {
  const updates = [
    {
      version: "v2.1.0",
      date: "October 15, 2025",
      title: "Enhanced GraphQL Fuzzing",
      changes: [
        "Added deep introspection analysis for hidden mutations",
        "Improved false-positive detection rate by 40%",
        "New UI for detailed Proof of Concept code snippets"
      ]
    },
    {
      version: "v2.0.0",
      date: "September 01, 2025",
      title: "The AI Engine Rewrite",
      changes: [
        "Completely rebuilt the core scanning engine to utilize Claude 3.5 Sonnet",
        "Auto-generation of fix patches now available for Critical vulnerabilities",
        "Added real-time SSE log streaming to the Scan detail view",
        "New completely redesigned Dark Mode professional interface"
      ]
    }
  ];

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
        
        <h1 className="text-4xl font-bold text-white mb-4">Changelog</h1>
        <p className="text-xl text-muted-foreground mb-12">New updates and improvements to RedForge.</p>
        
        <div className="space-y-12">
          {updates.map(update => (
            <div key={update.version} className="relative pl-8 md:pl-0">
              <div className="md:grid md:grid-cols-4 md:gap-8">
                <div className="mb-4 md:mb-0 pt-1">
                  <div className="text-sm font-medium text-primary sticky top-24">{update.date}</div>
                  <div className="text-xs text-muted-foreground font-mono mt-1">{update.version}</div>
                </div>
                <div className="md:col-span-3 bg-card border border-border p-6 md:p-8 rounded-2xl relative">
                  <div className="absolute -left-12 md:-left-4 top-6 w-8 h-8 bg-background border border-border rounded-full flex items-center justify-center">
                    <GitCommit className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-4">{update.title}</h3>
                  <ul className="space-y-3">
                    {update.changes.map((change, i) => (
                      <li key={i} className="text-zinc-300 text-sm flex items-start gap-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        <span className="leading-relaxed">{change}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
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
