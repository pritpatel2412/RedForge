import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  User, Mail, Calendar, Shield, Scan, AlertTriangle,
  MonitorSmartphone, Lock, Save, Loader2,
  Eye, EyeOff, Edit3, X, ShieldCheck,
  Key, Activity, Flame, TrendingUp, ChevronDown, LogOut,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function dicebear(seed: string) {
  return `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(seed)}&backgroundColor=transparent`;
}

// ── Heatmap colour scale (RedForge red theme) ─────────────────────────────────
function cellColor(count: number): string {
  if (count === 0) return "hsl(0,0%,11%)";
  if (count === 1) return "hsl(348,70%,22%)";
  if (count <= 3)  return "hsl(348,78%,33%)";
  if (count <= 6)  return "hsl(348,83%,46%)";
  if (count <= 10) return "hsl(348,88%,58%)";
  return             "hsl(348,95%,70%)";
}

// ── Heatmap component ─────────────────────────────────────────────────────────
function FindingsHeatmap({ data }: {
  data: { days: Record<string, number>; totalInYear: number; currentStreak: number; maxStreak: number } | null | undefined;
}) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef    = useRef<HTMLDivElement>(null);

  // Auto-scroll to show today (rightmost column) on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [data]);

  if (!data) {
    return (
      <div className="h-36 skeleton rounded-2xl" />
    );
  }

  // Build ordered list of exactly 365 days
  const today = new Date();
  const days: string[] = [];
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  // Group into weeks (columns of 7)
  // First, pad start so grid aligns to Sunday (day 0)
  const firstDay = new Date(days[0]);
  const startPad = firstDay.getDay(); // 0=Sun … 6=Sat
  const paddedDays: (string | null)[] = [...Array(startPad).fill(null), ...days];
  // Chunk into columns of 7
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < paddedDays.length; i += 7) {
    weeks.push(paddedDays.slice(i, i + 7));
  }

  // Month labels — find week index where month changes
  const monthLabels: { label: string; col: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const firstReal = week.find(d => d !== null);
    if (!firstReal) return;
    const m = new Date(firstReal).getMonth();
    if (m !== lastMonth) {
      monthLabels.push({ label: new Date(firstReal).toLocaleString("default", { month: "short" }), col: wi });
      lastMonth = m;
    }
  });

  const CELL = 13;   // px per cell
  const GAP  = 3;    // px gap

  return (
    <div ref={containerRef} className="relative select-none">
      {/* Summary row */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mb-4">
        <p className="text-sm text-white font-semibold">
          <span className="text-2xl font-bold text-primary mr-1">{data.totalInYear}</span>
          findings in the past year
        </p>
        <span className="text-xs text-zinc-500 flex items-center gap-1">
          <Flame className="w-3.5 h-3.5 text-orange-400" />
          Current streak: <span className="text-white font-semibold ml-1">{data.currentStreak}d</span>
        </span>
        <span className="text-xs text-zinc-500 flex items-center gap-1">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          Max streak: <span className="text-white font-semibold ml-1">{data.maxStreak}d</span>
        </span>
      </div>

      {/* Scrollable grid — auto-scrolled to today via ref */}
      <div ref={scrollRef} className="overflow-x-auto pb-1">
        <div style={{ display: "inline-block", minWidth: "fit-content" }}>
          {/* Month labels */}
          <div style={{ display: "flex", marginLeft: 0, marginBottom: 4, height: 14 }}>
            {weeks.map((_, wi) => {
              const lbl = monthLabels.find(m => m.col === wi);
              return (
                <div
                  key={wi}
                  style={{ width: CELL + GAP, flexShrink: 0, textAlign: "left", fontSize: 10, color: "#52525b" }}
                >
                  {lbl ? lbl.label : ""}
                </div>
              );
            })}
          </div>

          {/* Grid rows (0=Sun … 6=Sat) */}
          <div style={{ display: "flex", flexDirection: "column", gap: GAP }}>
            {[0, 1, 2, 3, 4, 5, 6].map(rowIdx => (
              <div key={rowIdx} style={{ display: "flex", gap: GAP }}>
                {weeks.map((week, wi) => {
                  const day = week[rowIdx] ?? null;
                  const count = day ? (data.days[day] ?? 0) : null;
                  return (
                    <motion.div
                      key={wi}
                      whileHover={day ? { scale: 1.25, zIndex: 10 } : {}}
                      style={{
                        width: CELL,
                        height: CELL,
                        borderRadius: 3,
                        background: day ? cellColor(count!) : "transparent",
                        cursor: day ? "pointer" : "default",
                        flexShrink: 0,
                        position: "relative",
                      }}
                      onMouseEnter={(e) => {
                        if (!day) return;
                        const rect = containerRef.current?.getBoundingClientRect();
                        const cellRect = (e.target as HTMLElement).getBoundingClientRect();
                        setTooltip({
                          x: cellRect.left - (rect?.left ?? 0) + CELL / 2,
                          y: cellRect.top  - (rect?.top  ?? 0) - 32,
                          text: `${count} finding${count !== 1 ? "s" : ""} · ${new Date(day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* Day labels */}
          <div style={{ display: "flex", flexDirection: "column", gap: GAP, position: "absolute", left: -22, top: 18 }}>
            {["", "M", "", "W", "", "F", ""].map((l, i) => (
              <div key={i} style={{ height: CELL, fontSize: 9, color: "#52525b", lineHeight: `${CELL}px` }}>{l}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-50 pointer-events-none px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white border border-white/10 whitespace-nowrap"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translateX(-50%)",
            background: "oklch(10% 0 0)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
          }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-3 justify-end">
        <span className="text-[10px] text-zinc-600">Less</span>
        {[0, 1, 3, 6, 10, 15].map(v => (
          <div key={v} style={{ width: 11, height: 11, borderRadius: 2, background: cellColor(v) }} />
        ))}
        <span className="text-[10px] text-zinc-600">More</span>
      </div>
    </div>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────
function StatPill({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: string | number; color: string;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${color}`}>
      <Icon className="w-4 h-4 shrink-0" />
      <div>
        <p className="text-lg font-bold text-white leading-tight">{value ?? "—"}</p>
        <p className="text-[11px] text-zinc-500 leading-tight">{label}</p>
      </div>
    </div>
  );
}

// ── Password field ─────────────────────────────────────────────────────────────
function PwdField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="text-sm font-medium text-zinc-300 block mb-2">{label}</label>
      <div className="relative max-w-sm">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary transition-all pr-10 text-sm"
        />
        <button type="button" onClick={() => setShow(v => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const qc = useQueryClient();

  const { data: meData, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: () => fetch("/api/auth/me", { credentials: "include" }).then(r => r.json()),
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/auth/stats"],
    queryFn: () => fetch("/api/auth/stats", { credentials: "include" }).then(r => r.json()),
    enabled: !!meData,
  });

  const { data: heatmap } = useQuery({
    queryKey: ["/api/auth/heatmap"],
    queryFn: () => fetch("/api/auth/heatmap", { credentials: "include" }).then(r => r.json()),
    enabled: !!meData,
    staleTime: 5 * 60 * 1000,
  });

  const user      = meData?.user;
  const workspace = meData?.workspace;
  const isOAuth   = user && !user.passwordHash;

  // Name editing
  const [name, setName]           = useState("");
  const [editingName, setEditing] = useState(false);

  // Password
  const [pwdOpen, setPwdOpen]     = useState(false);
  const [curPwd,  setCurPwd]      = useState("");
  const [newPwd,  setNewPwd]      = useState("");
  const [conPwd,  setConPwd]      = useState("");

  useEffect(() => { if (user) setName(user.name || ""); }, [user]);

  const updateProfile = useMutation({
    mutationFn: (body: object) =>
      fetch("/api/auth/profile", {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    onSuccess: () => { toast.success("Profile updated!"); qc.invalidateQueries({ queryKey: ["/api/auth/me"] }); setEditing(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const changePwd = useMutation({
    mutationFn: (body: object) =>
      fetch("/api/auth/profile", {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    onSuccess: () => {
      toast.success("Password changed!");
      setCurPwd(""); setNewPwd(""); setConPwd(""); setPwdOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handlePwd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd !== conPwd) { toast.error("Passwords don't match"); return; }
    changePwd.mutate({ currentPassword: curPwd, newPassword: newPwd });
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto animate-in fade-in duration-500 pb-12 space-y-6">
        <div className="h-8 w-48 skeleton rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 skeleton rounded-2xl" />
          <div className="h-80 skeleton rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-500 pb-16 space-y-6">

      {/* ── Page title */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-1">My Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your identity and track your security research activity.</p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TOP ROW: left = identity card | right = heatmap
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* LEFT ── Identity card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
          className="relative overflow-hidden rounded-2xl border border-border p-6 flex flex-col gap-5"
          style={{ background: "linear-gradient(135deg, oklch(10% 0.01 0) 0%, oklch(8% 0.025 350) 100%)" }}
        >
          {/* Red glow blob */}
          <div className="absolute -top-12 -right-12 w-52 h-52 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, hsl(348,83%,45%,0.12), transparent 70%)" }} />

          {/* Avatar + name row */}
          <div className="flex items-center gap-4">
            {/* Gradient-ringed avatar */}
            <div className="relative shrink-0">
              <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden"
                style={{ padding: 2, background: "linear-gradient(135deg,hsl(348,83%,55%),hsl(20,100%,55%),hsl(280,70%,60%))" }}>
                <div className="w-full h-full rounded-[14px] overflow-hidden bg-zinc-950 flex items-center justify-center">
                  {user?.avatarUrl
                    ? <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                    : <img src={dicebear(user?.name || "User")} alt={user?.name} className="w-full h-full object-cover" />
                  }
                </div>
              </div>
              {/* Online dot */}
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-zinc-950" />
            </div>

            <div className="flex-1 min-w-0">
              {/* Inline name edit */}
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") updateProfile.mutate({ name });
                      if (e.key === "Escape") { setEditing(false); setName(user?.name || ""); }
                    }}
                    className="flex-1 bg-zinc-900 border border-primary rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none"
                  />
                  <button onClick={() => updateProfile.mutate({ name })} disabled={updateProfile.isPending}
                    className="p-1.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30">
                    {updateProfile.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => { setEditing(false); setName(user?.name || ""); }}
                    className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white truncate">{user?.name || "—"}</h2>
                  <button onClick={() => setEditing(true)}
                    className="p-1 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-all shrink-0" title="Edit name">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {/* Role badge */}
              <span className={`inline-flex items-center mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest ${
                user?.role === "admin"
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-zinc-800 text-zinc-400 border border-zinc-700"
              }`}>
                {user?.role || "member"}
              </span>
            </div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-1 gap-3 text-sm">
            <div className="flex items-center gap-2.5 py-2 border-b border-white/6">
              <Mail className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
              <span className="text-zinc-300 truncate">{user?.email || "—"}</span>
            </div>
            <div className="flex items-center gap-2.5 py-2 border-b border-white/6">
              <ShieldCheck className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
              <span className="text-zinc-300 truncate">{workspace?.name || "—"}</span>
              {workspace?.plan && (
                <span className="ml-auto text-[10px] font-bold text-primary uppercase tracking-wider shrink-0">{workspace.plan}</span>
              )}
            </div>
            <div className="flex items-center gap-2.5 py-2 border-b border-white/6">
              <Key className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
              <span className="text-zinc-400 text-xs">{isOAuth ? "OAuth account (Google / GitHub)" : "Email & password account"}</span>
            </div>
            <div className="flex items-center gap-2.5 py-2">
              <Calendar className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
              <span className="text-zinc-400 text-xs">
                Member since {stats?.memberSince ? formatDate(stats.memberSince) : "—"}
              </span>
            </div>
          </div>
        </motion.div>

        {/* RIGHT ── Heatmap card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.08 }}
          className="rounded-2xl border border-border p-6 flex flex-col gap-4"
          style={{ background: "oklch(9% 0.005 0)" }}
        >
          <div className="flex items-center gap-2 border-b border-border pb-4">
            <Activity className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-white">Findings Activity</h2>
            <span className="ml-auto text-[10px] text-zinc-600">Past 12 months</span>
          </div>
          <div className="relative ml-6 flex-1">
            <FindingsHeatmap data={heatmap} />
          </div>
        </motion.div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          STATS ROW
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatPill icon={Scan} label="Total Scans"
          value={stats?.totalScans ?? "—"}
          color="bg-blue-500/10 border-blue-500/20 text-blue-400" />
        <StatPill icon={Shield} label="Total Findings"
          value={stats?.totalFindings ?? "—"}
          color="bg-emerald-500/10 border-emerald-500/20 text-emerald-400" />
        <StatPill icon={AlertTriangle} label="Critical Findings"
          value={stats?.criticalFindings ?? "—"}
          color="bg-red-500/10 border-red-500/20 text-red-400" />
        <StatPill icon={MonitorSmartphone} label="Active Sessions"
          value={stats?.activeSessions ?? "—"}
          color="bg-violet-500/10 border-violet-500/20 text-violet-400" />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          BOTTOM ROW: left = password | right = danger zone
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Password & Security */}
        <div className="rounded-2xl border border-border p-6 space-y-5" style={{ background: "oklch(9% 0.005 0)" }}>
          <div className="flex items-center gap-2 border-b border-border pb-4">
            <Lock className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-white">Password &amp; Security</h2>
          </div>

          {isOAuth ? (
            <div className="flex items-start gap-3 p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
              <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <p className="text-sm text-zinc-400">
                Your account uses OAuth — password management is handled by your identity provider.
              </p>
            </div>
          ) : !pwdOpen ? (
            <div className="space-y-3">
              <button
                onClick={() => setPwdOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl text-sm font-medium border border-border transition-all"
              >
                <Key className="w-4 h-4" />
                Change Password
              </button>
              <p className="text-xs text-zinc-600">
                Forgot your current password?{" "}
                <Link
                  href="/auth/forgot-password"
                  className="text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
                >
                  Send reset email
                </Link>
              </p>
            </div>
          ) : (
            <form onSubmit={handlePwd} className="space-y-4">
              <PwdField label="Current Password" value={curPwd} onChange={setCurPwd} placeholder="Enter current password" />
              <PwdField label="New Password" value={newPwd} onChange={setNewPwd} placeholder="Min. 8 characters" />
              <PwdField label="Confirm New Password" value={conPwd} onChange={setConPwd} placeholder="Repeat new password" />
              {newPwd && conPwd && newPwd !== conPwd && (
                <p className="text-xs text-red-400 flex items-center gap-1"><X className="w-3 h-3" /> Passwords don't match</p>
              )}
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={changePwd.isPending}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50">
                  {changePwd.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Update
                </button>
                <button type="button" onClick={() => { setPwdOpen(false); setCurPwd(""); setNewPwd(""); setConPwd(""); }}
                  className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-xl text-sm font-medium transition-all">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Danger zone */}
        <div className="rounded-2xl border border-red-900/40 p-6 space-y-5" style={{ background: "oklch(9% 0.005 0)" }}>
          <div className="flex items-center gap-2 border-b border-red-900/30 pb-4">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h2 className="text-sm font-bold text-red-400">Danger Zone</h2>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-zinc-300">Sign out everywhere</p>
              <p className="text-xs text-zinc-500 mt-0.5">Revoke all active sessions across every device.</p>
              <button
                onClick={() => {
                  if (!confirm("Sign out of all devices?")) return;
                  fetch("/api/auth/logout", { method: "POST", credentials: "include" })
                    .then(() => { window.location.href = "/"; })
                    .catch(() => toast.error("Failed"));
                }}
                className="mt-3 flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 rounded-xl text-sm font-medium transition-all"
              >
                <LogOut className="w-4 h-4" /> Sign out everywhere
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
