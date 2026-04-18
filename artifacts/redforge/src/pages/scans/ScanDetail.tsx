import { useEffect, useRef, useState, useMemo } from "react";
import { Link, useParams } from "wouter";
import { useGetScan } from "@workspace/api-client-react";
import {
  ArrowLeft, Clock, ShieldAlert, Terminal, CheckCircle2,
  XCircle, GitMerge, Gauge, Copy, Check, WifiOff,
  AlertTriangle, Info, Bug, AlertOctagon, ChevronRight,
  Sparkles, ZapOff
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { StatusBadge, SeverityBadge } from "@/components/Badges";
import { useScanLogs } from "@/hooks/use-scan-logs";

// ── Level config ──────────────────────────────────────────────────────────────
const LEVELS = {
  INFO:  { bg: "bg-blue-500/15",  text: "text-blue-400",  border: "border-blue-500/30",  icon: Info,          msg: "text-zinc-200" },
  WARN:  { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30", icon: AlertTriangle, msg: "text-amber-100/90" },
  ERROR: { bg: "bg-red-500/15",   text: "text-red-400",   border: "border-red-500/30",   icon: AlertOctagon,  msg: "text-red-300" },
  DEBUG: { bg: "bg-zinc-700/30",  text: "text-zinc-500",  border: "border-zinc-700/40",  icon: Bug,           msg: "text-zinc-500" },
} as const;
type Level = keyof typeof LEVELS;

interface LogEntry { id?: string; createdAt: string; level: string; message: string; live?: boolean }

function isBanner(msg: string) { return /^[╔╚╠║]/.test(msg.trim()); }
function isPhaseHeader(msg: string) {
  return /^Phase\s+\d+[\s.]/i.test(msg.trim());
}

// ── Single log row ────────────────────────────────────────────────────────────
function LogRow({ log, lineNo }: { log: LogEntry; lineNo: number }) {
  const lvl = (log.level?.toUpperCase() as Level) || "INFO";
  const cfg = LEVELS[lvl] ?? LEVELS.INFO;
  const Icon = cfg.icon;
  const msg = log.message || "";

  if (isPhaseHeader(msg)) {
    return (
      <div
        className="flex items-center gap-3 py-2.5 px-4 my-1 border-t border-b border-primary/15"
        style={{ background: "linear-gradient(90deg, hsl(348,83%,45%,0.06) 0%, transparent 60%)" }}
      >
        <ChevronRight className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-xs font-bold text-primary/90 tracking-wide uppercase">{msg}</span>
      </div>
    );
  }

  if (isBanner(msg)) {
    return <div className="px-4 py-0.5 font-mono text-[11px] text-zinc-700 select-none">{msg}</div>;
  }

  return (
    <div
      className={`flex items-start gap-3 px-4 py-1.5 group hover:bg-white/[0.025] transition-colors ${
        log.live ? "border-l-2 border-blue-500/40" : ""
      }`}
    >
      <span className="text-[10px] text-zinc-700 font-mono shrink-0 w-7 text-right mt-0.5 select-none group-hover:text-zinc-600">
        {lineNo}
      </span>
      <span className="text-[11px] text-zinc-600 font-mono shrink-0 mt-0.5 w-[52px]">
        {new Date(log.createdAt).toISOString().split("T")[1].slice(0, 8)}
      </span>
      <span
        className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 mt-0.5 ${cfg.bg} ${cfg.text} ${cfg.border}`}
      >
        <Icon className="w-2.5 h-2.5" />
        {lvl}
      </span>
      <span className={`text-[12.5px] font-mono leading-5 break-all ${cfg.msg}`}>{msg}</span>
    </div>
  );
}

// ── Filter tab ────────────────────────────────────────────────────────────────
function FilterTab({ label, count, active, onClick, color }: {
  label: string; count: number; active: boolean; onClick: () => void; color: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
        active ? `${color} border-current/30` : "text-zinc-600 border-transparent hover:text-zinc-400 hover:border-zinc-700"
      }`}
    >
      {label}
      <span className={`text-[10px] px-1 rounded ${active ? "bg-white/10" : "bg-zinc-800"}`}>{count}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ScanDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: scan, isLoading } = useGetScan(id);
  const { logs, connected, scanDone, liveStatus } = useScanLogs(id, scan?.status);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<"ALL" | Level>("ALL");
  const [copied, setCopied] = useState(false);

  const currentStatus        = (liveStatus as any)?.status        ?? (scan as any)?.status        ?? "PENDING";
  const currentFindingsCount = (liveStatus as any)?.findingsCount ?? (scan as any)?.findingsCount ?? 0;
  const currentCriticalCount = (liveStatus as any)?.criticalCount ?? (scan as any)?.criticalCount ?? 0;
  const currentRiskScore     = (liveStatus as any)?.riskScore     ?? (scan as any)?.riskScore     ?? null;

  const riskColor =
    currentRiskScore === null ? "text-zinc-400"
    : currentRiskScore >= 8   ? "text-red-500"
    : currentRiskScore >= 6   ? "text-orange-400"
    : currentRiskScore >= 4   ? "text-yellow-400"
    : "text-green-400";

  // Merge stored + live, dedup by id
  const allLogs: LogEntry[] = useMemo(() => {
    const stored = (scan?.logs ?? []).map((l: any) => ({ ...l, live: false }));
    const live   = logs.map((l: any) => ({ ...l, live: true }));
    const ids = new Set(stored.map((l: any) => l.id).filter(Boolean));
    return [...stored, ...live.filter((l: any) => !l.id || !ids.has(l.id))];
  }, [scan?.logs, logs]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { INFO: 0, WARN: 0, ERROR: 0, DEBUG: 0 };
    allLogs.forEach(l => { const k = l.level?.toUpperCase(); if (k && k in c) c[k]++; });
    return c;
  }, [allLogs]);

  const filtered = useMemo(
    () => filter === "ALL" ? allLogs : allLogs.filter(l => l.level?.toUpperCase() === filter),
    [allLogs, filter]
  );

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [filtered.length]);

  const handleCopy = () => {
    navigator.clipboard.writeText(
      allLogs.map(l => `${new Date(l.createdAt).toISOString().split("T")[1].slice(0, 8)} [${l.level}] ${l.message}`).join("\n")
    ).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  if (isLoading) return <div className="skeleton h-96 rounded-2xl" />;
  if (!scan) return <div className="text-muted-foreground p-8">Scan not found</div>;

  const isComplete = currentStatus === "COMPLETED" || scanDone;
  const isFailed   = currentStatus === "FAILED";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Back / Attack Path */}
      <div className="flex items-center justify-between">
        <Link href={`/projects/${scan.projectId}`} className="text-sm text-muted-foreground hover:text-white flex items-center gap-2 w-fit">
          <ArrowLeft className="w-4 h-4" /> Back to Project
        </Link>
        {isComplete && (
          <Link href={`/scans/${id}/attack-graph`}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all shadow-lg shadow-violet-500/20">
            <GitMerge className="w-4 h-4" /> Attack Path Analysis
          </Link>
        )}
      </div>

      {/* Stats header */}
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
            {currentRiskScore !== null ? currentRiskScore.toFixed(1) : "—"}
          </div>
          {currentRiskScore !== null && <div className="text-xs text-zinc-600 mt-0.5">out of 10</div>}
        </div>
      </div>

      {/* Status banner */}
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

      {/* ── Split: log viewer + findings ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Log viewer */}
        <div
          className="rounded-2xl border border-border overflow-hidden flex flex-col h-[600px]"
          style={{ background: "oklch(6% 0 0)" }}
        >
          {/* Toolbar */}
          <div
            className="border-b border-zinc-800 px-3 py-2.5 flex items-center gap-2 shrink-0"
            style={{ background: "oklch(8% 0 0)" }}
          >
            <Terminal className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span className="text-xs text-zinc-400 font-mono font-semibold mr-auto">execution_logs.txt</span>

            {connected ? (
              <span className="flex items-center gap-1.5 text-[11px] text-blue-400 font-medium">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                </span>
                Live
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-zinc-600">
                <WifiOff className="w-3 h-3" /> Offline
              </span>
            )}

            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all border border-transparent hover:border-zinc-700"
            >
              {copied
                ? <><Check className="w-3 h-3 text-green-400" /> Copied</>
                : <><Copy className="w-3 h-3" /> Copy</>
              }
            </button>
          </div>

          {/* Filter tabs */}
          <div
            className="border-b border-zinc-800/60 px-3 py-1.5 flex items-center gap-1 shrink-0"
            style={{ background: "oklch(7% 0 0)" }}
          >
            <FilterTab label="ALL"   count={allLogs.length} active={filter === "ALL"}   onClick={() => setFilter("ALL")}   color="text-zinc-300" />
            <FilterTab label="INFO"  count={counts.INFO}    active={filter === "INFO"}  onClick={() => setFilter("INFO")}  color="text-blue-400" />
            <FilterTab label="WARN"  count={counts.WARN}    active={filter === "WARN"}  onClick={() => setFilter("WARN")}  color="text-amber-400" />
            <FilterTab label="ERROR" count={counts.ERROR}   active={filter === "ERROR"} onClick={() => setFilter("ERROR")} color="text-red-400" />
            <FilterTab label="DEBUG" count={counts.DEBUG}   active={filter === "DEBUG"} onClick={() => setFilter("DEBUG")} color="text-zinc-500" />
            <span className="ml-auto text-[10px] text-zinc-700 font-mono">{filtered.length} lines</span>
          </div>

          {/* Log lines */}
          <div className="flex-1 overflow-y-auto py-2 scrollbar-hide">
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center h-full text-zinc-700 text-sm font-mono">
                No logs yet
              </div>
            ) : (
              filtered.map((log, i) => <LogRow key={log.id ?? `l-${i}`} log={log} lineNo={i + 1} />)
            )}
            {currentStatus === "RUNNING" && !scanDone && (
              <div className="px-4 py-1 text-blue-400 text-sm animate-pulse font-mono">▌</div>
            )}
            <div ref={logEndRef} />
          </div>
        </div>

        {/* Findings panel */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col h-[600px]">
          <div className="bg-muted border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
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
                    <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
                    <p>Scanning in progress… findings will appear here.</p>
                  </div>
                ) : "No vulnerabilities found during this scan."}
              </div>
            ) : (
              scan.findings.map(f => (
                <Link key={f.id} href={`/findings/${f.id}`} className="block p-4 hover:bg-muted/50 transition-colors relative group">
                  {f.isNew && (
                    <div className="absolute top-4 right-4 flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 uppercase tracking-tight">
                      <Sparkles className="w-2.5 h-2.5" /> New
                    </div>
                  )}
                  <div className="flex items-center gap-3 mb-1.5">
                    <SeverityBadge severity={f.severity} />
                    <span className="font-medium text-white truncate pr-12">{f.title}</span>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono truncate">{f.endpoint}</div>
                </Link>
              ))
            )}

            {/* Resolved findings section */}
            {scan.resolvedFindings && scan.resolvedFindings.length > 0 && (
              <div className="mt-4 border-t border-dashed border-border/50">
                <div className="bg-emerald-500/5 px-4 py-2 border-b border-border/50 flex items-center gap-2">
                  <ZapOff className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px] font-bold text-emerald-400/90 uppercase tracking-wider">Resolved since last scan</span>
                </div>
                <div className="divide-y divide-border/30 opacity-60 grayscale-[0.5]">
                  {scan.resolvedFindings.map((f: any) => (
                    <div key={`resolved-${f.id}`} className="p-4 bg-emerald-500/[0.02]">
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-bold text-zinc-500 border border-zinc-700 uppercase">{f.severity}</span>
                        <span className="font-medium text-zinc-400 truncate line-through decoration-emerald-500/30">{f.title}</span>
                      </div>
                      <div className="text-[10px] text-zinc-600 font-mono truncate">{f.endpoint}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
