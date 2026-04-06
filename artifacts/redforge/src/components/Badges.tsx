import { cn } from "@/lib/utils";

const SEVERITY_CONFIG = {
  CRITICAL: {
    dot: "bg-red-500",
    className: "bg-red-500/8 text-red-400 border-red-500/25 shadow-[0_0_12px_hsl(0_84%_60%_/_0.15)]"
  },
  HIGH: {
    dot: "bg-orange-500",
    className: "bg-orange-500/8 text-orange-400 border-orange-500/25"
  },
  MEDIUM: {
    dot: "bg-yellow-500",
    className: "bg-yellow-500/8 text-yellow-400 border-yellow-500/25"
  },
  LOW: {
    dot: "bg-blue-500",
    className: "bg-blue-500/8 text-blue-400 border-blue-500/25"
  },
  INFO: {
    dot: "bg-zinc-500",
    className: "bg-zinc-800/50 text-zinc-400 border-zinc-700/50"
  },
};

export function SeverityBadge({ severity }: { severity: string }) {
  const config = SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.INFO;
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border",
      config.className
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", config.dot)} />
      {severity}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const isRunning = status === "RUNNING";

  const config: Record<string, string> = {
    PENDING: "bg-yellow-500/8 text-yellow-400 border-yellow-500/25",
    RUNNING: "bg-blue-500/8 text-blue-400 border-blue-500/25",
    COMPLETED: "bg-emerald-500/8 text-emerald-400 border-emerald-500/25",
    FAILED: "bg-red-500/8 text-red-400 border-red-500/25",
  };
  const className = config[status] || "bg-zinc-800/50 text-zinc-400 border-zinc-700/50";

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold tracking-wide border",
      className
    )}>
      {isRunning
        ? <span className="w-1.5 h-1.5 rounded-full bg-blue-500 live-pulse shrink-0" />
        : <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0 opacity-70" />
      }
      {status}
    </span>
  );
}

export function FindingStatusBadge({ status }: { status: string }) {
  const config: Record<string, string> = {
    OPEN: "bg-red-500/8 text-red-400 border-red-500/20",
    IN_PROGRESS: "bg-blue-500/8 text-blue-400 border-blue-500/20",
    FIXED: "bg-emerald-500/8 text-emerald-400 border-emerald-500/20",
    WONT_FIX: "bg-zinc-800/50 text-zinc-400 border-zinc-700/50",
    FALSE_POSITIVE: "bg-zinc-800/50 text-zinc-400 border-zinc-700/50",
  };
  const className = config[status] || config.OPEN;
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider border",
      className
    )}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
