import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { Plus, Tag, Trash2, X, Copy, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function useCoupons() {
  return useQuery({
    queryKey: ["admin-coupons"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/admin/coupons`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });
}

function CreateCouponModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    code: "", description: "", type: "trial_extension",
    grantedPlan: "PRO", durationDays: "30",
    maxUses: "", validUntil: "",
  });
  const [loading, setLoading] = useState(false);

  const genCode = () => {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    const code = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    setForm(f => ({ ...f, code }));
  };

  const submit = async () => {
    if (!form.code || !form.type) { toast.error("Code and type are required"); return; }
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/admin/coupons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...form,
          durationDays: parseInt(form.durationDays) || 30,
          maxUses: form.maxUses ? parseInt(form.maxUses) : null,
          validUntil: form.validUntil || null,
          grantedPlan: form.type === "plan_grant" ? form.grantedPlan : null,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      toast.success(`Coupon ${data.coupon.code} created`);
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500";
  const labelClass = "text-xs text-zinc-400 font-medium block mb-1.5";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">Create Coupon</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-zinc-500" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className={labelClass}>Coupon Code *</label>
            <div className="flex gap-2">
              <input className={inputClass + " flex-1"} placeholder="SUMMER25" value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
              <button onClick={genCode} className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-xs text-zinc-300 transition-colors whitespace-nowrap">
                Generate
              </button>
            </div>
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <input className={inputClass} placeholder="Summer 2026 promotion" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>

          <div>
            <label className={labelClass}>Coupon Type *</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "trial_extension", label: "Trial Extension", sub: "Extend trial period" },
                { value: "plan_grant", label: "Plan Grant", sub: "Grant a plan upgrade" },
              ].map(({ value, label, sub }) => (
                <button key={value} onClick={() => setForm(f => ({ ...f, type: value }))}
                  className={`p-3 rounded-lg border text-left transition-colors ${form.type === value ? "border-red-600 bg-red-900/20" : "border-zinc-700 hover:border-zinc-600"}`}>
                  <div className="text-xs font-semibold text-white">{label}</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">{sub}</div>
                </button>
              ))}
            </div>
          </div>

          {form.type === "plan_grant" && (
            <div>
              <label className={labelClass}>Plan to Grant</label>
              <div className="grid grid-cols-2 gap-2">
                {["PRO", "ENTERPRISE"].map(p => (
                  <button key={p} onClick={() => setForm(f => ({ ...f, grantedPlan: p }))}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-colors ${form.grantedPlan === p ? "border-red-600 text-red-400 bg-red-900/20" : "border-zinc-700 text-zinc-500 hover:border-zinc-600"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className={labelClass}>{form.type === "plan_grant" ? "Plan Duration (days)" : "Extension Days"}</label>
            <input className={inputClass} type="number" min="1" max="3650" placeholder="30"
              value={form.durationDays} onChange={e => setForm(f => ({ ...f, durationDays: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Max Uses (leave blank = ∞)</label>
              <input className={inputClass} type="number" min="1" placeholder="Unlimited"
                value={form.maxUses} onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>Expires On</label>
              <input className={inputClass} type="date"
                value={form.validUntil} onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))} />
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm border border-zinc-700 text-zinc-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={submit} disabled={loading}
            className="flex-1 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-500 text-white font-medium transition-colors flex items-center justify-center gap-1.5">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Coupon
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function AdminCoupons() {
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();
  const { data, isLoading } = useCoupons();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${BASE}/api/admin/coupons/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: () => { toast.success("Coupon deleted"); queryClient.invalidateQueries({ queryKey: ["admin-coupons"] }); },
    onError: () => toast.error("Failed to delete"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const r = await fetch(`${BASE}/api/admin/coupons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive }),
      });
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-coupons"] }),
    onError: () => toast.error("Failed to update"),
  });

  const coupons = data?.coupons || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Coupons</h1>
          <p className="text-zinc-500 text-sm mt-1">Manage discount and plan grant codes</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          New Coupon
        </button>
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-zinc-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : coupons.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Tag className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">No coupons yet. Create your first one.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {coupons.map((c: any) => {
            const expired = c.validUntil && new Date(c.validUntil) < new Date();
            const exhausted = c.maxUses && c.usesCount >= c.maxUses;
            const inactive = !c.isActive || expired || exhausted;

            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                className={`bg-card border rounded-xl p-5 flex items-center gap-4 ${inactive ? "border-zinc-800 opacity-60" : "border-border"}`}>
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
                  <Tag className="w-5 h-5 text-zinc-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-base font-bold text-white font-mono tracking-wider">{c.code}</code>
                    <button onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Copied!"); }}
                      className="p-0.5 text-zinc-600 hover:text-zinc-300 transition-colors">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                      inactive ? "border-zinc-700 text-zinc-600 bg-zinc-900" : "border-emerald-800/40 text-emerald-400 bg-emerald-900/20"
                    }`}>{inactive ? (expired ? "Expired" : exhausted ? "Exhausted" : "Inactive") : "Active"}</span>
                    {c.type === "plan_grant" && c.grantedPlan && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-red-800/40 text-red-400 bg-red-900/20">{c.grantedPlan}</span>
                    )}
                  </div>
                  {c.description && <p className="text-xs text-zinc-500 mt-0.5">{c.description}</p>}
                  <div className="flex gap-4 mt-1.5 text-xs text-zinc-500">
                    <span>{c.type === "trial_extension" ? `+${c.durationDays}d trial` : `${c.durationDays}d ${c.grantedPlan}`}</span>
                    <span>Used: {c.usesCount}{c.maxUses ? `/${c.maxUses}` : " (∞)"}</span>
                    {c.validUntil && <span>Expires: {new Date(c.validUntil).toLocaleDateString()}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => toggleMutation.mutate({ id: c.id, isActive: !c.isActive })}
                    className={`transition-colors ${c.isActive ? "text-emerald-400" : "text-zinc-600"}`}>
                    {c.isActive ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                  </button>
                  <button onClick={() => { if (confirm("Delete this coupon?")) deleteMutation.mutate(c.id); }}
                    className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-900/20 rounded-md transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {showCreate && (
          <CreateCouponModal
            onClose={() => setShowCreate(false)}
            onCreated={() => queryClient.invalidateQueries({ queryKey: ["admin-coupons"] })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
