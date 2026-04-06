import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Search, Bell, LogOut, X, LayoutDashboard, FolderOpen, Scan, ShieldAlert, BarChart2, FileText, Settings, Key, CreditCard, MessageSquare, ChevronRight, Check } from "lucide-react";
import { useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import type { User } from "@workspace/api-client-react";

// ── Search index ──────────────────────────────────────────────────────────────
const SEARCH_ITEMS = [
  { label: "Dashboard",         path: "/dashboard",         icon: LayoutDashboard, description: "Overview & stats" },
  { label: "Projects",          path: "/projects",          icon: FolderOpen,      description: "Manage your projects" },
  { label: "New Project",       path: "/projects/new",      icon: FolderOpen,      description: "Create a new project" },
  { label: "Scans",             path: "/scans",             icon: Scan,            description: "All security scans" },
  { label: "Findings",          path: "/findings",          icon: ShieldAlert,     description: "Vulnerabilities found" },
  { label: "Analytics",         path: "/analytics",         icon: BarChart2,       description: "Trends & insights" },
  { label: "Reports",           path: "/reports",           icon: FileText,        description: "Export reports" },
  { label: "AI Chat",           path: "/chat",              icon: MessageSquare,   description: "Chat with FORGE-1" },
  { label: "Settings",          path: "/settings",          icon: Settings,        description: "Workspace settings" },
  { label: "API Keys",          path: "/settings/api-keys", icon: Key,             description: "Manage API keys" },
  { label: "Billing",           path: "/settings/billing",  icon: CreditCard,      description: "Plans & billing" },
];

// ── Notifications store (local, persist in sessionStorage) ───────────────────
const DEFAULT_NOTIFICATIONS = [
  { id: "n1", title: "RedForge is in Beta", body: "Some features are still being polished. Report issues to try.prit24@gmail.com", time: "Just now", read: false, type: "info" },
  { id: "n2", title: "AI Engine Upgraded", body: "FORGE-1 now uses GLM-5-plus (744B) for deeper security reasoning.", time: "2h ago", read: false, type: "success" },
  { id: "n3", title: "Attack Graph Ready", body: "Automated attack chains now prioritized over social-engineering paths.", time: "1d ago", read: true, type: "success" },
];

function useNotifications() {
  const [items, setItems] = useState(() => {
    try {
      const stored = sessionStorage.getItem("rf_notifications");
      return stored ? JSON.parse(stored) : DEFAULT_NOTIFICATIONS;
    } catch { return DEFAULT_NOTIFICATIONS; }
  });

  const save = (updated: typeof items) => {
    setItems(updated);
    sessionStorage.setItem("rf_notifications", JSON.stringify(updated));
  };

  const markAllRead = () => save(items.map((n: any) => ({ ...n, read: true })));
  const markRead = (id: string) => save(items.map((n: any) => n.id === id ? { ...n, read: true } : n));
  const dismiss = (id: string) => save(items.filter((n: any) => n.id !== id));

  const unreadCount = items.filter((n: any) => !n.read).length;
  return { items, unreadCount, markAllRead, markRead, dismiss };
}

// ── Page titles ───────────────────────────────────────────────────────────────
const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard", "/projects": "Projects", "/scans": "Scans",
  "/findings": "Findings", "/settings": "Settings", "/settings/api-keys": "API Keys",
  "/settings/billing": "Billing", "/analytics": "Analytics", "/reports": "Reports",
  "/chat": "AI Chat",
};

