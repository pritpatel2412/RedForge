import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Terminal, Shield, Activity, BarChart3, Bug,
  ChevronRight, Play, Pause, SkipForward,
  Cpu, Zap, AlertTriangle, CheckCircle2, Clock,
  Network, ArrowRight, Lock, Eye
} from "lucide-react";

const SCENE_DURATION = 7000;
const SCENES = ["Dashboard", "Live Scan", "Attack Graph"] as const;
type Scene = typeof SCENES[number];

/* ── mini Badge ── */
function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${color}`}>
      {children}
    </span>
  );
}

/* ── Scene 1: Dashboard ── */
function DashboardScene({ visible }: { visible: boolean }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!visible) { setCount(0); return; }
    const t = setInterval(() => setCount(c => Math.min(c + 1, 4)), 220);
    return () => clearInterval(t);
  }, [visible]);

  const metrics = [
    { label: "Total Findings", value: "23", sub: "+4 this week", color: "text-white", icon: Bug, bg: "bg-white/5", border: "border-white/10" },
    { label: "Critical", value: "2", sub: "Immediate action", color: "text-red-400", icon: AlertTriangle, bg: "bg-red-500/8", border: "border-red-500/20" },
    { label: "High", value: "8", sub: "Review today", color: "text-orange-400", icon: Shield, bg: "bg-orange-500/8", border: "border-orange-500/20" },
    { label: "Scan Coverage", value: "94%", sub: "47 endpoints", color: "text-emerald-400", icon: CheckCircle2, bg: "bg-emerald-500/8", border: "border-emerald-500/20" },
  ];

  const scans = [
    { target: "api.acme.io", status: "COMPLETE", severity: "CRITICAL", time: "2m ago", findings: 3 },
    { target: "auth.acme.io", status: "RUNNING", severity: null, time: "now", findings: null },
    { target: "cdn.acme.io", status: "COMPLETE", severity: "MEDIUM", time: "1h ago", findings: 1 },
  ];

  const bars = [40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 78, 88];

  return (
    <div className="h-full flex flex-col gap-3 p-3 overflow-hidden">
      {/* Row 1: metric cards */}
      <div className="grid grid-cols-4 gap-2 shrink-0">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 10 }}
            animate={i < count ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: 0.3 }}
            className={`rounded-lg border p-2.5 ${m.bg} ${m.border}`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-medium">{m.label}</span>
              <m.icon className={`w-3 h-3 ${m.color}`} />
            </div>
            <div className={`text-xl font-bold ${m.color} leading-none`}>{m.value}</div>
            <div className="text-[9px] text-zinc-600 mt-0.5">{m.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Row 2: chart + scans */}
      <div className="flex-1 grid grid-cols-5 gap-2 min-h-0">
        {/* Chart */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={count >= 3 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="col-span-2 rounded-lg border border-white/8 p-3 flex flex-col gap-2"
          style={{ background: "oklch(10% 0 0)" }}
        >
          <div className="text-[10px] text-zinc-400 font-medium">Findings Over Time</div>
          <div className="flex-1 flex items-end gap-1">
            {bars.map((h, i) => (
              <motion.div
                key={i}
                className="flex-1 rounded-sm"
                initial={{ scaleY: 0 }}
                animate={count >= 3 ? { scaleY: h / 100 } : { scaleY: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3, ease: "easeOut" }}
                style={{ height: `${h}%`, background: i >= 9 ? "hsl(348,83%,50%)" : "oklch(20% 0 0)", transformOrigin: "bottom" }}
              />
            ))}
          </div>
        </motion.div>

        {/* Recent Scans table */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={count >= 2 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="col-span-3 rounded-lg border border-white/8 flex flex-col"
          style={{ background: "oklch(10% 0 0)" }}
        >
          <div className="px-3 py-2 border-b border-white/6 text-[10px] text-zinc-400 font-medium shrink-0">
            Recent Scans
          </div>
          <div className="flex-1 overflow-hidden">
            {scans.map((s, i) => (
              <motion.div
                key={s.target}
                initial={{ opacity: 0, x: -8 }}
                animate={count >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
                transition={{ delay: i * 0.1, duration: 0.25 }}
                className={`flex items-center gap-2.5 px-3 py-2 border-b border-white/4 last:border-0 ${i === 0 ? "bg-primary/4" : ""}`}
              >
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.status === "RUNNING" ? "#34d399" : s.severity === "CRITICAL" ? "hsl(348,83%,50%)" : "#f59e0b" }} />
                <span className="text-[11px] text-white font-mono flex-1 truncate">{s.target}</span>
                {s.status === "RUNNING" ? (
                  <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wide flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                  </span>
                ) : (
                  <Pill color={s.severity === "CRITICAL" ? "border-red-500/30 text-red-400 bg-red-500/8" : "border-amber-500/30 text-amber-400 bg-amber-500/8"}>
                    {s.severity}
                  </Pill>
                )}
                <span className="text-[9px] text-zinc-600 shrink-0">{s.time}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Row 3: AI Security Assistant promo strip */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={count >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
        transition={{ duration: 0.3 }}
        className="shrink-0 rounded-lg border border-violet-500/20 p-2.5 flex items-center gap-3"
        style={{ background: "oklch(8% 0.01 290 / 0.6)" }}
      >
        <div className="w-6 h-6 rounded-md bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
          <Cpu className="w-3 h-3 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-violet-300 font-semibold">AI Security Assistant</div>
          <div className="text-[9px] text-zinc-500 truncate">Ask about your vulnerabilities, get remediation advice...</div>
        </div>
        <ChevronRight className="w-3 h-3 text-violet-400 shrink-0" />
      </motion.div>
    </div>
  );
}

/* ── Scene 2: Live Scan ── */
function ScanScene({ visible }: { visible: boolean }) {
  const [logIdx, setLogIdx] = useState(0);
  const [findingsIdx, setFindingsIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  const logs = [
    { text: "$ redforge scan --target api.acme.io --deep", color: "text-zinc-300" },
    { text: "  Initializing AI penetration engine v2.0...", color: "text-zinc-500" },
    { text: "  Discovered 47 endpoints across 3 services", color: "text-zinc-500" },
    { text: "  [Phase 1/11] Authentication bypass testing...", color: "text-blue-400" },
    { text: "  Probing JWT algorithm confusion vectors", color: "text-zinc-500" },
    { text: "✗  CRITICAL: SQL Injection — /api/users?id=", color: "text-red-400" },
    { text: "  [Phase 3/11] IDOR & access control...", color: "text-blue-400" },
    { text: "✗  HIGH: JWT algorithm confusion attack", color: "text-orange-400" },
    { text: "  [Phase 6/11] XSS & injection testing...", color: "text-blue-400" },
    { text: "✗  HIGH: Reflected XSS — /search?q=", color: "text-orange-400" },
    { text: "  Generating AI patch recommendations...", color: "text-violet-400" },
    { text: "✓  Scan complete — 8 findings in 23.4s", color: "text-emerald-400" },
  ];

  const findings = [
    { title: "SQL Injection", path: "/api/users?id=", severity: "CRITICAL", cvss: "9.1" },
    { title: "JWT Algorithm Confusion", path: "/api/auth/token", severity: "HIGH", cvss: "7.5" },
    { title: "Reflected XSS", path: "/search?q=", severity: "HIGH", cvss: "6.8" },
  ];

  useEffect(() => {
    if (!visible) { setLogIdx(0); setFindingsIdx(0); setProgress(0); return; }
    const logTimer = setInterval(() => setLogIdx(i => Math.min(i + 1, logs.length)), 400);
    const findTimer = setInterval(() => setFindingsIdx(i => Math.min(i + 1, findings.length)), 1400);
    const progTimer = setInterval(() => setProgress(p => Math.min(p + 2, 100)), 140);
    return () => { clearInterval(logTimer); clearInterval(findTimer); clearInterval(progTimer); };
  }, [visible]);

  const isComplete = progress >= 100;

  return (
    <div className="h-full flex gap-3 p-3 overflow-hidden">
      {/* Left: terminal log */}
      <div className="flex-1 flex flex-col min-w-0 rounded-lg border border-white/8 overflow-hidden" style={{ background: "oklch(9% 0 0)" }}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/6 shrink-0" style={{ background: "oklch(11% 0 0)" }}>
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#ff5f57]" />
            <div className="w-2 h-2 rounded-full bg-[#ffbd2e]" />
            <div className="w-2 h-2 rounded-full bg-[#28c840]" />
          </div>
          <span className="text-[10px] text-zinc-500 font-mono ml-1">redforge — scan</span>
          <div className="ml-auto flex items-center gap-1.5">
            {!isComplete ? (
              <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9px] text-emerald-400">Running</span></>
            ) : (
              <><span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span className="text-[9px] text-blue-400">Complete</span></>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 shrink-0" style={{ background: "oklch(14% 0 0)" }}>
          <motion.div
            className="h-full"
            style={{ background: "hsl(348,83%,50%)", width: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>

        <div className="flex-1 p-3 space-y-1 overflow-hidden font-mono text-[10px]">
          {logs.slice(0, logIdx).map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.12 }}
              className={`leading-relaxed ${line.color}`}
            >
              {line.text}
            </motion.div>
          ))}
          {logIdx < logs.length && logIdx > 0 && (
            <span className="inline-block w-1 h-3 bg-zinc-500 animate-pulse" />
          )}
        </div>
      </div>

      {/* Right: findings */}
      <div className="w-44 flex flex-col gap-2 overflow-hidden">
        <div className="text-[10px] text-zinc-400 font-medium px-0.5 shrink-0">Findings ({findingsIdx})</div>
        <div className="flex-1 space-y-2 overflow-hidden">
          {findings.slice(0, findingsIdx).map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, scale: 0.95, x: 16 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className="rounded-lg border p-2.5"
              style={{ background: "oklch(9% 0 0)", borderColor: f.severity === "CRITICAL" ? "rgb(239 68 68 / 0.25)" : "rgb(249 115 22 / 0.25)" }}
            >
              <div className="flex items-start justify-between gap-1 mb-1.5">
                <span className="text-[10px] text-white font-semibold leading-tight">{f.title}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${f.severity === "CRITICAL" ? "text-red-400 border-red-500/30 bg-red-500/10" : "text-orange-400 border-orange-500/30 bg-orange-500/10"}`}>
                  {f.severity}
                </span>
              </div>
              <div className="text-[9px] text-zinc-500 font-mono truncate">{f.path}</div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[9px] text-zinc-600">CVSS</span>
                <span className={`text-[10px] font-bold ${f.severity === "CRITICAL" ? "text-red-400" : "text-orange-400"}`}>{f.cvss}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Scene 3: Attack Graph ── */
