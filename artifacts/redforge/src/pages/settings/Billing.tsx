import { useState } from "react";
import { useGetWorkspaceSettings, useCreateCheckout, useCreateBillingPortal } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ExternalLink, ShieldCheck, Check, Zap, Building2, Sparkles, Tag } from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import SettingsLayout from "./SettingsLayout";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const PRO_FEATURES = [
  "Unlimited scan targets",
  "Unlimited scans",
  "ACTIVE mode probing (SQLi/rate-limit/business logic)",
  "Autonomous pentest agent (adaptive follow-up probes)",
  "AI deep analysis (NVIDIA NIM)",
  "AI fix generation (PR-ready diffs + PoC)",
  "GitHub SAST integration (repo checks)",
  "Slack notifications",
  "CI/CD security gate API",
  "90-day finding history",
];

const ENTERPRISE_FEATURES = [
  "Everything in Pro",
  "Unlimited history retention",
  "Custom integrations & policies",
  "Dedicated onboarding + SLA",
  "Custom reporting package",
];

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 }
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } }
};

export default function Billing() {
  const { data: settings, isLoading, refetch } = useGetWorkspaceSettings();
  const queryClient = useQueryClient();
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  
  const { mutate: checkout, isPending: isCheckingOut } = useCreateCheckout({
    mutation: {
      onSuccess: (data) => window.location.href = data.url
    }
  });

  const { mutate: portal, isPending: isPortal } = useCreateBillingPortal({
    mutation: {
      onSuccess: (data) => window.location.href = data.url
    }
  });

  const handleBetaClick = () => {
    toast("RedForge is currently in beta so please do not make payments. To extend your plan, contact sales at try.prit24@gmail.com", {
      icon: 'ℹ️',
      duration: 5000,
      style: { maxWidth: '500px' }
    });
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) { toast.error("Enter a coupon code"); return; }
    setCouponLoading(true);
    try {
      const r = await fetch(`${BASE}/api/coupons/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: couponCode.trim() }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      toast.success(`✓ ${data.benefit}`);
      setCouponCode("");
      queryClient.invalidateQueries({ queryKey: ["/api/workspace/settings"] });
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Invalid coupon");
    } finally {
      setCouponLoading(false);
    }
  };

  if (isLoading) {
    return (
      <SettingsLayout>
        <div className="space-y-4">
          <div className="h-40 skeleton rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-64 skeleton rounded-2xl" />
            <div className="h-64 skeleton rounded-2xl" style={{ animationDelay: "80ms" }} />
          </div>
        </div>
      </SettingsLayout>
    );
  }

  const isPro = settings?.plan === "PRO" || settings?.plan === "ENTERPRISE";
  const isEnterprise = settings?.plan === "ENTERPRISE";

  return (
    <SettingsLayout>
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Current plan banner */}
        <motion.div
          variants={cardVariants}
          className={`relative overflow-hidden rounded-2xl p-6 md:p-8 border ${
            isPro
              ? "border-primary/25 shadow-[0_0_30px_hsl(348_83%_50%_/_0.08)]"
              : "border-border"
          }`}
          style={{ background: isPro ? "linear-gradient(135deg, hsl(348 83% 50% / 0.08), oklch(8% 0 0))" : "oklch(8% 0 0)" }}
        >
          {isPro && (
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          )}
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isPro ? "bg-primary/15 border border-primary/25" : "bg-white/8 border border-white/15"}`}>
                  {isPro ? <Zap className="w-4 h-4 text-primary" /> : <ShieldCheck className="w-4 h-4 text-muted-foreground" />}
                </div>
                <span className={`text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${isPro ? "bg-primary/10 text-primary border border-primary/20" : "bg-white/8 text-muted-foreground border border-white/10"}`}>
                  {settings?.plan || "FREE"} Plan
                </span>
              </div>
              <h2 className="text-xl font-bold text-white mb-2 tracking-tight">Current Subscription</h2>
              <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
                {isPro
                  ? `You're on the ${settings?.plan} plan with unlimited AI scans and full platform access.`
                  : "You're on the free tier. Upgrade to Pro for unlimited scans, AI fixes, and advanced integrations."}
              </p>
              {settings?.trialEndsAt && !isPro && (
                <p className="text-xs text-amber-400 mt-2 font-medium">
                  Free trial expires {new Date(settings.trialEndsAt).toLocaleDateString()}
                </p>
              )}
            </div>

            <div className="shrink-0">
              {isPro ? (
                <button
                  onClick={handleBetaClick}
                  disabled={isPortal}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-white/5 hover:bg-white/8 text-white font-semibold text-sm transition-all disabled:opacity-50"
                >
                  {isPortal ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                  Manage Subscription
                </button>
              ) : (
                <button
                  onClick={handleBetaClick}
                  disabled={isCheckingOut}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-sm transition-all shadow-[0_0_20px_hsl(348_83%_50%_/_0.3)] hover:shadow-[0_0_30px_hsl(348_83%_50%_/_0.45)] disabled:opacity-50"
                >
                  {isCheckingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Upgrade to Pro — $79/mo
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Plan comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Pro */}
          <motion.div
            variants={cardVariants}
            className={`rounded-2xl border p-6 relative overflow-hidden ${
              isPro && !isEnterprise
                ? "border-primary/30 shadow-[0_0_20px_hsl(348_83%_50%_/_0.08)]"
                : "border-border"
            }`}
            style={{ background: "oklch(8% 0 0)" }}
          >
            {isPro && !isEnterprise && (
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            )}
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-white">Pro Plan</h3>
              {isPro && !isEnterprise && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                  Current Plan
                </span>
              )}
            </div>
            <div className="flex items-end gap-1 mb-4">
              <span className="text-3xl font-bold text-white">$79</span>
              <span className="text-sm text-muted-foreground mb-1">/month</span>
            </div>
            <ul className="space-y-2.5 mb-6">
              {PRO_FEATURES.map(feat => (
                <li key={feat} className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 text-primary" strokeWidth={3} />
                  </div>
                  <span className="text-sm text-zinc-300">{feat}</span>
                </li>
              ))}
            </ul>
            {!isPro && (
              <button
                onClick={handleBetaClick}
                disabled={isCheckingOut}
                className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-sm transition-all disabled:opacity-50 shadow-[0_0_15px_hsl(348_83%_50%_/_0.25)]"
              >
                {isCheckingOut ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Start 14-Day Trial"}
              </button>
            )}
          </motion.div>

          {/* Enterprise */}
          <motion.div
            variants={cardVariants}
            className={`rounded-2xl border p-6 relative overflow-hidden ${
              isEnterprise ? "border-violet-500/30" : "border-border"
            }`}
            style={{ background: "oklch(8% 0 0)" }}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-white">Enterprise Plan</h3>
              {isEnterprise && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
                  Current
                </span>
              )}
            </div>
            <div className="flex items-end gap-1 mb-4">
              <span className="text-3xl font-bold text-white">Custom</span>
            </div>
            <ul className="space-y-2.5 mb-6">
              {ENTERPRISE_FEATURES.map(feat => (
                <li key={feat} className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 text-violet-400" strokeWidth={3} />
                  </div>
                  <span className="text-sm text-zinc-300">{feat}</span>
                </li>
              ))}
            </ul>
            <a
              href="mailto:try.prit24@gmail.com"
              className="w-full py-2.5 rounded-xl border border-border bg-white/5 hover:bg-white/8 text-white font-semibold text-sm transition-all text-center flex items-center justify-center gap-2"
            >
              <Building2 className="w-4 h-4" />
              Contact Sales
            </a>
          </motion.div>
        </div>

        {/* Coupon Redemption */}
        <motion.div
          variants={cardVariants}
          className="rounded-2xl border border-border p-6"
          style={{ background: "oklch(8% 0 0)" }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Tag className="w-4 h-4 text-zinc-400" />
            <h3 className="font-semibold text-white text-sm">Redeem a Coupon</h3>
          </div>
          <p className="text-xs text-zinc-500 mb-4">Have a promotional or discount code? Apply it below to unlock a plan upgrade or extend your trial.</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter coupon code (e.g. SUMMER25)"
              value={couponCode}
              onChange={e => setCouponCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && applyCoupon()}
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono tracking-wider"
            />
            <button
              onClick={applyCoupon}
              disabled={couponLoading || !couponCode.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all"
            >
              {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
              Apply
            </button>
          </div>
        </motion.div>

        {/* Trust line */}
        <motion.p variants={cardVariants} className="text-xs text-muted-foreground text-center pt-2">
          All plans include SSL encryption, 99.9% uptime SLA, and GDPR-compliant data handling.
          Questions? Email <a href="mailto:try.prit24@gmail.com" className="text-primary hover:underline">try.prit24@gmail.com</a>
        </motion.p>
      </motion.div>
    </SettingsLayout>
  );
}
