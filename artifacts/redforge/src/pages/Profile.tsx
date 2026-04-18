"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  User, Mail, Calendar, Shield, Scan, AlertTriangle,
  MonitorSmartphone, Lock, Save, Loader2, LogOut,
  CheckCircle2, Eye, EyeOff, Edit3, X, ShieldCheck,
  Activity, Key,
} from "lucide-react";

// ── DiceBear avatar (same as Header) ─────────────────────────────────────────
function dicebear(seed: string, size = 96) {
  return `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(seed)}&backgroundColor=transparent&size=${size}`;
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: string | number; color: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4"
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </motion.div>
  );
}

// ── Section card wrapper ──────────────────────────────────────────────────────
function Card({ title, icon: Icon, children }: { title: string; icon?: any; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-6">
      <div className="flex items-center gap-2 border-b border-border pb-4">
        {Icon && <Icon className="w-4 h-4 text-primary" />}
        <h2 className="text-base font-bold text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ── Input field ───────────────────────────────────────────────────────────────
function Field({
  label, value, onChange, type = "text", disabled = false, placeholder = "", hint,
  rightEl
}: {
  label: string; value: string; onChange?: (v: string) => void;
  type?: string; disabled?: boolean; placeholder?: string; hint?: string;
  rightEl?: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-zinc-300 block mb-2">{label}</label>
      <div className="relative max-w-md">
        <input
          type={type}
          value={value}
          onChange={e => onChange?.(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full bg-background border border-border rounded-xl px-4 py-3 text-white
            focus:outline-none focus:border-primary transition-all
            ${disabled ? "opacity-50 cursor-not-allowed text-muted-foreground" : ""}
            ${rightEl ? "pr-11" : ""}`}
        />
        {rightEl && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightEl}</div>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground mt-2">{hint}</p>}
    </div>
  );
}

// ── Password field with show/hide ─────────────────────────────────────────────
function PasswordField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <Field
      label={label}
      value={value}
      onChange={onChange}
      type={show ? "text" : "password"}
      placeholder={placeholder}
      rightEl={
        <button type="button" onClick={() => setShow(v => !v)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      }
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const qc = useQueryClient();

  // Fetch /me
  const { data: meData, isLoading: meLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const r = await fetch("/api/auth/me", { credentials: "include" });
      if (!r.ok) throw new Error("Not authenticated");
      return r.json();
    },
  });

  // Fetch /stats
  const { data: stats } = useQuery({
    queryKey: ["/api/auth/stats"],
    queryFn: async () => {
      const r = await fetch("/api/auth/stats", { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!meData,
  });

  const user = meData?.user;
  const workspace = meData?.workspace;

  // Profile form state
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);

  // Password form state
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd]          = useState("");
  const [confirmPwd, setConfirmPwd]  = useState("");
  const [pwdSection, setPwdSection]  = useState(false);

  useEffect(() => {
    if (user) setName(user.name || "");
  }, [user]);

  // Update name mutation
  const updateProfile = useMutation({
    mutationFn: (body: object) =>
      fetch("/api/auth/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Update failed");
        return d;
      }),
    onSuccess: (data) => {
      toast.success("Profile updated!");
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setEditingName(false);
      if (data.name) setName(data.name);
    },
    onError: (err: any) => toast.error(err.message || "Update failed"),
  });

  // Change password mutation
  const changePwd = useMutation({
    mutationFn: (body: object) =>
      fetch("/api/auth/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed");
        return d;
      }),
    onSuccess: () => {
      toast.success("Password changed successfully!");
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
      setPwdSection(false);
    },
    onError: (err: any) => toast.error(err.message || "Password change failed"),
  });

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) { toast.error("Passwords do not match"); return; }
    if (newPwd.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    changePwd.mutate({ currentPassword: currentPwd, newPassword: newPwd });
  };

  const isOAuth = user && !user.passwordHash;

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  }

  if (meLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
        <div className="h-8 w-48 skeleton rounded-xl" />
        <div className="h-48 skeleton rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 skeleton rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">

      {/* ── Page header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-1">My Profile</h1>
        <p className="text-muted-foreground text-sm">Manage your personal information and account security.</p>
      </div>

      {/* ── Identity hero card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden bg-card border border-border rounded-2xl p-7 flex flex-col sm:flex-row gap-6 items-start sm:items-center"
        style={{
          background: "linear-gradient(135deg, oklch(10% 0.01 0) 0%, oklch(8% 0.02 350) 100%)",
        }}
      >
        {/* Glow blob */}
        <div
          className="absolute -top-12 -right-12 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, hsl(348,83%,45%,0.15), transparent 70%)" }}
        />

        {/* Large avatar */}
        <div className="relative shrink-0">
          <div
            className="w-20 h-20 rounded-2xl overflow-hidden"
            style={{
              padding: 2,
              background: "linear-gradient(135deg, hsl(348,83%,55%), hsl(20,100%,55%), hsl(280,70%,60%))",
            }}
          >
            <div className="w-full h-full rounded-[14px] overflow-hidden bg-zinc-950 flex items-center justify-center">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <img
                  src={dicebear(user?.name || "User", 80)}
                  alt={user?.name}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          </div>
          {/* Online indicator */}
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-zinc-950" />
        </div>

        {/* Identity info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-white">{user?.name || "—"}</h2>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest ${
                user?.role === "admin"
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-zinc-800 text-zinc-400 border border-zinc-700"
              }`}
            >
              {user?.role || "member"}
            </span>
          </div>
          <div className="flex flex-col gap-1 mt-2">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Mail className="w-3.5 h-3.5 text-zinc-600" />
              {user?.email}
            </div>
            {workspace && (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <ShieldCheck className="w-3.5 h-3.5 text-zinc-600" />
                {workspace.name} · <span className="text-primary text-xs font-semibold uppercase">{workspace.plan}</span>
              </div>
            )}
            {stats?.memberSince && (
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Calendar className="w-3.5 h-3.5 text-zinc-600" />
                Member since {formatDate(stats.memberSince)}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Scan}           label="Total Scans"      value={stats?.totalScans ?? "—"}       color="bg-blue-500/15 text-blue-400" />
        <StatCard icon={Shield}         label="Findings"         value={stats?.totalFindings ?? "—"}    color="bg-emerald-500/15 text-emerald-400" />
        <StatCard icon={AlertTriangle}  label="Criticals"        value={stats?.criticalFindings ?? "—"} color="bg-red-500/15 text-red-400" />
        <StatCard icon={MonitorSmartphone} label="Active Sessions" value={stats?.activeSessions ?? "—"} color="bg-violet-500/15 text-violet-400" />
      </div>

      {/* ── Edit profile */}
      <Card title="Personal Information" icon={User}>
        <div className="space-y-5">
          {/* Name row */}
          <div>
            <label className="text-sm font-medium text-zinc-300 block mb-2">Display Name</label>
            <div className="flex items-center gap-3 max-w-md">
              {editingName ? (
                <>
                  <input
                    autoFocus
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="flex-1 bg-background border border-primary rounded-xl px-4 py-3 text-white focus:outline-none transition-all"
                    onKeyDown={e => {
                      if (e.key === "Enter") updateProfile.mutate({ name });
                      if (e.key === "Escape") { setEditingName(false); setName(user?.name || ""); }
                    }}
                  />
                  <button
                    onClick={() => updateProfile.mutate({ name })}
                    disabled={updateProfile.isPending}
                    className="p-2.5 rounded-xl bg-primary/20 text-primary hover:bg-primary/30 transition-all"
                  >
                    {updateProfile.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => { setEditingName(false); setName(user?.name || ""); }}
                    className="p-2.5 rounded-xl bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <div className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-white">
                    {name || "—"}
                  </div>
                  <button
                    onClick={() => setEditingName(true)}
                    className="p-2.5 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all"
                    title="Edit name"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          <Field
            label="Email Address"
            value={user?.email || ""}
            disabled
            hint="Email cannot be changed after registration."
          />

          <Field
            label="Account Type"
            value={isOAuth ? "OAuth (Google / GitHub)" : "Email & Password"}
            disabled
          />
        </div>
      </Card>

      {/* ── Password */}
      <Card title="Password & Security" icon={Lock}>
        {isOAuth ? (
          <div className="flex items-center gap-3 py-2 px-4 bg-zinc-900 border border-zinc-800 rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="text-sm text-zinc-400">
              Your account uses OAuth. Password management is handled by your identity provider.
            </p>
          </div>
        ) : (
          <>
            {!pwdSection ? (
              <button
                onClick={() => setPwdSection(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl text-sm font-medium transition-all border border-border"
              >
                <Key className="w-4 h-4" />
                Change Password
              </button>
            ) : (
              <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                <PasswordField
                  label="Current Password"
                  value={currentPwd}
                  onChange={setCurrentPwd}
                  placeholder="Enter current password"
                />
                <PasswordField
                  label="New Password"
                  value={newPwd}
                  onChange={setNewPwd}
                  placeholder="Min. 8 characters"
                />
                <PasswordField
                  label="Confirm New Password"
                  value={confirmPwd}
                  onChange={setConfirmPwd}
                  placeholder="Repeat new password"
                />
                {newPwd && confirmPwd && newPwd !== confirmPwd && (
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    <X className="w-3 h-3" /> Passwords do not match
                  </p>
                )}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={changePwd.isPending}
                    className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-medium transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {changePwd.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Update Password
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPwdSection(false); setCurrentPwd(""); setNewPwd(""); setConfirmPwd(""); }}
                    className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-xl text-sm font-medium transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </Card>

      {/* ── Activity */}
      <Card title="Account Activity" icon={Activity}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-background border border-border rounded-xl p-4 flex flex-col gap-1">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Member Since</p>
            <p className="text-sm font-medium text-white">
              {stats?.memberSince ? formatDate(stats.memberSince) : "—"}
            </p>
          </div>
          <div className="bg-background border border-border rounded-xl p-4 flex flex-col gap-1">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Workspace Plan</p>
            <p className="text-sm font-medium text-white capitalize">{workspace?.plan || "Free"}</p>
          </div>
          <div className="bg-background border border-border rounded-xl p-4 flex flex-col gap-1">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Active Sessions</p>
            <p className="text-sm font-medium text-white">{stats?.activeSessions ?? "—"}</p>
          </div>
        </div>
      </Card>

      {/* ── Danger zone */}
      <div className="bg-card border border-red-900/40 rounded-2xl p-6 md:p-8 space-y-4">
        <div className="flex items-center gap-2 border-b border-red-900/30 pb-4">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <h2 className="text-base font-bold text-red-400">Danger Zone</h2>
        </div>
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <p className="text-sm font-medium text-zinc-300">Sign out of all sessions</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              This will revoke all active sessions and sign you out everywhere.
            </p>
          </div>
          <button
            className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 rounded-xl text-sm font-medium transition-all shrink-0"
            onClick={() => {
              if (!confirm("Are you sure? You will be signed out of all devices.")) return;
              fetch("/api/auth/logout", { method: "POST", credentials: "include" })
                .then(() => { window.location.href = "/"; })
                .catch(() => toast.error("Failed to sign out"));
            }}
          >
            <LogOut className="w-4 h-4" />
            Sign out everywhere
          </button>
        </div>
      </div>

    </div>
  );
}
