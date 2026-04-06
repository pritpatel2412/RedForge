import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const ACTION_COLORS: Record<string, string> = {
  "auth.login": "text-emerald-400 bg-emerald-900/20 border-emerald-800/40",
  "auth.register": "text-blue-400 bg-blue-900/20 border-blue-800/40",
  "auth.logout": "text-zinc-400 bg-zinc-800/40 border-zinc-700",
  "coupon.applied": "text-yellow-400 bg-yellow-900/20 border-yellow-800/40",
  "admin.plan_change": "text-red-400 bg-red-900/20 border-red-800/40",
  "admin.coupon_create": "text-indigo-400 bg-indigo-900/20 border-indigo-800/40",
  "admin.user_delete": "text-red-500 bg-red-950/30 border-red-900/50",
  "admin.role_change": "text-orange-400 bg-orange-900/20 border-orange-800/40",
};

function ActionBadge({ action }: { action: string }) {
  const cls = ACTION_COLORS[action] || "text-zinc-400 bg-zinc-800/40 border-zinc-700";
  return (
    <span className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded-md border ${cls}`}>
      {action}
    </span>
  );
}

function useActivityLogs(page: number, action: string) {
  return useQuery({
    queryKey: ["admin-activity", page, action],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (action) params.set("action", action);
      const r = await fetch(`${BASE}/api/admin/activity?${params}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 10000,
  });
}

const ALL_ACTIONS = [
  "auth.login", "auth.register", "auth.logout",
  "coupon.applied", "admin.plan_change", "admin.coupon_create",
  "admin.user_delete", "admin.role_change",
];

export default function AdminActivity() {
  const [page, setPage] = useState(1);
  const [filterAction, setFilterAction] = useState("");

  const { data, isLoading, refetch } = useActivityLogs(page, filterAction);
  const logs = data?.logs || [];
  const pagination = data?.pagination || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Activity Log</h1>
          <p className="text-zinc-500 text-sm mt-1">{pagination.total ?? "—"} total events · auto-refreshes every 10s</p>
        </div>
        <button onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-2 text-xs text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-600 rounded-lg transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => { setFilterAction(""); setPage(1); }}
          className={`px-3 py-1 rounded-full text-xs border transition-colors ${filterAction === "" ? "border-red-600 text-red-400 bg-red-900/20" : "border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"}`}>
          All
        </button>
        {ALL_ACTIONS.map(a => (
          <button key={a} onClick={() => { setFilterAction(a); setPage(1); }}
            className={`px-3 py-1 rounded-full text-xs border transition-colors font-mono ${filterAction === a ? "border-red-600 text-red-400 bg-red-900/20" : "border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"}`}>
            {a}
          </button>
        ))}
      </div>

      {/* Log Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3 w-44">Time</th>
                <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">User</th>
                <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Action</th>
                <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Metadata</th>
                <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-zinc-800 rounded animate-pulse" style={{ width: `${50 + Math.random() * 40}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-zinc-600">
                    <Activity className="w-8 h-8 mx-auto mb-2 text-zinc-800" />
                    No activity yet
                  </td>
                </tr>
              ) : logs.map((log: any) => (
                <motion.tr key={log.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="border-b border-border/40 hover:bg-white/[0.02] transition-colors font-mono">
                  <td className="px-4 py-2.5 text-xs text-zinc-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    {log.user ? (
                      <div>
                        <div className="text-xs text-white leading-none">{log.user.name}</div>
                        <div className="text-[11px] text-zinc-600 mt-0.5">{log.user.email}</div>
                      </div>
                    ) : <span className="text-zinc-600 text-xs">system</span>}
                  </td>
                  <td className="px-4 py-2.5"><ActionBadge action={log.action} /></td>
                  <td className="px-4 py-2.5 text-xs text-zinc-500 max-w-xs">
                    {log.metadata ? (
                      <code className="text-[11px] text-zinc-500">{JSON.stringify(log.metadata).slice(0, 80)}</code>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-zinc-600">{log.ipAddress || "—"}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-zinc-500">Page {pagination.page} of {pagination.pages} · {pagination.total} events</p>
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
