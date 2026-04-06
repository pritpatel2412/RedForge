import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  Search, MoreHorizontal, Shield, User, Crown,
  ChevronLeft, ChevronRight, Loader2, Trash2, X, Mail
} from "lucide-react";

function ProviderBadge({ provider }: { provider: string }) {
  if (provider === "google") return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-900/20 border border-blue-800/30 text-blue-400">
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a6.033 6.033 0 1 1 0-12.064c1.498 0 2.866.549 3.921 1.453l2.814-2.814A9.969 9.969 0 0 0 12.545 2C7.021 2 2.543 6.477 2.543 12s4.478 10 10.002 10c8.396 0 10.249-7.85 9.426-11.748l-9.426-.013z"/>
      </svg>
      Google
    </span>
  );
  if (provider === "github") return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-800/60 border border-zinc-700/50 text-zinc-300">
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
      </svg>
      GitHub
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-800/40 border border-zinc-700/30 text-zinc-500">
      <Mail className="w-3 h-3" />
      Email
    </span>
  );
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function useUsers(page: number, search: string) {
  return useQuery({
    queryKey: ["admin-users", page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      const r = await fetch(`${BASE}/api/admin/users?${params}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });
}

const PLAN_COLORS: Record<string, string> = {
  PRO: "text-red-400 bg-red-900/20 border-red-800/40",
  ENTERPRISE: "text-indigo-400 bg-indigo-900/20 border-indigo-800/40",
  FREE: "text-zinc-400 bg-zinc-800/40 border-zinc-700/40",
};

function PlanBadge({ plan }: { plan: string }) {
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${PLAN_COLORS[plan] || PLAN_COLORS.FREE}`}>
      {plan}
    </span>
  );
}

function TrialStatus({ trialEndsAt }: { trialEndsAt: string | null }) {
  if (!trialEndsAt) return <span className="text-zinc-600 text-xs">—</span>;
  const dt = new Date(trialEndsAt);
  const daysLeft = Math.ceil((dt.getTime() - Date.now()) / 86400000);
  if (daysLeft < 0) return <span className="text-red-400 text-xs">Expired</span>;
  if (daysLeft <= 3) return <span className="text-yellow-400 text-xs">{daysLeft}d left</span>;
  return <span className="text-emerald-400 text-xs">{daysLeft}d left</span>;
}

function ChangePlanModal({ user, onClose, onSave }: { user: any; onClose: () => void; onSave: (plan: string, trialDays: number | null) => void }) {
  const [plan, setPlan] = useState(user.workspace?.plan || "FREE");
  const [trialDays, setTrialDays] = useState<string>("");
  const [setAdmin, setSetAdmin] = useState<boolean | null>(null);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">Manage User</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-zinc-500" /></button>
        </div>

        <div className="mb-4 p-3 bg-zinc-800 rounded-lg">
          <p className="text-sm font-medium text-white">{user.name}</p>
          <p className="text-xs text-zinc-500">{user.email}</p>
          <div className="flex gap-2 mt-2">
            <PlanBadge plan={user.workspace?.plan || "FREE"} />
            {user.role === "admin" && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border text-red-400 bg-red-900/20 border-red-800/40">ADMIN</span>}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-400 font-medium block mb-1.5">Change Plan</label>
            <div className="grid grid-cols-3 gap-2">
              {["FREE", "PRO", "ENTERPRISE"].map(p => (
                <button key={p} onClick={() => setPlan(p)}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-colors ${plan === p ? PLAN_COLORS[p] : "border-zinc-700 text-zinc-500 hover:border-zinc-600"}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {plan === "FREE" && (
            <div>
              <label className="text-xs text-zinc-400 font-medium block mb-1.5">Trial Extension (days)</label>
              <input
                type="number" min="0" max="365" placeholder="e.g. 14"
                value={trialDays} onChange={e => setTrialDays(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
              />
            </div>
          )}

          <div>
            <label className="text-xs text-zinc-400 font-medium block mb-1.5">Admin Role</label>
            <div className="flex gap-2">
              {[{ label: "User", value: false }, { label: "Admin", value: true }].map(({ label, value }) => (
                <button key={label} onClick={() => setSetAdmin(value)}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold border transition-colors ${setAdmin === value ? "border-red-600 text-red-400 bg-red-900/20" : "border-zinc-700 text-zinc-500 hover:border-zinc-600"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors">Cancel</button>
          <button
            onClick={() => onSave(plan, trialDays ? parseInt(trialDays) : null)}
            className="flex-1 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-500 text-white font-medium transition-colors">
            Save Changes
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function AdminUsers() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editUser, setEditUser] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useUsers(page, search);

  const planMutation = useMutation({
    mutationFn: async ({ userId, plan, trialDays, setAdmin }: any) => {
      const r = await fetch(`${BASE}/api/admin/users/${userId}/plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan, trialDays, setAdmin }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: () => {
      toast.success("User updated");
      setEditUser(null);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const r = await fetch(`${BASE}/api/admin/users/${userId}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: () => {
      toast.success("User deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const users = data?.users || [];
  const pagination = data?.pagination || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-zinc-500 text-sm mt-1">{pagination.total ?? "—"} total accounts</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text" placeholder="Search users..."
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
        />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">User</th>
                <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Provider</th>
                <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Plan</th>
                <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Trial</th>
                <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Role</th>
                <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Joined</th>
                <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Last Seen</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-zinc-800 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-zinc-600">No users found</td>
                </tr>
              ) : users.map((user: any) => (
                <motion.tr key={user.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="border-b border-border/50 hover:bg-white/[0.02] transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300 flex-shrink-0">
                        {user.name?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <div className="text-white font-medium text-sm leading-none">{user.name}</div>
                        <div className="text-zinc-500 text-xs mt-0.5">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><ProviderBadge provider={user.provider || "email"} /></td>
                  <td className="px-4 py-3"><PlanBadge plan={user.workspace?.plan || "FREE"} /></td>
                  <td className="px-4 py-3"><TrialStatus trialEndsAt={user.workspace?.trialEndsAt} /></td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-zinc-500 capitalize">{user.role}</span>
                    {user.role === "admin" && <span className="ml-1">👑</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {user.lastSeenAt ? new Date(user.lastSeenAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditUser(user)}
                        className="p-1.5 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { if (confirm(`Delete ${user.email}?`)) deleteMutation.mutate(user.id); }}
                        className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-900/20 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-zinc-500">Page {pagination.page} of {pagination.pages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-md border border-zinc-700 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}
                className="p-1.5 rounded-md border border-zinc-700 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {editUser && (
          <ChangePlanModal
            user={editUser}
            onClose={() => setEditUser(null)}
            onSave={(plan, trialDays) => planMutation.mutate({ userId: editUser.id, plan, trialDays })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
