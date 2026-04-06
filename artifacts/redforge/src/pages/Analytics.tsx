import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { useListFindings, useListProjects, useGetDashboardStats } from "@workspace/api-client-react";
import { TrendingUp, Shield, Bug, Target, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

const SEV_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#f59e0b",
  LOW: "#22c55e",
  INFO: "#6366f1",
};

const STATUS_COLORS: Record<string, string> = {
  OPEN:           "#ef4444",
  IN_PROGRESS:    "#f59e0b",
  FIXED:          "#22c55e",
  WONT_FIX:       "#71717a",
  FALSE_POSITIVE: "#6366f1",
};

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.4, ease: [0.16, 1, 0.3, 1] } }),
};

function StatCard({ icon: Icon, label, value, sub, color = "text-primary" }: any) {
  return (
    <motion.div
      variants={fadeUp}
      className="bg-card border border-border rounded-2xl p-5 flex items-start gap-4"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0`} style={{ background: "oklch(9% 0 0)" }}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
        <p className="text-sm font-medium text-white">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  );
}

const CustomTooltipDark = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 px-3 py-2 text-xs shadow-xl" style={{ background: "oklch(9% 0 0)" }}>
      {label && <p className="text-muted-foreground mb-1">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color || p.fill }} className="font-semibold">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      {sub && <p className="text-sm text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function Analytics() {
  const { data: findings = [], isLoading: loadingF } = useListFindings({ severity: "", status: "" } as any);
  const { data: projects = [] } = useListProjects();
  const { data: stats } = useGetDashboardStats();

  const findingsArr = Array.isArray(findings) ? findings : (findings as any)?.findings ?? [];

  const bySeverity = useMemo(() => {
    const counts: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
    findingsArr.forEach((f: any) => { if (counts[f.severity] !== undefined) counts[f.severity]++; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
  }, [findingsArr]);

  const byStatus = useMemo(() => {
    const counts: Record<string, number> = { OPEN: 0, IN_PROGRESS: 0, FIXED: 0, WONT_FIX: 0, FALSE_POSITIVE: 0 };
    findingsArr.forEach((f: any) => { if (counts[f.status] !== undefined) counts[f.status]++; });
    return Object.entries(counts)
      .map(([name, value]) => ({ name: name.replace(/_/g, " "), value, key: name }))
      .filter(d => d.value > 0);
  }, [findingsArr]);

  const byProject = useMemo(() => {
    const counts: Record<string, { name: string; findings: number }> = {};
    findingsArr.forEach((f: any) => {
      if (!counts[f.projectId]) counts[f.projectId] = { name: f.projectName || f.projectId?.slice(0, 8) || "Unknown", findings: 0 };
      counts[f.projectId].findings++;
    });
    return Object.values(counts).sort((a, b) => b.findings - a.findings).slice(0, 8);
  }, [findingsArr]);

  const overTime = useMemo(() => {
    const days: Record<string, number> = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days[d.toISOString().slice(0, 10)] = 0;
    }
    findingsArr.forEach((f: any) => {
      const day = (f.createdAt || "").slice(0, 10);
      if (days[day] !== undefined) days[day]++;
    });
    return Object.entries(days).map(([date, count]) => ({
      date: date.slice(5),
      count,
    }));
  }, [findingsArr]);

  const owaspDist = useMemo(() => {
    const counts: Record<string, number> = {};
    findingsArr.forEach((f: any) => {
      const cat = f.owasp || "Other";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([name, value]) => ({ name: name.length > 20 ? name.slice(0, 18) + "…" : name, value }));
  }, [findingsArr]);

  const criticalCount = findingsArr.filter((f: any) => f.severity === "CRITICAL").length;
  const highCount = findingsArr.filter((f: any) => f.severity === "HIGH").length;
  const fixedCount = findingsArr.filter((f: any) => f.status === "FIXED").length;
  const fixRate = findingsArr.length ? Math.round((fixedCount / findingsArr.length) * 100) : 0;
  const openCount = findingsArr.filter((f: any) => f.status === "OPEN").length;

  if (loadingF) {
    return (
      <div className="space-y-4">
        {[...Array(6)].map((_, i) => <div key={i} className="animate-pulse h-40 bg-card rounded-2xl border border-border" />)}
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      className="space-y-8 pb-12"
    >
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">Security posture overview across all your projects</p>
      </motion.div>

      {/* Stats Row */}
      <motion.div
        variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <StatCard icon={Bug} label="Total Findings" value={findingsArr.length} sub="All time" color="text-zinc-400" />
        <StatCard icon={AlertTriangle} label="Critical" value={criticalCount} sub={`${highCount} High`} color="text-red-500" />
        <StatCard icon={CheckCircle2} label="Fix Rate" value={`${fixRate}%`} sub={`${fixedCount} resolved`} color="text-green-500" />
        <StatCard icon={Clock} label="Open" value={openCount} sub="Need attention" color="text-amber-500" />
      </motion.div>

      {/* Row 1: Severity Donut + Findings over time */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <motion.div variants={fadeUp} custom={1} className="bg-card border border-border rounded-2xl p-6 lg:col-span-2">
          <SectionHeader title="Findings by Severity" />
          {bySeverity.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">No findings yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={bySeverity} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {bySeverity.map((entry) => (
                    <Cell key={entry.name} fill={SEV_COLORS[entry.name] || "#6366f1"} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltipDark />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span className="text-xs text-zinc-300">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <motion.div variants={fadeUp} custom={1.5} className="bg-card border border-border rounded-2xl p-6 lg:col-span-3">
          <SectionHeader title="Findings Over Time" sub="Last 30 days" />
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={overTime}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 10 }} interval={6} />
              <YAxis tick={{ fill: "#71717a", fontSize: 10 }} width={28} allowDecimals={false} />
              <Tooltip content={<CustomTooltipDark />} />
              <Area type="monotone" dataKey="count" name="Findings" stroke="#ef4444" strokeWidth={2} fill="url(#areaGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Row 2: By Status + By Project */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <motion.div variants={fadeUp} custom={2} className="bg-card border border-border rounded-2xl p-6 lg:col-span-2">
          <SectionHeader title="Findings by Status" />
          {byStatus.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {byStatus.map((entry) => (
                    <Cell key={entry.key} fill={STATUS_COLORS[entry.key] || "#6366f1"} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltipDark />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span className="text-xs text-zinc-300" style={{ textTransform: "capitalize" }}>{(value as string).toLowerCase().replace("_", " ")}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <motion.div variants={fadeUp} custom={2.5} className="bg-card border border-border rounded-2xl p-6 lg:col-span-3">
          <SectionHeader title="Findings by Project" sub="Top 8 projects" />
          {byProject.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">No projects yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byProject} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#71717a", fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 10 }} width={100} />
                <Tooltip content={<CustomTooltipDark />} />
                <Bar dataKey="findings" name="Findings" fill="#ef4444" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      {/* Row 3: OWASP distribution */}
      {owaspDist.length > 0 && (
        <motion.div variants={fadeUp} custom={3} className="bg-card border border-border rounded-2xl p-6">
          <SectionHeader title="OWASP Category Distribution" sub="Vulnerability categories detected across scans" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={owaspDist}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 10 }} />
              <YAxis tick={{ fill: "#71717a", fontSize: 10 }} width={28} allowDecimals={false} />
              <Tooltip content={<CustomTooltipDark />} />
              <Bar dataKey="value" name="Findings" radius={[6, 6, 0, 0]}>
                {owaspDist.map((_, i) => (
                  <Cell key={i} fill={["#ef4444","#f97316","#f59e0b","#84cc16","#22c55e","#06b6d4","#6366f1","#a855f7"][i % 8]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Row 4: Severity vs Status heatmap style breakdown table */}
      <motion.div variants={fadeUp} custom={3.5} className="bg-card border border-border rounded-2xl p-6">
        <SectionHeader title="Risk Breakdown" sub="Findings matrix by severity and status" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Severity</th>
                {["OPEN","IN_PROGRESS","FIXED","WONT_FIX","FALSE_POSITIVE"].map(s => (
                  <th key={s} className="text-center py-2 px-3 text-muted-foreground font-medium text-xs">
                    {s.replace(/_/g, " ")}
                  </th>
                ))}
                <th className="text-center py-2 px-3 text-muted-foreground font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {["CRITICAL","HIGH","MEDIUM","LOW","INFO"].map(sev => {
                const row = findingsArr.filter((f: any) => f.severity === sev);
                const total = row.length;
                if (total === 0) return null;
                return (
                  <tr key={sev} className="border-b border-border/50 hover:bg-white/2 transition-colors">
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: SEV_COLORS[sev] }} />
                        <span className="font-semibold text-white text-xs">{sev}</span>
                      </span>
                    </td>
                    {["OPEN","IN_PROGRESS","FIXED","WONT_FIX","FALSE_POSITIVE"].map(st => {
                      const count = row.filter((f: any) => f.status === st).length;
                      return (
                        <td key={st} className="text-center py-3 px-3">
                          {count > 0 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold text-white"
                              style={{ background: `${SEV_COLORS[sev]}22`, border: `1px solid ${SEV_COLORS[sev]}44` }}>
                              {count}
                            </span>
                          ) : <span className="text-zinc-700">—</span>}
                        </td>
                      );
                    })}
                    <td className="text-center py-3 px-3 font-bold text-white">{total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}
