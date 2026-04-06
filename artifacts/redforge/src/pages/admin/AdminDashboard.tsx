import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import { Users, Building2, Zap, Mail, Activity, TrendingUp, Shield, AlertTriangle } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function useAdminStats() {
  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/admin/stats`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 30000,
  });
}

const PLAN_COLORS = { PRO: "#e11d48", ENTERPRISE: "#818cf8", FREE: "#3f3f46" };

function StatCard({ icon: Icon, label, value, sub, color = "text-white" }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-5"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide mb-1">{label}</p>
          <p className={`text-3xl font-bold ${color}`}>{value}</p>
          {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
          <Icon className="w-5 h-5 text-zinc-400" />
        </div>
      </div>
    </motion.div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-xs">
      <p className="text-zinc-400 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
};

function fillDays(data: Array<{ day: string; count: number }>, days = 14): Array<{ day: string; count: number }> {
  const result: Array<{ day: string; count: number }> = [];
  const map = new Map(data.map(d => [d.day, Number(d.count)]));
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    result.push({ day: key.slice(5), count: map.get(key) || 0 });
  }
  return result;
}

export default function AdminDashboard() {
  const { data, isLoading } = useAdminStats();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-zinc-800 rounded animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 bg-zinc-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const t = data?.totals || {};
  const activityChart = fillDays(data?.dailyActivity || []);
  const signupChart = fillDays(data?.signupTrend || [], 14);
  const planDist = [
    { name: "PRO", value: Number(t.pro || 0) },
    { name: "Enterprise", value: Number(t.enterprise || 0) },
    { name: "Free", value: Number(t.free || 0) },
  ].filter(d => d.value > 0);

  const topActions = (data?.topActions || []).slice(0, 6).map((a: any) => ({
    action: a.action.replace("auth.", "").replace("admin.", "admin:"),
    count: Number(a.count),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Overview</h1>
        <p className="text-zinc-500 text-sm mt-1">Real-time platform analytics</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Users" value={t.users ?? "—"} />
        <StatCard icon={Building2} label="Workspaces" value={t.workspaces ?? "—"} />
        <StatCard icon={Zap} label="Pro Plans" value={t.pro ?? "—"} color="text-red-400" />
        <StatCard icon={Shield} label="Enterprise" value={t.enterprise ?? "—"} color="text-indigo-400" />
        <StatCard icon={TrendingUp} label="Active Trials" value={t.activeTrials ?? "—"} color="text-emerald-400" />
        <StatCard icon={AlertTriangle} label="Expired Trials" value={t.expiredTrials ?? "—"} color="text-yellow-400" sub="Need upgrade" />
        <StatCard icon={Activity} label="Total Activity" value={t.activity ?? "—"} sub="All-time events" />
        <StatCard icon={Mail} label="Emails Sent" value={t.emailsSent ?? "—"} sub={`of ${t.emailsTotal ?? 0} logged`} />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Activity chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Activity (last 14 days)</h2>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={activityChart}>
              <defs>
                <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#e11d48" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#e11d48" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
              <XAxis dataKey="day" tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="count" name="Events" stroke="#e11d48" fill="url(#actGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Plan distribution */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Plan Distribution</h2>
          {planDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={planDist} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                  {planDist.map((entry, index) => (
                    <Cell key={index} fill={index === 0 ? "#e11d48" : index === 1 ? "#818cf8" : "#3f3f46"} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#71717a" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-44 text-zinc-600 text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Signup trend */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">New Signups (last 14 days)</h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={signupChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
              <XAxis dataKey="day" tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Signups" fill="#e11d48" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top actions */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Top Actions</h2>
          {topActions.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={topActions} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis dataKey="action" type="category" tick={{ fill: "#a1a1aa", fontSize: 11 }} tickLine={false} axisLine={false} width={90} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Count" fill="#818cf8" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-zinc-600 text-sm">No activity yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
