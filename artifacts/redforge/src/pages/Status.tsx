import { Link } from "wouter";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

export default function Status() {
  const services = [
    { name: "API & Web App", status: "Operational", uptime: "99.99%" },
    { name: "Scanning Engine (US-East)", status: "Operational", uptime: "99.95%" },
    { name: "Scanning Engine (EU-Central)", status: "Operational", uptime: "99.98%" },
    { name: "AI Fix Generator", status: "Operational", uptime: "100%" },
    { name: "Webhooks & Notifications", status: "Operational", uptime: "99.99%" }
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
            <Link href="/changelog" className="text-muted-foreground hover:text-white transition-colors font-medium text-sm">Changelog</Link>
            <Link href="/status" className="text-white transition-colors font-medium text-sm">Status</Link>
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
        
        <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl mb-8">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-4 h-4 rounded-full bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)] animate-pulse" />
            <h1 className="text-3xl font-bold text-white">All Systems Operational</h1>
          </div>
          <p className="text-muted-foreground ml-8">Last updated: Just now</p>
        </div>
        
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="p-4 bg-muted border-b border-border flex justify-between text-sm font-semibold text-white px-6">
            <span>Service</span>
            <span>Uptime (30 days)</span>
          </div>
          <div className="divide-y divide-border">
            {services.map(s => (
              <div key={s.name} className="p-6 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="font-medium text-white">{s.name}</span>
                </div>
                <div className="text-sm font-mono text-muted-foreground">{s.uptime}</div>
              </div>
            ))}
          </div>
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
