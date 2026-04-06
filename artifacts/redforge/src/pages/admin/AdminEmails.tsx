import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Mail, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function useEmailLogs(page: number) {
  return useQuery({
    queryKey: ["admin-emails", page],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/admin/emails?page=${page}&limit=25`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });
}

const TEMPLATE_COLORS: Record<string, string> = {
  welcome: "text-blue-400 bg-blue-900/20 border-blue-800/40",
  trial_expiring: "text-yellow-400 bg-yellow-900/20 border-yellow-800/40",
  plan_changed: "text-indigo-400 bg-indigo-900/20 border-indigo-800/40",
  coupon_applied: "text-emerald-400 bg-emerald-900/20 border-emerald-800/40",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "sent") return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  if (status === "failed") return <XCircle className="w-4 h-4 text-red-400" />;
  return <Clock className="w-4 h-4 text-zinc-500" />;
}

export default function AdminEmails() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useEmailLogs(page);
  const logs = data?.logs || [];
  const pagination = data?.pagination || {};

  const sent = logs.filter((l: any) => l.status === "sent").length;
  const failed = logs.filter((l: any) => l.status === "failed").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Email Logs</h1>
        <p className="text-zinc-500 text-sm mt-1">{pagination.total ?? "—"} emails logged</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total (this page)", value: logs.length, color: "text-white" },
          { label: "Sent", value: sent, color: "text-emerald-400" },
          { label: "Failed", value: failed, color: "text-red-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-lg px-4 py-3">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className={`text-2xl font-bold ${color} mt-0.5`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3 w-8"></th>
                <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">To</th>
                <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Template</th>
                <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Subject</th>
                <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Sent At</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-zinc-800 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-zinc-600">
                    <Mail className="w-8 h-8 mx-auto mb-2 text-zinc-800" />
                    No emails sent yet
                  </td>
                </tr>
              ) : logs.map((log: any) => (
                <motion.tr key={log.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="border-b border-border/40 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <StatusIcon status={log.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-300 font-mono">{log.to}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${TEMPLATE_COLORS[log.template] || "border-zinc-700 text-zinc-400 bg-zinc-800/40"}`}>
                      {log.template}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400 max-w-xs truncate">{log.subject}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">
                    {log.sentAt ? new Date(log.sentAt).toLocaleString() : (
                      <span className={log.status === "failed" ? "text-red-500" : "text-zinc-600"}>
                        {log.status === "failed" ? "Failed" : "Pending"}
                      </span>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-zinc-500">Page {pagination.page} of {pagination.pages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-md border border-zinc-700 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}
                className="p-1.5 rounded-md border border-zinc-700 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
