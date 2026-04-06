import { useListScans } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Target, ArrowRight } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/Badges";

export default function ScanList() {
  const { data: scans, isLoading } = useListScans();

  if (isLoading) return <div className="skeleton h-96 rounded-2xl" />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">All Scans</h1>
        <p className="text-muted-foreground">Global history of penetration tests across all projects.</p>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="divide-y divide-border">
          {scans?.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No scans found.</div>
          ) : (
            scans?.map(scan => (
              <Link key={scan.id} href={`/scans/${scan.id}`} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 hover:bg-muted/50 transition-colors group gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <Target className="w-5 h-5 text-primary" />
                    <span className="font-bold text-white">{scan.projectName}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Started {formatDate(scan.startedAt || scan.createdAt)}
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                  <div className="flex gap-2 text-xs font-medium">
                    {scan.criticalCount > 0 && <span className="text-red-500 bg-red-500/10 px-2 py-1 rounded border border-red-500/20">{scan.criticalCount} C</span>}
                    {scan.highCount > 0 && <span className="text-orange-500 bg-orange-500/10 px-2 py-1 rounded border border-orange-500/20">{scan.highCount} H</span>}
                    <span className="text-muted-foreground bg-zinc-800 px-2 py-1 rounded border border-zinc-700">{scan.findingsCount} Total</span>
                  </div>
                  <StatusBadge status={scan.status} />
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors hidden sm:block" />
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
