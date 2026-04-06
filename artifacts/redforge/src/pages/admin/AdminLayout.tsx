import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Users, Tag, Activity, Mail, Shield,
  ChevronRight, LogOut
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const navItems = [
  { icon: LayoutDashboard, label: "Overview",    href: "/admin" },
  { icon: Users,           label: "Users",       href: "/admin/users" },
  { icon: Tag,             label: "Coupons",     href: "/admin/coupons" },
  { icon: Activity,        label: "Activity",    href: "/admin/activity" },
  { icon: Mail,            label: "Emails",      href: "/admin/emails" },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: me } = useGetMe();

  if (me?.user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-zinc-400 mb-4">Admin privileges required.</p>
          <Link href="/dashboard" className="text-primary hover:underline">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-56 bg-card border-r border-border flex flex-col fixed inset-y-0 left-0 z-30">
        <div className="h-14 flex items-center gap-2 px-4 border-b border-border">
          <img src="/logo.png" alt="RedForge" className="w-7 h-7 object-contain" />
          <span className="font-bold text-sm text-white">Admin Panel</span>
          <span className="ml-auto text-[10px] bg-red-900/40 text-red-400 border border-red-800/50 px-1.5 py-0.5 rounded">ADMIN</span>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-0.5">
          {navItems.map(({ icon: Icon, label, href }) => {
            const active = location === href || (href !== "/admin" && location.startsWith(href));
            return (
              <Link key={href} href={href}>
                <motion.div
                  whileHover={{ x: 2 }}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors ${
                    active
                      ? "bg-red-500/10 text-red-400 border border-red-500/20"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {label}
                  {active && <ChevronRight className="w-3 h-3 ml-auto" />}
                </motion.div>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border space-y-1">
          <Link href="/dashboard">
            <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs text-zinc-500 hover:text-white hover:bg-white/5 cursor-pointer transition-colors">
              <LogOut className="w-3.5 h-3.5" />
              Back to App
            </div>
          </Link>
          <div className="px-3 py-1.5 text-xs text-zinc-600 truncate">
            {me?.user?.email}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-56 min-h-screen overflow-auto">
        <div className="max-w-7xl mx-auto p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
