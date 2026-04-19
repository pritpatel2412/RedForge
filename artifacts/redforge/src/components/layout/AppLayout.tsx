import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { CommandPalette } from "../CommandPalette";
import { TrialBanner } from "./TrialBanner";

const pageVariants = {
  hidden:  { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, transition: { duration: 0.1 } },
} as const;

export function AppLayout({ children }: { children: React.ReactNode }) {
  // staleTime is set globally in QueryClient (2 min) — cached auth renders instantly
  const { data: auth, isLoading, error } = useGetMe();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && (error || !auth)) {
      setLocation("/signin");
    }
  }, [auth, isLoading, error, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <img src="/logo.png" alt="RedForge" className="w-12 h-12 object-contain" />
          <div className="absolute -inset-1.5 rounded-3xl border border-primary/20 animate-ping" style={{ animationDuration: "1.8s" }} />
        </div>
        <div className="flex items-center gap-1.5">
          {[0,1,2].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!auth) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar workspace={auth.workspace} user={auth.user} />
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header user={auth.user} />
        <TrialBanner plan={auth.workspace?.plan} trialEndsAt={auth.workspace?.trialEndsAt} />
        <main
          className="flex-1 overflow-y-auto scrollbar-thin"
          style={{ background: "oklch(5.5% 0 0)" }}
        >
          <div className="max-w-6xl mx-auto p-4 md:p-5 lg:p-6">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={location}
                variants={pageVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
