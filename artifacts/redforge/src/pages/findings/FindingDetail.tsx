import { useState } from "react";
import { Link, useParams } from "wouter";
import { useGetFinding, useUpdateFinding, useGenerateFix } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ArrowLeft, Zap, Check, ShieldAlert, Code2, Copy, Loader2 } from "lucide-react";
import CustomSelect from "@/components/CustomSelect";
import { SeverityBadge, FindingStatusBadge } from "@/components/Badges";
import { formatDate } from "@/lib/utils";

export default function FindingDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: finding, isLoading } = useGetFinding(id);

  const { mutate: updateStatus, isPending: isUpdating } = useUpdateFinding({
    mutation: {
      onSuccess: () => {
        toast.success("Status updated");
        queryClient.invalidateQueries({ queryKey: [`/api/findings/${id}`] });
      }
    }
  });

  const { mutate: generateFix, isPending: isGenerating } = useGenerateFix({
    mutation: {
      onSuccess: () => {
        toast.success("AI fix generated successfully");
        queryClient.invalidateQueries({ queryKey: [`/api/findings/${id}`] });
      },
      onError: (err: any) => toast.error(err.message || "Failed to generate fix")
    }
  });

  if (isLoading) return <div className="skeleton h-96 rounded-2xl" />;
  if (!finding) return <div>Finding not found</div>;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <Link href="/findings" className="text-sm text-muted-foreground hover:text-white flex items-center gap-2 w-fit">
        <ArrowLeft className="w-4 h-4" /> Back to Findings
      </Link>

      <div className="bg-card border border-border p-6 md:p-8 rounded-2xl shadow-lg relative overflow-hidden">
        {finding.severity === 'CRITICAL' && <div className="absolute top-0 left-0 w-full h-1 bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]" />}
        
        <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
          <div className="space-y-4 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <SeverityBadge severity={finding.severity} />
              <FindingStatusBadge status={finding.status} />
              {finding.cvss && <span className="px-2 py-1 bg-zinc-800 text-zinc-300 text-xs font-mono rounded border border-zinc-700">CVSS: {finding.cvss}</span>}
              {finding.cwe && <span className="px-2 py-1 bg-zinc-800 text-zinc-300 text-xs font-mono rounded border border-zinc-700">{finding.cwe}</span>}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">{finding.title}</h1>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background border border-border font-mono text-sm text-primary">
              {finding.endpoint}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <CustomSelect
              value={finding.status}
              onChange={(val) => updateStatus({ id, data: { status: val as any } })}
              disabled={isUpdating}
              options={[
                { value: "OPEN",           label: "Mark as Open",       dot: "#ef4444" },
                { value: "IN_PROGRESS",    label: "In Progress",         dot: "#f59e0b" },
                { value: "FIXED",          label: "Mark as Fixed",       dot: "#22c55e" },
                { value: "WONT_FIX",       label: "Won't Fix",           dot: "#71717a" },
                { value: "FALSE_POSITIVE", label: "False Positive",      dot: "#6366f1" },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" /> Description
            </h3>
            <div className="prose prose-invert max-w-none text-zinc-300">
              <p>{finding.description}</p>
            </div>
          </div>

          {finding.pocCode && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="bg-zinc-900 border-b border-border px-6 py-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-orange-500" /> Proof of Concept
                </h3>
                <button onClick={() => copyToClipboard(finding.pocCode!)} className="text-muted-foreground hover:text-white transition-colors">
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <pre className="p-6 overflow-x-auto text-sm font-mono text-orange-200 bg-black m-0">
                <code>{finding.pocCode}</code>
              </pre>
            </div>
          )}

          {finding.fixPatch ? (
            <div className="bg-card border border-primary/30 rounded-2xl overflow-hidden shadow-[0_0_20px_rgba(239,68,68,0.1)]">
              <div className="bg-primary/10 border-b border-primary/20 px-6 py-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" /> AI Generated Patch
                </h3>
              </div>
              <div className="p-6 bg-card border-b border-border">
                <p className="text-sm text-zinc-300">{finding.fixExplanation}</p>
              </div>
              <pre className="p-6 overflow-x-auto text-sm font-mono text-green-400 bg-black m-0">
                <code>{finding.fixPatch}</code>
              </pre>
            </div>
          ) : (
            <div className="bg-card border border-dashed border-border rounded-2xl p-8 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Zap className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Generate Auto-Fix</h3>
              <p className="text-muted-foreground mb-6 max-w-md">Let RedForge's AI analyze the vulnerability and generate a precise patch for your codebase.</p>
              <button 
                onClick={() => generateFix({ id })}
                disabled={isGenerating}
                className="px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)] disabled:opacity-50 flex items-center gap-2"
              >
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Generate Patch"}
              </button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="font-bold text-white mb-4">Metadata</h3>
            <div className="space-y-4 text-sm">
              <div>
                <div className="text-muted-foreground mb-1">Project</div>
                <Link href={`/projects/${finding.projectId}`} className="text-primary hover:underline font-medium">{finding.projectName || "View Project"}</Link>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">Discovered</div>
                <div className="text-white">{formatDate(finding.createdAt)}</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">OWASP Category</div>
                <div className="text-white">{finding.owasp || "N/A"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
