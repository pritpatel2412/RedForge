import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LayoutDashboard, 
  Shield, 
  Bug, 
  Target, 
  Settings, 
  Zap,
  ChevronRight,
  Sparkles,
  BarChart3,
  FileDown,
  Bot,
  ShieldAlert,
} from "lucide-react";
import type { Workspace } from "@workspace/api-client-react/src/generated/api.schemas";

const navItems = [
  { name: "Dashboard",   href: "/dashboard",  icon: LayoutDashboard },
  { name: "Projects",    href: "/projects",   icon: Shield },
  { name: "Scans",       href: "/scans",      icon: Target },
  { name: "Findings",    href: "/findings",   icon: Bug },
  { name: "Analytics",   href: "/analytics",  icon: BarChart3 },
  { name: "Reports",     href: "/reports",    icon: FileDown },
  { name: "AI Assistant",href: "/chat",       icon: Bot,   highlight: true },
  { name: "Settings",    href: "/settings",   icon: Settings },
];

export function Sidebar({ workspace, user }: { workspace?: Workspace; user?: any }) {
  const [location] = useLocation();
  const plan = workspace?.plan || "FREE";
  const isPro = plan === "PRO" || plan === "ENTERPRISE";
  const initial = workspace?.name?.charAt(0).toUpperCase() || "W";
  const isAdmin = user?.role === "admin";

  return (
    <aside className="w-60 border-r border-border hidden md:flex flex-col z-10 h-full relative" style={{ background: "oklch(6% 0 0)" }}>
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-border shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <img src="/logo.png" alt="RedForge" className="w-7 h-7 object-contain" />
          <span className="font-bold text-base tracking-tight text-white">RedForge</span>
        </Link>
      </div>

      {/* Workspace pill */}
      <div className="px-3 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/4 transition-colors cursor-default">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "linear-gradient(135deg, hsl(348,83%,40%), hsl(20,100%,50%))" }}>
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate leading-tight">{workspace?.name || "Personal Workspace"}</p>
            <p className="text-[10px] text-muted-foreground">{plan} plan</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto scrollbar-hide">
        <p className="px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 mt-1">Navigation</p>
        {isAdmin && (
          <Link href="/admin" className={cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors mb-1",
            location.startsWith("/admin")
              ? "bg-red-500/10 text-red-400 border border-red-500/20"
              : "text-red-500/70 hover:text-red-400 hover:bg-red-500/5 border border-red-500/10"
          )}>
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            Admin Panel
            <span className="ml-auto text-[9px] bg-red-900/40 text-red-400 px-1 py-0.5 rounded">ADMIN</span>
          </Link>
        )}
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(`${item.href}/`));
          const isHighlight = (item as any).highlight;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group",
                isActive
                  ? "text-white"
                  : isHighlight
                  ? "text-primary hover:text-white"
                  : "text-muted-foreground hover:text-white hover:bg-white/4"
              )}
              style={isHighlight && !isActive ? {
                background: "linear-gradient(135deg, hsl(348 83% 50% / 0.08), hsl(260 80% 60% / 0.06))",
                border: "1px solid hsl(348 83% 50% / 0.15)",
              } : undefined}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl bg-white/6 border border-white/10"
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
              <item.icon className={cn(
                "w-4 h-4 shrink-0 relative z-10",
                isActive ? "text-primary" : isHighlight ? "text-primary" : "text-muted-foreground group-hover:text-white"
              )} />
              <span className="relative z-10">{item.name}</span>
              {isHighlight && !isActive && (
                <span className="ml-auto relative z-10 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/20 tracking-wide">AI</span>
              )}
              {isActive && (
                <ChevronRight className="w-3 h-3 ml-auto text-muted-foreground relative z-10" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Upgrade / Plan block */}
      <div className="p-3 border-t border-border shrink-0">
        <AnimatePresence mode="wait">
          {!isPro ? (
            <motion.div
              key="upgrade"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
            >
              <Link
                href="/settings/billing"
                className="block relative overflow-hidden rounded-xl p-4 group"
                style={{ background: "linear-gradient(135deg, hsl(348 83% 50% / 0.12), hsl(348 83% 50% / 0.04))", border: "1px solid hsl(348 83% 50% / 0.2)" }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-primary" />
                    <span className="text-xs font-bold text-white">Upgrade to Pro</span>
                  </div>
                  <ChevronRight className="w-3 h-3 text-primary group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-[10px] text-muted-foreground">Unlimited scans, AI fixes & alerts</p>
              </Link>
            </motion.div>
          ) : (
            <motion.div
              key="pro"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="rounded-xl px-3.5 py-3 flex items-center justify-between border border-border"
              style={{ background: "oklch(8% 0 0)" }}
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span className="text-xs font-bold text-white">{plan} Plan</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Active subscription</p>
              </div>
              <Link href="/settings/billing" className="text-[10px] text-primary hover:underline font-semibold">Manage</Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}
