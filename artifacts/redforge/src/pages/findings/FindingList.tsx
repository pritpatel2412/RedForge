import { useState } from "react";
import { Link } from "wouter";
import { useListFindings } from "@workspace/api-client-react";
import { Bug, ArrowRight, SlidersHorizontal, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { SeverityBadge, FindingStatusBadge } from "@/components/Badges";
import { formatDate } from "@/lib/utils";
import CustomSelect from "@/components/CustomSelect";

const cardVariants: any = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.22, ease: [0.16, 1, 0.3, 1] }
  })
};

const SEVERITY_OPTIONS = [
  { value: "",         label: "All Severities" },
  { value: "CRITICAL", label: "Critical",  dot: "#ef4444" },
  { value: "HIGH",     label: "High",      dot: "#f97316" },
  { value: "MEDIUM",   label: "Medium",    dot: "#f59e0b" },
  { value: "LOW",      label: "Low",       dot: "#22c55e" },
  { value: "INFO",     label: "Info",      dot: "#6366f1" },
];

const STATUS_OPTIONS = [
  { value: "",              label: "All Statuses"  },
  { value: "OPEN",          label: "Open",          dot: "#ef4444" },
  { value: "IN_PROGRESS",   label: "In Progress",   dot: "#f59e0b" },
  { value: "FIXED",         label: "Fixed",         dot: "#22c55e" },
  { value: "WONT_FIX",      label: "Won't Fix",     dot: "#71717a" },
  { value: "FALSE_POSITIVE",label: "False Positive",dot: "#6366f1" },
];

export default function FindingList() {
  const [severity, setSeverity] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  const { data: findings, isLoading } = useListFindings({
    ...(severity ? { severity: severity as any } : {}),
    ...(status ? { status: status as any } : {})
  });

  const criticalCount = findings?.filter(f => f.severity === "CRITICAL").length ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Vulnerabilities</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Triage and remediate all identified security issues</p>
        </div>
        {criticalCount > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/25 text-primary text-xs font-bold"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {criticalCount} Critical
          </motion.div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center p-4 rounded-2xl border border-border" style={{ background: "oklch(7% 0 0)" }}>
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filter
        </div>
        <div className="flex flex-wrap gap-2 ml-auto">
          <CustomSelect
            value={severity}
            onChange={setSeverity}
            options={SEVERITY_OPTIONS}
          />
          <CustomSelect
            value={status}
            onChange={setStatus}
            options={STATUS_OPTIONS}
          />
        </div>
      </div>

      {/* Results count */}
      {!isLoading && findings && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-muted-foreground"
        >
          {findings.length} {findings.length === 1 ? "finding" : "findings"} {severity || status ? "matching filters" : "total"}
        </motion.p>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-border overflow-hidden" style={{ background: "oklch(7% 0 0)" }}>
        {isLoading ? (
          <div className="divide-y divide-border">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="p-5 flex items-center gap-4" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="h-5 w-20 skeleton rounded-lg" />
                <div className="h-5 flex-1 skeleton rounded-lg" />
                <div className="h-5 w-16 skeleton rounded-lg" />
              </div>
            ))}
          </div>
        ) : findings?.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-white/4 border border-border flex items-center justify-center mx-auto mb-3">
              <Bug className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-white mb-1">No findings found</p>
            <p className="text-xs text-muted-foreground">
              {severity || status ? "Try adjusting your filters." : "Run a scan to discover vulnerabilities."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {findings?.map((finding, i) => (
              <motion.div
                key={finding.id}
                custom={i}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
              >
                <Link
                  href={`/findings/${finding.id}`}
                  className="flex flex-col md:flex-row md:items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors group gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5">
                      <SeverityBadge severity={finding.severity} />
                      <h4 className="font-semibold text-white text-sm truncate group-hover:text-primary transition-colors">
                        {finding.title}
                      </h4>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="text-zinc-400 font-medium">{finding.projectName}</span>
                      <span className="text-zinc-600">·</span>
                      <code className="font-mono bg-white/4 border border-white/8 px-1.5 py-0.5 rounded text-zinc-400">
                        {finding.endpoint}
                      </code>
                      <span className="text-zinc-600">·</span>
                      <span>{formatDate(finding.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <FindingStatusBadge status={finding.status} />
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-0.5 hidden md:block" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
