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
    <div className="min-h-screen bg-background p-6 md:p-12 animate-in fade-in duration-500">
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
    </div>
  );
}
