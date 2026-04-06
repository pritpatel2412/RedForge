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
    <div className="min-h-screen bg-background p-6 md:p-12 animate-in fade-in duration-500">
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
    </div>
  );
}