export function Header({ user }: { user?: User }) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Notifications state
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const { items: notifications, unreadCount, markAllRead, markRead, dismiss } = useNotifications();

  const { mutate: doLogout } = useLogout({
    mutation: {
      onSuccess: () => { queryClient.clear(); setLocation("/"); }
    }
  });

  const pageTitle = PAGE_TITLES[location] || "RedForge";
  const initial = user?.name?.charAt(0).toUpperCase() || "A";

  // Filtered search results
  const results = query.trim()
    ? SEARCH_ITEMS.filter(it =>
        it.label.toLowerCase().includes(query.toLowerCase()) ||
        it.description.toLowerCase().includes(query.toLowerCase())
      )
    : SEARCH_ITEMS;

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(v => !v);
      }
      if (e.key === "Escape") { setSearchOpen(false); setNotifOpen(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus input when search opens
  useEffect(() => {
    if (searchOpen) {
      setQuery(""); setSelectedIdx(0);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  // Keyboard nav inside results
  const handleSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && results[selectedIdx]) {
      setLocation(results[selectedIdx].path);
      setSearchOpen(false);
    }
  };

  // Close notification panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <>
      <header
        className="h-14 flex items-center justify-between px-5 md:px-7 border-b border-border sticky top-0 z-20 shrink-0"
        style={{ background: "oklch(6% 0 0 / 0.85)", backdropFilter: "blur(12px)" }}
      >
        {/* Search trigger */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden md:flex items-center gap-2 text-xs text-muted-foreground rounded-lg border border-border px-3 py-2 cursor-pointer hover:border-white/20 hover:text-white transition-all group"
            style={{ background: "oklch(8% 0 0)" }}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Quick search</span>
            <kbd className="ml-1 font-mono text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground" style={{ background: "oklch(12% 0 0)" }}>⌘K</kbd>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Notification bell */}
          <div className="relative" ref={notifRef}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setNotifOpen(v => !v); if (!notifOpen) markAllRead(); }}
              className="relative w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/6 transition-all"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-primary rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </motion.button>

            {/* Notification panel */}
            <AnimatePresence>
              {notifOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 } as any}
                  animate={{ opacity: 1, y: 0, scale: 1 } as any}
                  exit={{ opacity: 0, y: 8, scale: 0.96 } as any}
                  transition={{ duration: 0.18 } as any}
                  className="absolute right-0 top-10 w-80 rounded-xl border border-border shadow-2xl overflow-hidden z-50"
                  style={{ background: "oklch(8% 0 0)" }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <span className="text-sm font-semibold text-white">Notifications</span>
                    <button onClick={markAllRead} className="text-[10px] text-primary hover:text-primary/80 font-medium flex items-center gap-1">
                      <Check className="w-3 h-3" /> Mark all read
                    </button>
                  </div>

                  {/* Items */}
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">No notifications</p>
                    ) : notifications.map((n: any) => (
                      <div
                        key={n.id}
                        className={`flex gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-white/3 transition-colors ${!n.read ? "bg-primary/5" : ""}`}
                      >
                        {/* Color dot */}
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.type === "success" ? "bg-emerald-400" : n.type === "warning" ? "bg-amber-400" : "bg-blue-400"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white">{n.title}</p>
                          <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{n.body}</p>
                          <p className="text-[10px] text-zinc-600 mt-1">{n.time}</p>
                        </div>
                        <button onClick={() => dismiss(n.id)} className="text-zinc-600 hover:text-zinc-400 shrink-0 mt-0.5">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

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

      {/* ── Command Palette ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {searchOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setSearchOpen(false)}
            />

            {/* Palette */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -12 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="fixed top-[15vh] left-1/2 -translate-x-1/2 z-50 w-full max-w-lg rounded-2xl border border-white/12 shadow-2xl overflow-hidden"
              style={{ background: "oklch(7% 0.005 260)" }}
            >
              {/* Input row */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/8">
                <Search className="w-4 h-4 text-zinc-500 shrink-0" />
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={e => { setQuery(e.target.value); setSelectedIdx(0); }}
                  onKeyDown={handleSearchKey}
                  placeholder="Search pages, settings, features…"
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-600 outline-none"
                />
                {query && (
                  <button onClick={() => setQuery("")} className="text-zinc-600 hover:text-zinc-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/10 text-zinc-600" style={{ background: "oklch(10% 0 0)" }}>ESC</kbd>
              </div>

              {/* Results */}
              <div className="max-h-80 overflow-y-auto py-2">
                {results.length === 0 ? (
                  <p className="text-sm text-zinc-600 text-center py-8">No results for "{query}"</p>
                ) : results.map((item, i) => (
                  <button
                    key={item.path}
                    onClick={() => { setLocation(item.path); setSearchOpen(false); }}
                    onMouseEnter={() => setSelectedIdx(i)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === selectedIdx ? "bg-white/6" : "hover:bg-white/3"}`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${i === selectedIdx ? "bg-primary/20 text-primary" : "bg-white/6 text-zinc-500"}`}>
                      <item.icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${i === selectedIdx ? "text-white" : "text-zinc-300"}`}>{item.label}</p>
                      <p className="text-[11px] text-zinc-600 truncate">{item.description}</p>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${i === selectedIdx ? "text-zinc-400" : "text-zinc-700"}`} />
                  </button>
                ))}
              </div>

              {/* Footer hint */}
              <div className="px-4 py-2.5 border-t border-white/6 flex items-center gap-4">
                {[["↑↓", "navigate"], ["↵", "open"], ["esc", "close"]].map(([key, action]) => (
                  <span key={action} className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                    <kbd className="font-mono px-1 py-0.5 rounded border border-white/8 text-zinc-500" style={{ background: "oklch(10% 0 0)" }}>{key}</kbd>
                    {action}
                  </span>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
