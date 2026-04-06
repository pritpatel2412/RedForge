import { useEffect, useRef } from "react";
import { Link, useParams } from "wouter";
import { useGetScan } from "@workspace/api-client-react";
import { ArrowLeft, Clock, ShieldAlert, Terminal, CheckCircle2, XCircle, GitMerge, Gauge } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { StatusBadge, SeverityBadge } from "@/components/Badges";
import { useScanLogs } from "@/hooks/use-scan-logs";

export default function ScanDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: scan, isLoading } = useGetScan(id);
  const { logs, connected, scanDone, liveStatus } = useScanLogs(id, scan?.status);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Use real-time status from SSE, fall back to fetched scan status
  const currentStatus = liveStatus?.status ?? scan?.status ?? "PENDING";
  const currentFindingsCount = liveStatus?.findingsCount ?? scan?.findingsCount ?? 0;
  const currentCriticalCount = liveStatus?.criticalCount ?? scan?.criticalCount ?? 0;
  const currentRiskScore = liveStatus?.riskScore ?? scan?.riskScore ?? null;

  const riskColor =
    currentRiskScore === null ? "text-zinc-400"
    : currentRiskScore >= 8 ? "text-red-500"
    : currentRiskScore >= 6 ? "text-orange-400"
    : currentRiskScore >= 4 ? "text-yellow-400"
    : "text-green-400";

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, scan?.logs]);

  if (isLoading) return <div className="skeleton h-96 rounded-2xl" />;
  if (!scan) return <div className="text-muted-foreground p-8">Scan not found</div>;

  const isComplete = currentStatus === "COMPLETED" || scanDone;
  const isFailed = currentStatus === "FAILED";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <Link href={`/projects/${scan.projectId}`} className="text-sm text-muted-foreground hover:text-white flex items-center gap-2 w-fit">
          <ArrowLeft className="w-4 h-4" /> Back to Project
        </Link>

        {isComplete && (
          <Link href={`/scans/${id}/attack-graph`}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all shadow-lg shadow-violet-500/20">
            <GitMerge className="w-4 h-4" />
            Attack Path Analysis
          </Link>
        )}
      </div>

      <div className="bg-card border border-border p-6 rounded-2xl grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="md:col-span-2">
          <h1 className="text-2xl font-bold text-white mb-4">Scan for {scan.projectName}</h1>
          <div className="flex items-center gap-4">
            <StatusBadge status={currentStatus} />
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="w-4 h-4" /> {formatDate(scan.createdAt)}
            </div>
          </div>
        </div>

        <div className="bg-background border border-border rounded-xl p-4 flex flex-col justify-center text-center">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Findings</div>
          <div className="text-3xl font-bold text-white">{currentFindingsCount}</div>
        </div>

        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex flex-col justify-center text-center">
          <div className="text-xs text-red-500/80 uppercase tracking-wider mb-1">Critical</div>
          <div className="text-3xl font-bold text-red-500 flex items-center justify-center gap-2">
            <ShieldAlert className="w-6 h-6" /> {currentCriticalCount}
          </div>
        </div>

        <div className="bg-background border border-border rounded-xl p-4 flex flex-col justify-center text-center">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Risk Score</div>
          <div className={`text-3xl font-bold flex items-center justify-center gap-2 ${riskColor}`}>
            <Gauge className="w-6 h-6" />
            {currentRiskScore !== null ? `${currentRiskScore.toFixed(1)}` : "—"}
          </div>
          {currentRiskScore !== null && (
            <div className="text-xs text-zinc-600 mt-0.5">out of 10</div>
          )}
        </div>
      </div>

      {(isComplete || isFailed) && (
        <div className={`flex items-center justify-between p-4 rounded-xl border font-semibold text-sm ${
          isFailed
            ? "bg-red-500/10 border-red-500/30 text-red-400"
            : "bg-green-500/10 border-green-500/30 text-green-400"
        }`}>
          <div className="flex items-center gap-3">
            {isFailed
              ? <><XCircle className="w-5 h-5" /> Scan failed — see logs for details</>
              : <><CheckCircle2 className="w-5 h-5" /> Scan complete — {scan.findingsCount} vulnerabilities identified</>
            }
          </div>
          {isComplete && (
            <Link href={`/scans/${id}/attack-graph`}
              className="flex items-center gap-1.5 text-violet-400 hover:text-violet-300 text-xs font-semibold transition-colors ml-4">
              <GitMerge className="w-3.5 h-3.5" /> View Attack Graph
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#0a0a0a] border border-border rounded-2xl overflow-hidden flex flex-col h-[500px]">
          <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-zinc-400 text-sm font-mono">
              <Terminal className="w-4 h-4" /> execution_logs.txt
            </div>
            <div className="flex items-center gap-2">
              {connected && (
                <span className="flex items-center gap-1.5 text-xs text-blue-400">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                  Live
                </span>
              )}
            </div>
          </div>
          <div className="p-4 flex-1 overflow-y-auto font-mono text-[13px] text-zinc-300 space-y-1.5 scrollbar-hide">
            {scan.logs.map(log => (
              <div key={log.id} className="flex gap-3">
                <span className="text-zinc-600 shrink-0 text-[11px] mt-0.5">
                  {new Date(log.createdAt).toISOString().split('T')[1].slice(0, 8)}
                </span>
                <span className={
                  log.level === 'ERROR' ? 'text-red-400' :
                  log.level === 'WARN' ? 'text-yellow-400' :
                  log.level === 'DEBUG' ? 'text-zinc-500' :
                  'text-zinc-300'
                }>
                  <span className="text-zinc-500 text-[11px] mr-2">[{log.level}]</span>{log.message}
                </span>
              </div>
            ))}
            {logs.map((log, i) => (
              <div key={`live-${i}`} className="flex gap-3">
                <span className="text-zinc-600 shrink-0 text-[11px] mt-0.5">
                  {new Date(log.createdAt).toISOString().split('T')[1].slice(0, 8)}
                </span>
                <span className={
                  log.level === 'ERROR' ? 'text-red-400' :
                  log.level === 'WARN' ? 'text-yellow-400' :
                  log.level === 'DEBUG' ? 'text-zinc-500' :
                  'text-green-400/90'
                }>
                  <span className="text-zinc-500 text-[11px] mr-2">[{log.level}]</span>{log.message}
                </span>
              </div>
            ))}
            {currentStatus === "RUNNING" && !scanDone && (
              <div className="text-blue-400 animate-pulse ml-[4.5rem]">▌</div>
            )}
            <div ref={logEndRef} />
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col h-[500px]">
          <div className="bg-muted border-b border-border px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-white">Identified Vulnerabilities</span>
            {scan.findings.length > 0 && (
              <span className="text-xs text-muted-foreground">{scan.findings.length} found</span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {scan.findings.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-6 text-center">
                {currentStatus === "RUNNING" || currentStatus === "PENDING" ? (
                  <div className="space-y-2">
                    <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
                    <p>Scanning in progress... findings will appear here.</p>
                  </div>
                ) : "No vulnerabilities found during this scan."}
              </div>
            ) : (
              scan.findings.map(f => (
                <Link key={f.id} href={`/findings/${f.id}`} className="block p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3 mb-1.5">
                    <SeverityBadge severity={f.severity} />
                    <span className="font-medium text-white truncate">{f.title}</span>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono truncate">{f.endpoint}</div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
