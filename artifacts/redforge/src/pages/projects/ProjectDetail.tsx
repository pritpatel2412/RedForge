import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useGetProject, useTriggerScan, useDeleteProject } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ArrowLeft, ArrowRight, Play, Globe, Calendar, Trash2, Loader2, FileText, Bug, Shield, Zap, Clock, AlertTriangle, X, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDate } from "@/lib/utils";
import { SeverityBadge, StatusBadge, FindingStatusBadge } from "@/components/Badges";

type ScanMode = "PASSIVE" | "ACTIVE" | "CONTINUOUS";

const SCAN_MODES: {
  id: ScanMode;
  label: string;
  icon: React.ElementType;
  description: string;
  modules: string[];
  color: string;
  borderColor: string;
  bgColor: string;
  requiresConfirm?: boolean;
}[] = [
  {
    id: "PASSIVE",
    label: "Passive",
    icon: Shield,
    description: "Safe, read-only analysis. No authentication required. Ideal for any target.",
    modules: ["Security Headers (13)", "Tech Stack Disclosure", "JS Bundle Analysis", "robots.txt & Sitemap", "TLS/SSL & Cookies", "Supply Chain / CDN", "AI Deep Analysis"],
    color: "text-blue-400",
    borderColor: "border-blue-500/40",
    bgColor: "bg-blue-500/8",
  },
  {
    id: "ACTIVE",
    label: "Active",
    icon: Zap,
    description: "Full-depth scan with intrusive probing. Requires authorization to scan the target.",
    modules: ["Everything in Passive", "SQL Injection Probing", "Auth Rate Limit Testing", "Admin Panel Discovery", "Business Logic Detection", "IDOR Risk Analysis"],
    color: "text-amber-400",
    borderColor: "border-amber-500/40",
    bgColor: "bg-amber-500/8",
    requiresConfirm: true,
  },
  {
    id: "CONTINUOUS",
    label: "Continuous",
    icon: Clock,
    description: "Scheduled passive scan — runs daily and alerts on new findings via email.",
    modules: ["All Passive modules", "Daily scheduled re-scan", "Email alerts on new issues", "Risk score trend tracking"],
    color: "text-violet-400",
    borderColor: "border-violet-500/40",
    bgColor: "bg-violet-500/8",
  },
];