function AttackGraphScene({ visible }: { visible: boolean }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!visible) { setStep(0); return; }
    const t = setInterval(() => setStep(s => Math.min(s + 1, 6)), 600);
    return () => clearInterval(t);
  }, [visible]);

  const nodes = [
    { id: "n1", x: 40,  y: 45,  label: "Recon",          icon: Eye,          color: "#60a5fa", bg: "rgba(96,165,250,0.1)",  border: "rgba(96,165,250,0.3)"  },
    { id: "n2", x: 160, y: 20,  label: "SSL Strip",      icon: Lock,          color: "#f97316", bg: "rgba(249,115,22,0.1)",  border: "rgba(249,115,22,0.3)"  },
    { id: "n3", x: 160, y: 75,  label: "XSS Payload",   icon: Bug,           color: "#f97316", bg: "rgba(249,115,22,0.1)",  border: "rgba(249,115,22,0.3)"  },
    { id: "n4", x: 270, y: 20,  label: "Clickjacking",  icon: Activity,      color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.3)"   },
    { id: "n5", x: 270, y: 75,  label: "Session Hijack",icon: Zap,           color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.3)"   },
    { id: "n6", x: 380, y: 47,  label: "Credential Harvest", icon: Shield,  color: "#dc2626", bg: "rgba(220,38,38,0.12)",  border: "rgba(220,38,38,0.4)"   },
  ];

  const edges = [
    { from: { x: 88, y: 55 }, to: { x: 152, y: 30 }, step: 1 },
    { from: { x: 88, y: 65 }, to: { x: 152, y: 85 }, step: 2 },
    { from: { x: 214, y: 30 }, to: { x: 262, y: 30 }, step: 3 },
    { from: { x: 214, y: 85 }, to: { x: 262, y: 85 }, step: 4 },
    { from: { x: 322, y: 30 }, to: { x: 372, y: 57 }, step: 5 },
    { from: { x: 322, y: 75 }, to: { x: 372, y: 60 }, step: 5 },
  ];

  const chains = [
    { name: "SSL Strip → Credential Harvest", risk: 8.1, severity: "HIGH", steps: 4, mitre: "T1192" },
    { name: "XSS → Session Takeover", risk: 5.9, severity: "MEDIUM", steps: 3, mitre: "T1539" },
  ];

  return (
    <div className="h-full flex gap-2 p-3 overflow-hidden">
      {/* Left: chain list */}
      <div className="w-40 flex flex-col gap-2 shrink-0">
        <div className="text-[10px] text-zinc-400 font-medium px-0.5">Attack Chains (2)</div>
        {chains.map((chain, i) => (
          <motion.div
            key={chain.name}
            initial={{ opacity: 0, x: -10 }}
            animate={step >= i + 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
            transition={{ duration: 0.3 }}
            className={`rounded-lg border p-2.5 cursor-pointer ${i === 0 ? "border-orange-500/40" : "border-white/10"}`}
            style={{ background: i === 0 ? "rgba(249,115,22,0.06)" : "oklch(10% 0 0)" }}
          >
            <div className={`text-[10px] font-semibold leading-tight mb-1.5 ${i === 0 ? "text-orange-300" : "text-zinc-300"}`}>
              {chain.name}
            </div>
            <div className="flex items-center justify-between">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${i === 0 ? "text-orange-400 border-orange-500/30 bg-orange-500/10" : "text-yellow-400 border-yellow-500/30 bg-yellow-500/10"}`}>
                {chain.severity}
              </span>
              <span className={`text-[10px] font-bold ${i === 0 ? "text-orange-300" : "text-yellow-300"}`}>{chain.risk}</span>
            </div>
            <div className="text-[9px] text-zinc-600 mt-1">MITRE {chain.mitre} · {chain.steps} steps</div>
          </motion.div>
        ))}
      </div>

      {/* Center: graph SVG */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={step >= 1 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="flex-1 rounded-lg border border-white/8 relative overflow-hidden"
        style={{ background: "oklch(8% 0 0)" }}
      >
        {/* Grid background */}
        <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.06 }}>
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 460 130" preserveAspectRatio="xMidYMid meet">
          {/* Edges */}
          {edges.map((e, i) => (
            <motion.line
              key={i}
              x1={e.from.x} y1={e.from.y} x2={e.to.x} y2={e.to.y}
              stroke="rgba(249,115,22,0.35)"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={step >= e.step ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
              transition={{ duration: 0.4 }}
            />
          ))}

          {/* Nodes */}
          {nodes.map((n, i) => (
            <g key={n.id}>
              <motion.rect
                x={n.x} y={n.y - 14} width={60} height={28}
                rx={5}
                fill={n.bg}
                stroke={n.border}
                strokeWidth="1"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={step >= i + 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
                transition={{ type: "spring", stiffness: 300, damping: 20, delay: i * 0.05 }}
                style={{ transformOrigin: `${n.x + 30}px ${n.y}px` }}
              />
              <motion.text
                x={n.x + 30} y={n.y + 4}
                textAnchor="middle"
                fontSize="7.5"
                fill={n.color}
                fontFamily="monospace"
                fontWeight="600"
                initial={{ opacity: 0 }}
                animate={step >= i + 1 ? { opacity: 1 } : { opacity: 0 }}
                transition={{ delay: i * 0.05 + 0.1 }}
              >
                {n.label}
              </motion.text>
            </g>
          ))}
        </svg>

        {/* Overlay badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={step >= 5 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.3 }}
          className="absolute top-2 right-2 px-2 py-1 rounded border border-primary/30 text-[9px] text-primary font-bold uppercase tracking-wider"
          style={{ background: "rgba(220,38,38,0.1)" }}
        >
          NIM-Generated ✓
        </motion.div>
      </motion.div>

      {/* Right: selected node detail */}
      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={step >= 4 ? { opacity: 1, x: 0 } : { opacity: 0, x: 16 }}
        transition={{ duration: 0.4 }}
        className="w-36 rounded-lg border border-white/8 flex flex-col overflow-hidden shrink-0"
        style={{ background: "oklch(9% 0 0)" }}
      >
        <div className="px-2.5 py-2 border-b border-white/6">
          <div className="text-[9px] text-zinc-500 uppercase tracking-wider mb-0.5">Selected Node</div>
          <div className="text-[11px] text-orange-400 font-bold">SSL Strip</div>
        </div>
        <div className="p-2.5 space-y-2 flex-1">
          {[
            { label: "MITRE", value: "T1192" },
            { label: "CVSS", value: "8.1" },
            { label: "Chain", value: "Chain #1" },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-[9px] text-zinc-600">{item.label}</span>
              <span className="text-[9px] text-zinc-300 font-mono font-semibold">{item.value}</span>
            </div>
          ))}
          <div className="pt-1 border-t border-white/6">
            <div className="text-[9px] text-zinc-500 mb-1">Payload</div>
            <div className="font-mono text-[8px] text-emerald-400 bg-black/30 rounded px-1.5 py-1 leading-relaxed break-all">
              HSTS stripped via proxy intercept
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ═══ Main DemoShowcase component ═══ */
export default function DemoShowcase() {
  const [activeScene, setActiveScene] = useState<number>(0);
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

  const tick = useCallback(() => {
    elapsedRef.current += 50;
    setElapsed(elapsedRef.current);
    if (elapsedRef.current >= SCENE_DURATION) {
      elapsedRef.current = 0;
      setElapsed(0);
      setActiveScene(s => (s + 1) % SCENES.length);
    }
  }, []);

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(tick, 50);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, tick]);

  const switchScene = (idx: number) => {
    setActiveScene(idx);
    elapsedRef.current = 0;
    setElapsed(0);
  };

  const skipNext = () => {
    switchScene((activeScene + 1) % SCENES.length);
  };

  const progressPct = (elapsed / SCENE_DURATION) * 100;

  const sceneIcons = [BarChart3, Terminal, Network];

  return (
    <section className="relative z-10 py-24 px-4 overflow-hidden" style={{ background: "oklch(6% 0 0)" }}>
      {/* Subtle radial glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full"
          style={{ background: "radial-gradient(ellipse, hsl(348,83%,50%) 0%, transparent 70%)", opacity: 0.04 }} />
      </div>

      <div className="max-w-6xl mx-auto relative">
        {/* Section header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/8 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-widest mb-4"
          >
            <Play className="w-3 h-3 fill-current" />
            Live Platform Demo
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold text-white tracking-[-0.02em] mb-4"
          >
            See RedForge in action
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-muted-foreground text-lg max-w-xl mx-auto"
          >
            From first scan to full attack chain analysis — watch how RedForge works in real time.
          </motion.p>
        </div>

        {/* Browser chrome + demo area */}
        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl border border-white/10 overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.6)]"
          style={{ background: "oklch(7.5% 0 0)" }}
        >
          {/* Browser chrome bar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8" style={{ background: "oklch(10% 0 0)" }}>
            <div className="flex gap-2 shrink-0">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
            </div>

            {/* Fake URL bar */}
            <div className="flex-1 max-w-md mx-auto">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono border border-white/8" style={{ background: "oklch(8% 0 0)" }}>
                <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="text-zinc-400">app.redforge.io</span>
                <span className="text-zinc-600">/</span>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={activeScene}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="text-zinc-300"
                  >
                    {activeScene === 0 ? "dashboard" : activeScene === 1 ? "scans/a468e5ee" : "scans/a468e5ee/attack-graph"}
                  </motion.span>
                </AnimatePresence>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setPlaying(p => !p)}
                className="w-7 h-7 rounded-md border border-white/12 flex items-center justify-center hover:bg-white/8 transition-colors"
                style={{ background: "oklch(12% 0 0)" }}
              >
                {playing
                  ? <Pause className="w-3 h-3 text-zinc-400" />
                  : <Play className="w-3 h-3 text-zinc-400" />
                }
              </button>
              <button
                onClick={skipNext}
                className="w-7 h-7 rounded-md border border-white/12 flex items-center justify-center hover:bg-white/8 transition-colors"
                style={{ background: "oklch(12% 0 0)" }}
              >
                <SkipForward className="w-3 h-3 text-zinc-400" />
              </button>
            </div>
          </div>

          {/* Fake app sidebar + content */}
          <div className="flex" style={{ height: "340px" }}>
            {/* Sidebar */}
            <div className="w-14 shrink-0 border-r border-white/6 flex flex-col items-center py-3 gap-2" style={{ background: "oklch(8% 0 0)" }}>
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-2">
                <Terminal className="w-4 h-4 text-primary" />
              </div>
              {[
                { icon: BarChart3, scene: 0 },
                { icon: Shield, scene: 1 },
                { icon: Network, scene: 2 },
                { icon: Bug, scene: null },
                { icon: Activity, scene: null },
              ].map(({ icon: Icon, scene }, i) => (
                <button
                  key={i}
                  onClick={() => scene !== null && switchScene(scene)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${activeScene === scene ? "bg-primary/15 border border-primary/25" : "hover:bg-white/5"}`}
                >
                  <Icon className={`w-4 h-4 ${activeScene === scene ? "text-primary" : "text-zinc-600"}`} />
                </button>
              ))}
            </div>

            {/* Scene content */}
            <div className="flex-1 relative overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeScene}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0"
                >
                  {activeScene === 0 && <DashboardScene visible={true} />}
                  {activeScene === 1 && <ScanScene visible={true} />}
                  {activeScene === 2 && <AttackGraphScene visible={true} />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Bottom: scene tabs + progress */}
          <div className="border-t border-white/8 px-4 py-3" style={{ background: "oklch(9% 0 0)" }}>
            {/* Progress bar */}
            <div className="w-full h-0.5 rounded-full mb-3" style={{ background: "oklch(15% 0 0)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: "hsl(348,83%,50%)", width: `${progressPct}%` }}
                transition={{ duration: 0.05 }}
              />
            </div>

            {/* Scene selector tabs */}
            <div className="flex items-center gap-2">
              {SCENES.map((scene, i) => {
                const Icon = sceneIcons[i];
                return (
                  <button
                    key={scene}
                    onClick={() => switchScene(i)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                      activeScene === i
                        ? "bg-primary/12 border border-primary/25 text-primary"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {scene}
                  </button>
                );
              })}

              <div className="ml-auto flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-zinc-500">Live demo</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Below browser: feature highlights */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {[
            { icon: BarChart3, title: "Real-time Dashboard", desc: "Live metrics, scan status, and severity breakdown at a glance.", color: "text-blue-400", bg: "bg-blue-500/8", border: "border-blue-500/15" },
            { icon: Terminal, title: "AI-Driven Scanning", desc: "11-phase scan engine finds critical CVEs in under 30 seconds.", color: "text-primary", bg: "bg-primary/8", border: "border-primary/15" },
            { icon: Network, title: "Attack Path Chaining", desc: "NIM-powered AI chains exploits into full kill-chain scenarios.", color: "text-violet-400", bg: "bg-violet-500/8", border: "border-violet-500/15" },
          ].map(item => (
            <div key={item.title} className={`flex items-start gap-3 p-4 rounded-xl border ${item.bg} ${item.border}`}>
              <div className={`w-8 h-8 rounded-lg ${item.bg} border ${item.border} flex items-center justify-center shrink-0`}>
                <item.icon className={`w-4 h-4 ${item.color}`} />
              </div>
              <div>
                <div className={`text-sm font-semibold mb-1 ${item.color}`}>{item.title}</div>
                <div className="text-xs text-zinc-500 leading-relaxed">{item.desc}</div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
