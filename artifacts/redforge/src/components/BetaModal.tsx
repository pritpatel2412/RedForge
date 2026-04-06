import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, ShieldAlert } from "lucide-react";

const STORAGE_KEY = "redforge_beta_notice_v1";

export function BetaModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (seen) return;
    const t = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 } as any}
            animate={{ opacity: 1 } as any}
            exit={{ opacity: 0 } as any}
            transition={{ duration: 0.2 } as any}
            className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm"
            onClick={dismiss}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.92, y: 20 } as any}
            animate={{ opacity: 1, scale: 1, y: 0 } as any}
            exit={{ opacity: 0, scale: 0.94, y: 10 } as any}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] } as any}
            className="fixed inset-0 z-[9999] flex items-center justify-center px-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto w-full max-w-md rounded-2xl border border-amber-500/30 shadow-2xl shadow-black/60 overflow-hidden"
              style={{ background: "oklch(8% 0 0)" }}
            >
              {/* Top accent bar */}
              <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500" />

              <div className="p-7">
                {/* Icon + Title */}
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-white">Beta Notice</h2>
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                          BETA
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">Please read before continuing</p>
                    </div>
                  </div>
                  <button
                    onClick={dismiss}
                    className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors text-muted-foreground hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Content */}
                <div className="space-y-4 mb-7">
                  <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                    <p className="text-sm text-amber-200 leading-relaxed">
                      <span className="font-semibold text-amber-400">RedForge is currently in Beta.</span> The platform is actively under development. You may encounter bugs, incomplete features, or unexpected behaviour.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 flex gap-3">
                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-200 leading-relaxed">
                      <span className="font-semibold text-red-400">Do not make any payments.</span> Subscription and billing features are present for preview only. Any money transacted is done at your own risk — we cannot guarantee refunds or service continuity during the Beta period.
                    </p>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    By continuing, you acknowledge that RedForge is in Beta and accept that the service may change, be unavailable, or contain errors. Use the free tier to explore the platform safely.
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={dismiss}
                    className="flex-1 py-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold text-sm hover:bg-amber-500/20 transition-all"
                  >
                    I understand — Continue
                  </button>
                  <a
                    href="mailto:hello@redforge.io"
                    className="flex-1 py-3 rounded-xl bg-white/4 border border-white/10 text-muted-foreground font-semibold text-sm hover:bg-white/8 hover:text-white transition-all text-center"
                  >
                    Contact Us
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
