import { useState } from "react";
import { useListApiKeys, useDeleteApiKey, useGetWorkspaceSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Key, Trash2, Clock, Zap, Code2, Webhook, Lock } from "lucide-react";
import { motion } from "framer-motion";
import SettingsLayout from "./SettingsLayout";
import { formatDate } from "@/lib/utils";

const COMING_SOON_USES = [
  {
    icon: Code2,
    title: "CI/CD Integration",
    description: "Trigger scans automatically on every pull request or deployment via the RedForge REST API.",
  },
  {
    icon: Webhook,
    title: "Webhooks & Alerts",
    description: "Pipe scan findings into Slack, PagerDuty, or your SIEM using API-authenticated webhooks.",
  },
  {
    icon: Zap,
    title: "Programmatic Scans",
    description: "Start, stop, and poll scans from any script or platform without touching the dashboard.",
  },
];

export default function ApiKeys() {
  const { data: settings } = useGetWorkspaceSettings();
  const plan = settings?.plan || "FREE";
  const isPro = plan === "PRO" || plan === "ENTERPRISE";
  const { data: keys, isLoading } = useListApiKeys();
  const queryClient = useQueryClient();

  const { mutate: deleteKey, isPending: isDeleting } = useDeleteApiKey({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/keys"] });
        toast.success("API Key revoked");
      },
    },
  });

  if (isLoading) return <SettingsLayout><div className="skeleton h-64 rounded-2xl" /></SettingsLayout>;

  return (
    <SettingsLayout>
      <div className="space-y-6">

        {!isPro && (
          <div className="rounded-2xl border border-primary/25 p-5 text-sm text-zinc-300"
               style={{ background: "linear-gradient(135deg, oklch(10% 0 0), oklch(8% 0 0))" }}>
            <div className="font-semibold text-white mb-1">API keys are a Pro feature</div>
            <div className="text-zinc-400">
              Upgrade to <span className="text-primary font-medium">Pro</span> to enable CI/CD security gating and programmatic scan automation.
            </div>
          </div>
        )}

        {/* ── Coming Soon Banner ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-amber-500/30"
          style={{ background: "linear-gradient(135deg, oklch(12% 0.04 60), oklch(8% 0.02 60))" }}
        >
          {/* Glow accent */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500/60 via-amber-400 to-transparent" />

          <div className="p-6 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-bold text-white">API Access — Coming Soon</h3>
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400">
                  Beta
                </span>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">
                RedForge API access is available on paid plans. Configure keys here and use them for CI/CD gating and automation.
              </p>
              <p className="text-xs text-zinc-600 mt-2">
                Need early API access? Contact <a href="mailto:try.prit24@gmail.com" className="text-amber-400 hover:underline">try.prit24@gmail.com</a>
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── What you'll be able to do ──────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COMING_SOON_USES.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="rounded-xl border border-white/8 p-4"
              style={{ background: "oklch(8% 0 0)" }}
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
                <item.icon className="w-4 h-4 text-primary" />
              </div>
              <h4 className="text-sm font-semibold text-white mb-1">{item.title}</h4>
              <p className="text-xs text-zinc-500 leading-relaxed">{item.description}</p>
            </motion.div>
          ))}
        </div>

        {/* ── Existing keys ────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
          <div className="flex items-center justify-between mb-6 pb-5 border-b border-border">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-bold text-white">API Keys</h2>
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/6 border border-white/10 text-zinc-500">
                  Coming Soon
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Keys listed below are pre-generated but not yet active on the API.
              </p>
            </div>

            <div className="relative group">
              <button
                disabled
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border ${
                  isPro ? "bg-white/5 border-white/10 text-zinc-500 cursor-not-allowed" : "bg-white/5 border-white/10 text-zinc-600 cursor-not-allowed"
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                Create Key
              </button>
              <div className="absolute right-0 top-10 w-60 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                Key creation UI can be enabled next. For now, use the server API or contact admin.
              </div>
            </div>
          </div>

          <div className="divide-y divide-border">
            {!keys || keys.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm flex flex-col items-center">
                <Key className="w-8 h-8 mb-3 opacity-20" />
                <p>No API keys yet.</p>
                <p className="text-xs text-zinc-700 mt-1">Key creation will be enabled when the API goes live.</p>
              </div>
            ) : (
              keys.map(k => (
                <div key={k.id} className="py-4 flex items-center justify-between group">
                  <div>
                    <div className="font-semibold text-white mb-1 flex items-center gap-2">
                      {k.name}
                      <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-500">
                        Inactive
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground font-mono bg-zinc-900 px-2 py-0.5 rounded w-fit mb-1.5">
                      {k.keyPreview}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Created {formatDate(k.createdAt)} · Last used {k.lastUsedAt ? formatDate(k.lastUsedAt) : "Never"}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm("Revoke this API key? This cannot be undone.")) {
                        deleteKey({ id: k.id });
                      }
                    }}
                    disabled={isDeleting}
                    className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Revoke Key"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </SettingsLayout>
  );
}
