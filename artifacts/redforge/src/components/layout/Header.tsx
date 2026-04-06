import { useLocation } from "wouter";
import { Search, Bell, LogOut, ChevronDown } from "lucide-react";
import { useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import type { User } from "@workspace/api-client-react/src/generated/api.schemas";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/projects": "Projects",
  "/scans": "Scans",
  "/findings": "Findings",
  "/settings": "Settings",
  "/settings/api-keys": "API Keys",
  "/settings/billing": "Billing",
};

export function Header({ user }: { user?: User }) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { mutate: doLogout } = useLogout({
    mutation: {
      onSuccess: () => {
        queryClient.clear();
        setLocation("/");
      }
    }
  });

  const pageTitle = PAGE_TITLES[location] || "RedForge";
  const initial = user?.name?.charAt(0).toUpperCase() || "A";

  return (
    <header className="h-14 flex items-center justify-between px-5 md:px-7 border-b border-border sticky top-0 z-20 shrink-0" style={{ background: "oklch(6% 0 0 / 0.85)", backdropFilter: "blur(12px)" }}>
      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground rounded-lg border border-border px-3 py-2 cursor-pointer hover:border-white/20 hover:text-white transition-all group" style={{ background: "oklch(8% 0 0)" }}>
          <Search className="w-3.5 h-3.5" />
          <span>Quick search</span>
          <kbd className="ml-1 font-mono text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground" style={{ background: "oklch(12% 0 0)" }}>⌘K</kbd>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/6 transition-all"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-primary rounded-full" />
        </motion.button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* User menu */}
        <div className="flex items-center gap-2.5 pl-1 pr-2 py-1.5 rounded-xl hover:bg-white/4 transition-colors cursor-pointer group">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ background: "linear-gradient(135deg, hsl(348,83%,40%), hsl(20,100%,50%))" }}
          >
            {initial}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-white leading-tight">{user?.name || "Admin"}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{user?.email}</p>
          </div>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => { e.stopPropagation(); doLogout(); }}
            className="ml-2 p-1.5 text-muted-foreground hover:text-primary transition-colors rounded-lg hover:bg-primary/10"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </div>
    </header>
  );
}
