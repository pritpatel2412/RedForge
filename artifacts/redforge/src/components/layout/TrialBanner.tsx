import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { AlertTriangle, X, Zap, Clock } from "lucide-react";

interface TrialBannerProps {
  plan: string | null | undefined;
  trialEndsAt: string | null | undefined;
}

export function TrialBanner({ plan, trialEndsAt }: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  const isPaid = plan === "PRO" || plan === "ENTERPRISE";
  if (isPaid || !trialEndsAt) return null;

  const dt = new Date(trialEndsAt);
  const daysLeft = Math.ceil((dt.getTime() - Date.now()) / 86400000);
  const isExpired = daysLeft < 0;

  // Only show banner if within 7 days of expiry or expired
  if (!isExpired && daysLeft > 7) return null;
  if (dismissed && !isExpired) return null;

  const isUrgent = isExpired || daysLeft <= 2;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className={`border-b overflow-hidden flex-shrink-0 ${
          isExpired
            ? "bg-red-950/40 border-red-800/60"
            : isUrgent
            ? "bg-orange-950/40 border-orange-800/60"
            : "bg-amber-950/30 border-amber-800/50"
        }`}
      >
        <div className="max-w-6xl mx-auto px-5 md:px-7 lg:px-8 py-2 flex items-center gap-3">
          <div className={`flex-shrink-0 ${isExpired ? "text-red-400" : isUrgent ? "text-orange-400" : "text-amber-400"}`}>
            {isExpired ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
          </div>

          <p className={`text-xs font-medium flex-1 ${isExpired ? "text-red-300" : isUrgent ? "text-orange-300" : "text-amber-300"}`}>
            {isExpired
              ? "Your free trial has ended. Upgrade to Pro to continue accessing all features."
              : daysLeft === 0
              ? "Your free trial ends today."
              : `Your free trial ends in ${daysLeft} day${daysLeft !== 1 ? "s" : ""} on ${dt.toLocaleDateString()}.`}
            {" "}
            <span className="text-zinc-500">Have a coupon? Apply it in</span>{" "}
            <Link href="/settings/billing" className="underline text-zinc-400 hover:text-white transition-colors">Billing Settings</Link>.
          </p>

          <Link href="/settings/billing">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold flex-shrink-0 transition-colors ${
                isExpired
                  ? "bg-red-600 hover:bg-red-500 text-white"
                  : isUrgent
                  ? "bg-orange-600 hover:bg-orange-500 text-white"
                  : "bg-amber-600 hover:bg-amber-500 text-white"
              }`}
            >
              <Zap className="w-3 h-3" />
              Upgrade
            </motion.button>
          </Link>

          {!isExpired && (
            <button
              onClick={() => setDismissed(true)}
              className="flex-shrink-0 text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