function ScanModeModal({
  open,
  onClose,
  onConfirm,
  isLoading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (mode: ScanMode) => void;
  isLoading: boolean;
}) {
  const [selected, setSelected] = useState<ScanMode>("PASSIVE");
  const [confirmed, setConfirmed] = useState(false);

  const selectedMode = SCAN_MODES.find(m => m.id === selected)!;
  const needsConfirm = selectedMode.requiresConfirm && !confirmed;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-white">Configure Scan</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Select a scan mode based on your authorization level</p>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode cards */}
            <div className="p-6 space-y-3">
              {SCAN_MODES.map(mode => {
                const Icon = mode.icon;
                const isSelected = selected === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => { setSelected(mode.id); setConfirmed(false); }}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      isSelected ? `${mode.borderColor} ${mode.bgColor}` : "border-border hover:border-white/20 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isSelected ? mode.bgColor : "bg-muted"}`}>
                        <Icon className={`w-4 h-4 ${isSelected ? mode.color : "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-semibold text-sm ${isSelected ? "text-white" : "text-zinc-300"}`}>{mode.label}</span>
                          {mode.requiresConfirm && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25">
                              REQUIRES AUTHORIZATION
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{mode.description}</p>
                        {isSelected && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="flex flex-wrap gap-1.5 mt-2"
                          >
                            {mode.modules.map(m => (
                              <span key={m} className="flex items-center gap-1 text-[11px] text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded border border-border">
                                <CheckCircle2 className="w-2.5 h-2.5 text-green-500 shrink-0" />
                                {m}
                              </span>
                            ))}
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active mode confirmation */}
            <AnimatePresence>
              {selectedMode.requiresConfirm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mx-6 mb-4 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-amber-300 mb-1">Authorization Required</p>
                      <p className="text-xs text-zinc-400 mb-3">Active mode performs intrusive probing (SQL injection tests, rate limit testing, admin path brute-forcing). Only run this against systems you own or have explicit written authorization to test.</p>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={confirmed}
                          onChange={e => setConfirmed(e.target.checked)}
                          className="mt-0.5 accent-amber-500"
                        />
                        <span className="text-xs text-zinc-300">
                          I confirm I have explicit authorization to perform active security testing on this target
                        </span>
                      </label>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 pb-6 gap-3">
              <button onClick={onClose} className="px-4 py-2.5 text-sm text-muted-foreground hover:text-white border border-border rounded-xl hover:bg-muted transition-colors">
                Cancel
              </button>
              <button
                onClick={() => onConfirm(selected)}
                disabled={isLoading || needsConfirm}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  selected === "ACTIVE"
                    ? "bg-amber-600 hover:bg-amber-500 text-white"
                    : selected === "CONTINUOUS"
                    ? "bg-violet-600 hover:bg-violet-500 text-white"
                    : "bg-primary hover:bg-primary/90 text-white shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                }`}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                Start {selectedMode.label} Scan
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"scans" | "findings">("scans");
  const [showScanModal, setShowScanModal] = useState(false);

  const { data: project, isLoading } = useGetProject(id);

  const { mutate: scan, isPending: isScanning } = useTriggerScan({
    mutation: {
      onSuccess: (data) => {
        toast.success("Scan initiated");
        setShowScanModal(false);
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}`] });
        setLocation(`/scans/${data.id}`);
      },
      onError: (err: any) => toast.error(err.message || "Failed to start scan")
    }
  });

  const { mutate: deleteProj, isPending: isDeleting } = useDeleteProject({
    mutation: {
      onSuccess: () => {
        toast.success("Project deleted");
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        setLocation("/projects");
      }
    }
  });

  const handleScanConfirm = (mode: ScanMode) => {
    scan({ id, data: { scanMode: mode } } as any);
  };

  if (isLoading) return <div className="skeleton h-96 rounded-2xl" />;
  if (!project) return <div>Project not found</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <ScanModeModal
        open={showScanModal}
        onClose={() => setShowScanModal(false)}
        onConfirm={handleScanConfirm}
        isLoading={isScanning}
      />

      <Link href="/projects" className="text-sm text-muted-foreground hover:text-white flex items-center gap-2 w-fit">
        <ArrowLeft className="w-4 h-4" /> Back to Projects
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card border border-border p-6 rounded-2xl">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white">{project.name}</h1>
            <span className="px-2.5 py-0.5 rounded bg-muted text-xs font-mono border border-border text-muted-foreground uppercase">{project.targetType}</span>
          </div>
          <p className="text-muted-foreground">{project.description || "No description provided."}</p>
          <div className="flex flex-wrap items-center gap-6 mt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><Globe className="w-4 h-4" /> {project.targetUrl}</div>
            <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Created {formatDate(project.createdAt)}</div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              if (confirm("Are you sure you want to delete this project?")) {
                deleteProj({ id });
              }
            }}
            disabled={isDeleting}
            className="p-3 border border-border rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
            title="Delete Project"
          >
            {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setShowScanModal(true)}
            disabled={isScanning}
            className="px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.2)] disabled:opacity-50"
          >
            {isScanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
            Start Scan
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex border-b border-border">
          <button
            className={`flex-1 py-4 text-sm font-medium transition-colors border-b-2 flex items-center justify-center gap-2 ${activeTab === 'scans' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-muted-foreground hover:text-white hover:bg-muted/50'}`}
            onClick={() => setActiveTab('scans')}
          >
            <FileText className="w-4 h-4" /> Scan History
          </button>
          <button
            className={`flex-1 py-4 text-sm font-medium transition-colors border-b-2 flex items-center justify-center gap-2 ${activeTab === 'findings' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-muted-foreground hover:text-white hover:bg-muted/50'}`}
            onClick={() => setActiveTab('findings')}
          >
            <Bug className="w-4 h-4" /> Findings
          </button>
        </div>

        <div className="p-0">
          {activeTab === 'scans' && (
            <div className="divide-y divide-border">
              {project.scans.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">No scans have been run yet.</div>
              ) : (
                project.scans.map(s => (
                  <Link key={s.id} href={`/scans/${s.id}`} className="flex items-center justify-between p-6 hover:bg-muted/50 transition-colors group">
                    <div className="flex items-center gap-4">
                      <StatusBadge status={s.status} />
                      <div className="text-sm font-medium text-white">{formatDate(s.createdAt)}</div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium text-white">{s.findingsCount}</span> findings
                      </div>
                      {s.criticalCount > 0 && <span className="text-xs font-semibold text-red-500 bg-red-500/10 px-2 py-1 rounded">{s.criticalCount} Critical</span>}
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}

          {activeTab === 'findings' && (
            <div className="divide-y divide-border">
              {project.findings.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">No findings identified. System secure.</div>
              ) : (
                project.findings.map(f => (
                  <Link key={f.id} href={`/findings/${f.id}`} className="flex items-center justify-between p-6 hover:bg-muted/50 transition-colors group">
                    <div className="flex-1 pr-4">
                      <div className="flex items-center gap-3 mb-2">
                        <SeverityBadge severity={f.severity} />
                        <h4 className="font-semibold text-white truncate">{f.title}</h4>
                      </div>
                      <div className="text-sm text-muted-foreground font-mono bg-zinc-900/50 px-2 py-0.5 rounded w-fit border border-border">
                        {f.endpoint}
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <FindingStatusBadge status={f.status} />
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
