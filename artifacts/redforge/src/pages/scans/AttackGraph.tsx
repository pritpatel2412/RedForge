import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useParams } from "wouter";
import {
  ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState,
  MarkerType, BackgroundVariant, type Node, type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowLeft, Zap, Target, AlertTriangle, ChevronRight,
  RefreshCw, Loader2, CheckCircle2, XCircle, GitMerge,
  Crosshair, Lock, Database, Server, Code2, Shield,
  Info, ChevronDown, ChevronUp, RotateCcw, Cpu,
  Activity, ExternalLink, Download, FileJson, FileText,
} from "lucide-react";
import { useGetScan } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}${path}`, { credentials: "include", ...opts });

// ─── Types ────────────────────────────────────────────────────────────────────
interface GNode { id: string; type: "attacker"|"vulnerability"|"target"; label: string; description?: string; endpoint?: string; severity?: string; findingId?: string; technique?: string; }
interface GEdge { id: string; source: string; target: string; label: string; chainId?: string; }
interface Step  { stepNumber: number; title: string; findingId?: string|null; endpoint?: string; technique?: string; action: string; payload?: string; poc?: string; impact: string; }
interface Chain { id: string; title: string; risk: string; riskScore: number; mitreIds?: string[]; description: string; steps: Step[]; }
interface Graph  { summary: string; chainedRiskLevel: string; chainedRiskScore: number; attackSurface?: string; chains: Chain[]; nodes: GNode[]; edges: GEdge[]; }
interface GraphRecord { id?: string; status: string; chainedRiskLevel?: string; chainedRiskScore?: number; graph?: Graph; errorMessage?: string; }

// ─── Constants ────────────────────────────────────────────────────────────────
const RISK_C: Record<string,string> = { CRITICAL:"#ef4444", HIGH:"#f97316", MEDIUM:"#eab308", LOW:"#22c55e" };
const RISK_BG: Record<string,string> = { CRITICAL:"rgba(239,68,68,.15)", HIGH:"rgba(249,115,22,.15)", MEDIUM:"rgba(234,179,8,.15)", LOW:"rgba(34,197,94,.15)" };
const RISK_BD: Record<string,string> = { CRITICAL:"rgba(239,68,68,.4)", HIGH:"rgba(249,115,22,.4)", MEDIUM:"rgba(234,179,8,.4)", LOW:"rgba(34,197,94,.4)" };

function RiskBadge({ level }: { level: string }) {
  const c = RISK_C[level] || "#94a3b8";
  return <span style={{ color:c, background:RISK_BG[level]||"rgba(148,163,184,.1)", border:`1px solid ${RISK_BD[level]||"rgba(148,163,184,.3)"}` }} className="text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap">{level}</span>;
}

// ─── Custom Nodes ─────────────────────────────────────────────────────────────
function AttackerNode({ data }: { data: any }) {
  return (
    <div style={{ background:"rgba(239,68,68,.08)", border:"2px solid rgba(239,68,68,.45)" }} className="rounded-2xl px-5 py-4 min-w-[160px] text-center shadow-2xl shadow-red-900/30 cursor-pointer hover:shadow-red-500/20 transition-shadow">
      <div className="flex items-center justify-center mb-2">
        <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
          <Crosshair className="w-5 h-5 text-red-400" />
        </div>
      </div>
      <div className="font-bold text-red-300 text-sm">{data.label}</div>
      <div className="text-red-500/60 text-[11px] mt-0.5">{data.description || "External threat actor"}</div>
    </div>
  );
}

function VulnNode({ data }: { data: any }) {
  const sev = data.severity || "MEDIUM";
  const c   = RISK_C[sev]  || "#94a3b8";
  const bg  = RISK_BG[sev] || "rgba(148,163,184,.1)";
  const bd  = RISK_BD[sev] || "rgba(148,163,184,.3)";
  const Icon = sev === "CRITICAL" || sev === "HIGH" ? AlertTriangle : Shield;
  return (
    <div style={{ background:bg, border:`2px solid ${bd}` }} className="rounded-2xl px-4 py-3 min-w-[190px] shadow-xl cursor-pointer hover:scale-[1.02] transition-transform">
      <div className="flex items-center gap-2 mb-2">
        <div style={{ background:`${c}20`, border:`1px solid ${c}40` }} className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0">
          <Icon style={{ color:c }} className="w-3.5 h-3.5" />
        </div>
        <RiskBadge level={sev} />
      </div>
      <div className="text-white font-semibold text-sm leading-tight">{data.label}</div>
      {data.endpoint && <div className="text-zinc-500 text-[11px] mt-1 font-mono truncate max-w-[170px]">{data.endpoint}</div>}
      {data.technique && <div style={{ color:c }} className="text-[10px] mt-1 font-mono opacity-70">{data.technique}</div>}
    </div>
  );
}

function TargetNode({ data }: { data: any }) {
  const lbl = (data.label || "").toLowerCase();
  const Icon = lbl.includes("db") || lbl.includes("data") ? Database
    : lbl.includes("admin") ? Lock
    : lbl.includes("shell") || lbl.includes("rce") ? Code2
    : lbl.includes("server") ? Server : Target;
  return (
    <div style={{ background:"rgba(139,92,246,.1)", border:"2px solid rgba(139,92,246,.4)" }} className="rounded-2xl px-5 py-4 min-w-[160px] text-center shadow-xl shadow-violet-900/30 cursor-pointer hover:shadow-violet-500/20 transition-shadow">
      <div className="flex items-center justify-center mb-2">
        <div className="w-10 h-10 rounded-full bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
          <Icon className="w-5 h-5 text-violet-400" />
        </div>
      </div>
      <div className="font-bold text-violet-300 text-sm">{data.label}</div>
      {data.description && <div className="text-violet-500/60 text-[11px] mt-0.5">{data.description}</div>}
    </div>
  );
}

const nodeTypes = { attacker: AttackerNode, vulnerability: VulnNode, target: TargetNode };

// ─── Layout ───────────────────────────────────────────────────────────────────
function buildLayout(gnodes: GNode[], gedges: GEdge[]): { nodes: any[]; edges: any[] } {
  const layer: Record<string,number> = {};
  gnodes.forEach(n => {
    if (n.type === "attacker") layer[n.id] = 0;
    else if (n.type === "target") layer[n.id] = 3;
    else layer[n.id] = 1;
  });
  const directFromAttacker = new Set(gedges.filter(e => e.source === "attacker").map(e => e.target));
  gnodes.forEach(n => { if (n.type === "vulnerability" && !directFromAttacker.has(n.id)) layer[n.id] = 2; });

  const byLayer: Record<number, GNode[]> = {};
  gnodes.forEach(n => { const l = layer[n.id]??1; (byLayer[l] ??= []).push(n); });

  const XS = 360, YS = 170;
  const rfNodes: any[] = [];
  Object.entries(byLayer).forEach(([l, ns]) => {
    const x = parseInt(l) * XS + 80;
    ns.forEach((n, i) => {
      const y = -(ns.length-1)*YS/2 + i*YS + 320;
      rfNodes.push({ id: n.id, type: n.type, position: { x, y }, data: { ...n } });
    });
  });

  const severityRank: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  const nodeById = new Map(gnodes.map((n) => [n.id, n]));

  const rfEdges: any[] = gedges.map((e) => {
    const sourceNode = nodeById.get(e.source);
    const targetNode = nodeById.get(e.target);
    const isFromAttacker = e.source === "attacker";
    const isToTarget = targetNode?.type === "target";
    const srcSev = sourceNode?.severity || "LOW";
    const tgtSev = targetNode?.severity || "LOW";
    const edgeSev = (severityRank[srcSev] || 0) >= (severityRank[tgtSev] || 0) ? srcSev : tgtSev;

    // Critical path (attacker → vuln → target) = bright neon red.
    const isCriticalPath = isFromAttacker || isToTarget;
    const edgePalette: Record<string, { color: string; glow: string; className: string }> = {
      CRITICAL: { color: "#ff3b3b", glow: "rgba(255,59,59,0.75)", className: "rf-edge-critical" },
      HIGH: { color: "#ff6a3d", glow: "rgba(255,106,61,0.65)", className: "rf-edge-high" },
      MEDIUM: { color: "#f5c242", glow: "rgba(245,194,66,0.55)", className: "rf-edge-medium" },
      LOW: { color: "#4ade80", glow: "rgba(74,222,128,0.45)", className: "rf-edge-low" },
    };
    const palette = edgePalette[edgeSev] || edgePalette.LOW;
    const edgeColor = isCriticalPath ? edgePalette.CRITICAL.color : palette.color;
    const glowColor = isCriticalPath ? edgePalette.CRITICAL.glow : palette.glow;
    const edgeClass = isCriticalPath ? edgePalette.CRITICAL.className : palette.className;
    const strokeWidth = isCriticalPath ? 2.8 : 2.2;

    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      type: "bezier",
      className: edgeClass,
      animated: true,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edgeColor,
        width: 18,
        height: 18,
      },
      style: {
        stroke: edgeColor,
        strokeWidth,
        strokeLinecap: "round",
        filter: `drop-shadow(0 0 5px ${glowColor}) drop-shadow(0 0 11px ${glowColor})`,
        strokeDasharray: isCriticalPath ? "10 7" : "8 9",
      },
      labelStyle: { fill: "#fecaca", fontSize: 10, fontWeight: 700 },
      labelBgStyle: { fill: "#0d0208", fillOpacity: 0.92 },
      labelBgPadding: [8, 4] as [number, number],
      labelBgBorderRadius: 6,
    };
  });
  return { nodes: rfNodes, edges: rfEdges };
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AttackGraph() {
  const { id: scanId } = useParams<{ id: string }>();
  const { data: scan } = useGetScan(scanId);

  const [record, setRecord]         = useState<GraphRecord|null>(null);
  const [loading, setLoading]       = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedChain, setSelectedChain] = useState<Chain|null>(null);
  const [selectedNode, setSelectedNode]   = useState<GNode|null>(null);
  const [expanded, setExpanded]           = useState<Set<string>>(new Set());
  const [streamLog, setStreamLog]         = useState<string[]>([]);
  const [nimOutput, setNimOutput]         = useState("");
  const [showDlMenu, setShowDlMenu]       = useState(false);
  const [cyberMode, setCyberMode]         = useState(true);
  const logRef    = useRef<HTMLDivElement>(null);
  const evtSource = useRef<EventSource|null>(null);
  const dlMenuRef = useRef<HTMLDivElement>(null);

  const [nodes, setNodes, onNodesChange] = (useNodesState as any)([]);
  const [edges, setEdges, onEdgesChange] = (useEdgesState as any)([]);

  // ── Materialise graph from record ────────────────────────────────────────
  const applyGraph = useCallback((r: GraphRecord) => {
    setRecord(r);
    if (r.status === "COMPLETE" && r.graph) {
      const { nodes: ns, edges: es } = buildLayout(r.graph.nodes, r.graph.edges);
      setNodes(ns); setEdges(es);
      if (r.graph.chains?.length && !selectedChain) setSelectedChain(r.graph.chains[0]);
    }
  }, [selectedChain]);

  // ── Fetch current state ──────────────────────────────────────────────────
  const fetchRecord = useCallback(async () => {
    if (!scanId) return;
    try {
      const r = await api(`/api/attack-graph/${scanId}`);
      if (!r.ok) return;
      const data: GraphRecord = await r.json();
      applyGraph(data);
    } finally { setLoading(false); }
  }, [scanId, applyGraph]);

  useEffect(() => { fetchRecord(); }, [fetchRecord]);

  // ── SSE stream ───────────────────────────────────────────────────────────
  const startStream = useCallback(() => {
    if (!scanId) return;
    evtSource.current?.close();
    setStreamLog([]);
    setNimOutput("");

    const es = new EventSource(`${BASE}/api/attack-graph/${scanId}/stream`, { withCredentials: true });
    evtSource.current = es;

    es.addEventListener("step", (e) => {
      const d = JSON.parse(e.data);
      setStreamLog(prev => [...prev, d.message]);
      setTimeout(() => logRef.current?.scrollTo({ top: 9999, behavior: "smooth" }), 50);
    });

    es.addEventListener("token", (e) => {
      const d = JSON.parse(e.data);
      setNimOutput(prev => prev + d.token);
    });

    es.addEventListener("done", (e) => {
      const d = JSON.parse(e.data);
      setStreamLog(prev => [...prev, "Attack graph complete!"]);
      applyGraph({ status: "COMPLETE", graph: d.graph, chainedRiskLevel: d.chainedRiskLevel, chainedRiskScore: d.chainedRiskScore });
      setGenerating(false);
      setNimOutput("");
      es.close();
    });

    es.addEventListener("fail", (e) => {
      const d = JSON.parse(e.data);
      setRecord({ status: "FAILED", errorMessage: d.error });
      setGenerating(false);
      setStreamLog(prev => [...prev, `Error: ${d.error}`]);
      es.close();
    });

    es.onerror = () => {
      // SSE connection dropped — fall back to polling
      es.close();
      const poll = setInterval(async () => {
        const r = await api(`/api/attack-graph/${scanId}`);
        const data: GraphRecord = await r.json();
        if (data.status !== "GENERATING") {
          clearInterval(poll);
          applyGraph(data);
          setGenerating(false);
        }
      }, 3000);
      setTimeout(() => clearInterval(poll), 120_000);
    };
  }, [scanId, applyGraph]);

  // ── Generate ─────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!scanId) return;
    setGenerating(true);
    setRecord({ status: "GENERATING" });
    const r = await api(`/api/attack-graph/${scanId}/generate`, { method: "POST" });
    if (r.ok) {
      startStream();
    } else {
      const err = await r.json();
      setRecord({ status: "FAILED", errorMessage: err.error || "Unknown error" });
      setGenerating(false);
    }
  };

  // ── Reset ────────────────────────────────────────────────────────────────
  const handleReset = async () => {
    if (!scanId) return;
    await api(`/api/attack-graph/${scanId}/reset`, { method: "POST" });
    setRecord({ status: "NOT_GENERATED" });
    setNodes([]); setEdges([]);
    setSelectedChain(null); setSelectedNode(null);
    setStreamLog([]); setNimOutput("");
  };

  // Cleanup SSE on unmount
  useEffect(() => () => { evtSource.current?.close(); }, []);

  // ── Derived state (declared here so export callbacks can reference them) ──
  const g              = record?.graph;
  const isGenerating   = record?.status === "GENERATING" || generating;
  const isComplete     = record?.status === "COMPLETE";
  const isFailed       = record?.status === "FAILED";
  const notGenerated   = !record || record.status === "NOT_GENERATED";

  const toggleExpand = (id: string) =>
    setExpanded(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const onNodeClick = useCallback((_: any, node: Node) => {
    const gn = g?.nodes.find(n => n.id === node.id);
    if (gn) { setSelectedNode(gn); setSelectedChain(null); }
  }, [g]);

  // Close download menu on outside click
  useEffect(() => {
    if (!showDlMenu) return;
    const handler = (e: MouseEvent) => {
      if (dlMenuRef.current && !dlMenuRef.current.contains(e.target as HTMLElement)) setShowDlMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDlMenu]);

  // ── Export: JSON ─────────────────────────────────────────────────────────
  const exportJSON = useCallback(() => {
    if (!g) return;
    const blob = new Blob([JSON.stringify({ ...record, graph: g }, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url;
    a.download = `attack-graph-${scanId?.slice(0, 8)}-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
    setShowDlMenu(false);
  }, [g, record, scanId]);

  // ── Export: HTML Report ──────────────────────────────────────────────────
  const exportReport = useCallback(() => {
    if (!g) return;
    const riskColor: Record<string,string> = { CRITICAL:"#ef4444", HIGH:"#f97316", MEDIUM:"#eab308", LOW:"#22c55e" };
    const rc = (level: string) => riskColor[level] || "#94a3b8";

    const escHtml = (s: string = "") => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

    const chainsHtml = g.chains.map((chain, ci) => `
      <div class="chain">
        <div class="chain-header">
          <div>
            <span class="badge" style="background:${rc(chain.risk)}22;color:${rc(chain.risk)};border:1px solid ${rc(chain.risk)}44">${chain.risk}</span>
            <span class="chain-score" style="color:${rc(chain.risk)}">${chain.riskScore?.toFixed(1)}/10</span>
          </div>
          <h3>${escHtml(chain.title)}</h3>
          ${chain.mitreIds?.length ? `<div class="mitre-row">${chain.mitreIds.map(id=>`<a href="https://attack.mitre.org/techniques/${id}/" target="_blank" class="mitre-tag">${id}</a>`).join("")}</div>` : ""}
          <p class="chain-desc">${escHtml(chain.description)}</p>
        </div>
        <div class="steps">
          ${chain.steps.map(s => `
            <div class="step">
              <div class="step-num" style="background:${rc(chain.risk)}18;color:${rc(chain.risk)};border:1px solid ${rc(chain.risk)}35">${s.stepNumber}</div>
              <div class="step-body">
                <div class="step-title">${escHtml(s.title)}</div>
                ${s.technique ? `<div class="step-meta">${escHtml(s.technique)}</div>` : ""}
                ${s.endpoint ? `<div class="step-meta mono">${escHtml(s.endpoint)}</div>` : ""}
                <div class="step-action">${escHtml(s.action)}</div>
                ${s.payload ? `<div class="code-block"><div class="code-label">PAYLOAD</div><code>${escHtml(s.payload)}</code></div>` : ""}
                ${s.poc ? `<div class="code-block poc"><div class="code-label">PROOF OF CONCEPT</div><code>${escHtml(s.poc)}</code></div>` : ""}
                <div class="step-impact">▶ ${escHtml(s.impact)}</div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `).join("");

    const vulnNodes = g.nodes.filter(n => n.type === "vulnerability");
    const tableRows = vulnNodes.map(n => `
      <tr>
        <td>${escHtml(n.label)}</td>
        <td><span class="badge sm" style="background:${rc(n.severity||"")}22;color:${rc(n.severity||"")};border:1px solid ${rc(n.severity||"")}44">${n.severity||"—"}</span></td>
        <td class="mono">${escHtml(n.endpoint||"—")}</td>
        <td class="mono small">${escHtml(n.technique||"—")}</td>
      </tr>
    `).join("");

    const now = new Date().toLocaleString();
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Attack Path Analysis — RedForge</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#0f172a;line-height:1.6}
  a{color:inherit;text-decoration:none}
  /* Cover */
  .cover{background:linear-gradient(135deg,#0d0d1a 0%,#1a0e2e 60%,#0d1a2e 100%);color:#fff;padding:60px 56px 48px;min-height:280px;position:relative;overflow:hidden}
  .cover::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 70% 50%,rgba(139,92,246,.15) 0%,transparent 70%)}
  .cover-logo{display:flex;align-items:center;gap:10px;margin-bottom:40px}
  .logo-icon{width:36px;height:36px;background:#ef4444;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;color:#fff;flex-shrink:0}
  .logo-text{font-size:18px;font-weight:800;letter-spacing:-.02em}
  .cover-title{font-size:32px;font-weight:800;letter-spacing:-.02em;margin-bottom:8px}
  .cover-sub{color:rgba(255,255,255,.55);font-size:14px}
  .risk-card{display:inline-flex;align-items:center;gap:20px;margin-top:28px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:16px 24px}
  .risk-level{font-size:28px;font-weight:800}
  .risk-score{font-size:38px;font-weight:900;font-family:monospace;letter-spacing:-.02em}
  .risk-label{font-size:11px;text-transform:uppercase;letter-spacing:.1em;opacity:.5;margin-top:2px}
  .risk-divider{width:1px;height:40px;background:rgba(255,255,255,.1)}
  /* Page body */
  .page{max-width:900px;margin:0 auto;padding:40px 32px 80px}
  .section{margin-bottom:40px}
  h2{font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#475569;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin-bottom:20px}
  /* Summary */
  .summary-box{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;color:#334155;font-size:14px;line-height:1.7}
  /* Metadata */
  .meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
  .meta-card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px}
  .meta-label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:4px}
  .meta-value{font-size:16px;font-weight:700;color:#0f172a}
  /* Badge */
  .badge{display:inline-block;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;text-transform:uppercase;letter-spacing:.04em}
  .badge.sm{font-size:10px;padding:2px 7px}
  /* Chain */
  .chain{background:#fff;border:1px solid #e2e8f0;border-radius:14px;margin-bottom:24px;overflow:hidden}
  .chain-header{padding:20px 24px;border-bottom:1px solid #f1f5f9}
  .chain-header h3{font-size:17px;font-weight:700;margin:8px 0 6px;color:#0f172a}
  .chain-score{font-family:monospace;font-weight:700;font-size:14px;margin-left:8px}
  .chain-desc{color:#475569;font-size:13px;line-height:1.6;margin-top:6px}
  .mitre-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
  .mitre-tag{background:#f1f5f9;color:#475569;border-radius:6px;padding:2px 8px;font-size:11px;font-family:monospace;border:1px solid #e2e8f0}
  /* Steps */
  .steps{padding:0 24px 20px}
  .step{display:flex;gap:14px;padding:14px 0;border-bottom:1px solid #f1f5f9;position:relative}
  .step:last-child{border-bottom:none}
  .step-num{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;margin-top:2px}
  .step-body{flex:1;min-width:0}
  .step-title{font-weight:600;font-size:14px;color:#0f172a}
  .step-meta{font-size:11px;color:#94a3b8;font-family:monospace;margin-top:2px}
  .step-action{font-size:13px;color:#475569;margin-top:6px}
  .step-impact{font-size:12px;font-weight:600;margin-top:8px;color:#6d28d9}
  .code-block{background:#0f172a;border-radius:8px;padding:10px 14px;margin-top:8px;overflow-x:auto}
  .code-block.poc{background:#052e16}
  .code-label{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#475569;margin-bottom:4px}
  .code-block code{font-family:'JetBrains Mono','Fira Code',monospace;font-size:11px;color:#86efac;line-height:1.6;word-break:break-all;white-space:pre-wrap}
  .code-block.poc code{color:#4ade80}
  /* Table */
  .table-wrap{background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{background:#f8fafc;padding:10px 16px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;border-bottom:1px solid #e2e8f0;font-weight:600}
  td{padding:10px 16px;border-bottom:1px solid #f1f5f9;vertical-align:top}
  tr:last-child td{border-bottom:none}
  .mono{font-family:monospace;font-size:12px}
  .small{font-size:11px}
  /* Footer */
  .footer{margin-top:60px;padding-top:20px;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:12px}
  @media print{body{background:#fff}.cover{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
</head>
<body>

<div class="cover">
  <div class="cover-logo">
    <div class="logo-icon">&gt;_</div>
    <div class="logo-text">RedForge</div>
  </div>
  <div class="cover-title">Attack Path Analysis</div>
  <div class="cover-sub">AI-Driven Exploit Chain Simulation &nbsp;•&nbsp; Generated ${escHtml(now)}</div>
  <div class="risk-card">
    <div>
      <div class="risk-label">Chained Risk</div>
      <div class="risk-level" style="color:${rc(g.chainedRiskLevel)}">${escHtml(g.chainedRiskLevel)}</div>
    </div>
    <div class="risk-divider"></div>
    <div>
      <div class="risk-label">Risk Score</div>
      <div class="risk-score" style="color:${rc(g.chainedRiskLevel)}">${g.chainedRiskScore?.toFixed(1)}<span style="font-size:20px;opacity:.5">/10</span></div>
    </div>
    <div class="risk-divider"></div>
    <div>
      <div class="risk-label">Attack Chains</div>
      <div class="risk-score" style="color:#8b5cf6">${g.chains.length}</div>
    </div>
  </div>
</div>

<div class="page">

  <div class="section">
    <h2>Executive Summary</h2>
    <div class="summary-box">${escHtml(g.summary)}</div>
  </div>

  ${g.attackSurface ? `
  <div class="section">
    <h2>Attack Surface</h2>
    <div class="summary-box">${escHtml(g.attackSurface)}</div>
  </div>` : ""}

  <div class="section">
    <h2>At a Glance</h2>
    <div class="meta-grid">
      <div class="meta-card">
        <div class="meta-label">Attack Chains</div>
        <div class="meta-value">${g.chains.length}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Vulnerabilities Chained</div>
        <div class="meta-value">${vulnNodes.length}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Highest Chain Risk</div>
        <div class="meta-value" style="color:${rc(g.chainedRiskLevel)}">${g.chainedRiskScore?.toFixed(1)}/10</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Attack Chains &amp; Exploitation Steps</h2>
    ${chainsHtml}
  </div>

  ${vulnNodes.length ? `
  <div class="section">
    <h2>Vulnerability Summary</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Vulnerability</th><th>Severity</th><th>Endpoint</th><th>Technique</th></tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>
  </div>` : ""}

  <div class="footer">
    Generated by <strong>RedForge</strong> AI Penetration Testing Platform &nbsp;•&nbsp; ${escHtml(now)}<br>
    Powered by NVIDIA NIM (nvidia/llama-3.1-nemotron-70b-instruct) &nbsp;•&nbsp; For authorized security testing only
  </div>
</div>

</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url;
    a.download = `attack-report-${scanId?.slice(0,8)}-${new Date().toISOString().slice(0,10)}.html`;
    a.click(); URL.revokeObjectURL(url);
    setShowDlMenu(false);
  }, [g, scanId]);

  return (
    <div className="flex flex-col -mx-5 md:-mx-7 lg:-mx-8 -my-5 md:-my-7 lg:-my-8 animate-in fade-in duration-500" style={{ height:"calc(100vh - 56px)" }}>
      <style>{`
        @keyframes redforge-edge-flow {
          to { stroke-dashoffset: -34; }
        }
        @keyframes redforge-edge-pulse {
          0%, 100% { opacity: .78; }
          50% { opacity: 1; }
        }
        .attack-flow-canvas.cyber-on .react-flow__edge.rf-edge-critical .react-flow__edge-path {
          animation: redforge-edge-flow 1.1s linear infinite, redforge-edge-pulse 2.3s ease-in-out infinite;
        }
        .attack-flow-canvas.cyber-on .react-flow__edge.rf-edge-high .react-flow__edge-path {
          animation: redforge-edge-flow 1.5s linear infinite, redforge-edge-pulse 2.8s ease-in-out infinite;
          opacity: .9;
        }
        .attack-flow-canvas.cyber-on .react-flow__edge.rf-edge-medium .react-flow__edge-path {
          animation: redforge-edge-flow 1.9s linear infinite, redforge-edge-pulse 3.3s ease-in-out infinite;
          opacity: .86;
        }
        .attack-flow-canvas.cyber-on .react-flow__edge.rf-edge-low .react-flow__edge-path {
          animation: redforge-edge-flow 2.4s linear infinite, redforge-edge-pulse 3.8s ease-in-out infinite;
          opacity: .82;
        }
        .attack-flow-canvas.cyber-on .react-flow__edge-text {
          filter: drop-shadow(0 0 8px rgba(255, 59, 59, .25));
        }
        .attack-flow-canvas.cyber-off .react-flow__edge .react-flow__edge-path {
          animation: none !important;
          stroke-dasharray: none !important;
          filter: none !important;
          opacity: .9 !important;
        }
        .attack-flow-canvas.cyber-off .react-flow__edge-text {
          filter: none !important;
        }
      `}</style>

      {/* ── Top header bar ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0" style={{ background:"oklch(6% 0 0 / 0.9)", backdropFilter:"blur(12px)" }}>
        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/scans/${scanId}`} className="text-muted-foreground hover:text-white flex items-center gap-1.5 text-sm transition-colors flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-px h-4 bg-border flex-shrink-0" />
          <div className="flex items-center gap-2 min-w-0">
            <GitMerge className="w-4 h-4 text-violet-400 flex-shrink-0" />
            <span className="font-bold text-white text-sm">Attack Path Analysis</span>
            {scan && <span className="text-muted-foreground text-xs truncate hidden md:block">— {scan.projectName}</span>}
          </div>
          {isComplete && g && (
            <div className="flex items-center gap-2 ml-2">
              <RiskBadge level={g.chainedRiskLevel} />
              <span className="text-sm font-mono font-bold" style={{ color: RISK_C[g.chainedRiskLevel] || "#94a3b8" }}>
                {g.chainedRiskScore?.toFixed(1)}/10
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isComplete && (
            <button
              onClick={() => setCyberMode((p) => !p)}
              className="flex items-center gap-1.5 text-zinc-300 hover:text-white text-xs font-semibold px-3 py-2 rounded-xl border border-border hover:border-violet-500/50 hover:bg-violet-500/10 transition-all"
            >
              <Activity className="w-3.5 h-3.5" />
              {cyberMode ? "Cyber" : "Minimal"}
            </button>
          )}
          {isComplete && (
            <button onClick={handleReset} className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:border-zinc-600 transition-all">
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          )}
          {(notGenerated || isFailed) && (
            <button onClick={handleGenerate} disabled={generating || scan?.status !== "COMPLETED"}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all shadow-lg shadow-violet-500/20">
              {generating
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                : <><Zap className="w-4 h-4" /> Generate Attack Graph</>}
            </button>
          )}
          {isComplete && (
            <>
              {/* Download dropdown */}
              <div className="relative" ref={dlMenuRef}>
                <button onClick={() => setShowDlMenu(p => !p)}
                  className="flex items-center gap-1.5 text-zinc-300 hover:text-white text-xs font-semibold px-3 py-2 rounded-xl border border-border hover:border-violet-500/50 hover:bg-violet-500/10 transition-all">
                  <Download className="w-3.5 h-3.5" /> Export
                </button>
                <AnimatePresence>
                  {showDlMenu && (
                    <motion.div initial={{ opacity:0, y:-6, scale:.96 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:-6, scale:.96 }}
                      transition={{ duration:.15 }}
                      className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-border shadow-2xl shadow-black/50 overflow-hidden z-50"
                      style={{ background:"oklch(10% 0 0)" }}>
                      <button onClick={exportReport}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-violet-500/10 transition-colors text-left border-b border-border">
                        <FileText className="w-4 h-4 text-violet-400 flex-shrink-0" />
                        <div>
                          <div className="font-semibold text-white">HTML Report</div>
                          <div className="text-[11px] text-muted-foreground">Full styled report</div>
                        </div>
                      </button>
                      <button onClick={exportJSON}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-violet-500/10 transition-colors text-left">
                        <FileJson className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                        <div>
                          <div className="font-semibold text-white">Raw JSON</div>
                          <div className="text-[11px] text-muted-foreground">Graph data export</div>
                        </div>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {/* Regenerate */}
              <button onClick={handleGenerate} disabled={generating}
                className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-all">
                <RefreshCw className="w-3.5 h-3.5" /> Regenerate
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-violet-400 animate-spin" />
        </div>
      ) : notGenerated ? (
        <EmptyState scan={scan} onGenerate={handleGenerate} generating={generating} />
      ) : isGenerating ? (
        <GeneratingState streamLog={streamLog} nimOutput={nimOutput} logRef={logRef} />
      ) : isFailed ? (
        <FailedState error={record?.errorMessage} onRetry={handleGenerate} onReset={handleReset} generating={generating} />
      ) : isComplete && g ? (
        <div className="flex flex-1 overflow-hidden">

          {/* Left: chains */}
          <div className="w-[280px] flex-shrink-0 border-r border-border overflow-y-auto scrollbar-thin" style={{ background:"oklch(6.5% 0 0)" }}>
            <ChainsSidebar g={g} selectedChain={selectedChain} expanded={expanded}
              onSelect={(c: any) => { setSelectedChain(c); setSelectedNode(null); }}
              onToggle={toggleExpand} />
          </div>

          {/* Center: React Flow */}
          <div className="flex-1 relative" style={{ background:"#06060f" }}>
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at 28% 38%, rgba(239,68,68,.10) 0%, rgba(239,68,68,0) 52%), radial-gradient(ellipse at 62% 55%, rgba(220,38,38,.08) 0%, rgba(220,38,38,0) 58%)",
              }}
            />
            <ReactFlow nodes={nodes} edges={edges}
              onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick} nodeTypes={nodeTypes}
              fitView fitViewOptions={{ padding:0.3 }}
              proOptions={{ hideAttribution: true }}
              className={`attack-flow-canvas ${cyberMode ? "cyber-on" : "cyber-off"}`}
              minZoom={0.15} maxZoom={2.5}>
              <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="#111122" />
              <Controls showInteractive={false} style={{ bottom:16, left:16 }} />
              <MiniMap nodeColor={(n) => n.type==="attacker"?"#ef4444":n.type==="target"?"#8b5cf6":(RISK_C[(n.data as any).severity]||"#64748b")}
                style={{ bottom:16, right:16, width:160, height:100 }} />
            </ReactFlow>

            {/* Legend */}
            <div className="absolute top-4 right-4 border border-border rounded-xl p-3 text-xs backdrop-blur-sm" style={{ background:"oklch(8% 0 0 / 0.85)" }}>
              {[
                { color:"#ef4444", label:"Attacker" },
                { color:"#f97316", label:"High Vuln" },
                { color:"#eab308", label:"Medium Vuln" },
                { color:"#22c55e", label:"Low Vuln" },
                { color:"#8b5cf6", label:"Compromised Target" },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-2 mb-1.5 last:mb-0">
                  <div className="w-2.5 h-2.5 rounded-full border-2 flex-shrink-0" style={{ borderColor:color, background:`${color}30` }} />
                  <span className="text-zinc-400">{label}</span>
                </div>
              ))}
              {cyberMode && (
                <div className="mt-2 pt-2 border-t border-border/70 flex items-center gap-2">
                  <div className="w-8 h-0.5 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)] animate-pulse" />
                  <span className="text-zinc-400 text-[11px]">Animated links = exploit flow path</span>
                </div>
              )}
            </div>

            {/* Summary bar */}
            {g.summary && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 max-w-xl border border-border rounded-xl px-4 py-2 text-xs text-zinc-400 text-center backdrop-blur-sm" style={{ background:"oklch(8% 0 0 / 0.85)" }}>
                <Info className="w-3 h-3 inline mr-1 text-violet-400" />
                {g.summary}
              </div>
            )}
          </div>

          {/* Right: detail panel */}
          <AnimatePresence>
            {(selectedNode || selectedChain) && (
              <motion.div initial={{ x:320, opacity:0 }} animate={{ x:0, opacity:1 }} exit={{ x:320, opacity:0 }}
                transition={{ type:"spring", stiffness:300, damping:30 }}
                className="w-[320px] flex-shrink-0 border-l border-border overflow-y-auto scrollbar-thin"
                style={{ background:"oklch(6.5% 0 0)" }}>
                {selectedNode
                  ? <NodeDetail node={selectedNode} g={g} />
                  : selectedChain
                    ? <ChainDetail chain={selectedChain} />
                    : null}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : null}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyState({ scan, onGenerate, generating }: any) {
  const canGenerate = scan?.status === "COMPLETED";
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-lg text-center">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="w-20 h-20 rounded-3xl bg-violet-500/8 border border-violet-500/15 flex items-center justify-center">
            <GitMerge className="w-9 h-9 text-violet-400" />
          </div>
          <div className="absolute -inset-2 rounded-[28px] border border-violet-500/8 animate-ping" style={{ animationDuration:"3s" }} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">AI Attack Path Analysis</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed text-sm">
          NVIDIA NIM analyzes every vulnerability and chains them into realistic multi-stage attack paths —
          showing exactly how an attacker would move from initial access to full compromise.
        </p>
        <div className="grid grid-cols-3 gap-3 mb-7 text-left">
          {[
            { icon: Zap,      label: "Chain vulns",        desc: "See how weaknesses combine for maximum damage" },
            { icon: Activity, label: "MITRE ATT&CK",       desc: "Mapped to real adversary techniques and tactics" },
            { icon: Shield,   label: "Remediation focus",  desc: "Fix one finding to break the most chains" },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="border border-border rounded-xl p-3" style={{ background:"oklch(8% 0 0)" }}>
              <Icon className="w-4 h-4 text-violet-400 mb-2" />
              <div className="text-white text-xs font-semibold mb-1">{label}</div>
              <div className="text-muted-foreground text-[11px] leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>
        {canGenerate ? (
          <button onClick={onGenerate} disabled={generating}
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold px-8 py-3 rounded-2xl transition-all text-sm shadow-xl shadow-violet-500/25">
            {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Zap className="w-4 h-4" /> Generate Attack Graph</>}
          </button>
        ) : (
          <div className="flex items-center gap-2 text-amber-400 text-sm bg-amber-500/8 border border-amber-500/20 rounded-xl p-3 justify-center">
            <AlertTriangle className="w-4 h-4" /> Scan must be completed first
          </div>
        )}
      </div>
    </div>
  );
}

function GeneratingState({ streamLog, nimOutput, logRef }: { streamLog: string[]; nimOutput: string; logRef: React.RefObject<HTMLDivElement|null> }) {
  return (
    <div className="flex-1 flex flex-col md:flex-row gap-0 overflow-hidden">
      {/* Left: steps */}
      <div className="w-full md:w-[340px] flex-shrink-0 border-r border-border p-5 flex flex-col" style={{ background:"oklch(6.5% 0 0)" }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="relative">
            <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-violet-400" />
            </div>
            <div className="absolute inset-0 rounded-xl border border-violet-500/30 animate-ping" style={{ animationDuration:"2s" }} />
          </div>
          <div>
            <div className="text-white text-sm font-semibold">NVIDIA NIM Processing</div>
            <div className="text-muted-foreground text-xs">nvidia/llama-3.1-nemotron-70b-instruct
              
            </div>
          </div>
        </div>
        <div className="space-y-2 flex-1">
          {["Fetching scan findings…", "Mapping endpoint relationships…", "Connecting to NIM AI…", "Generating attack paths…", "Validating graph structure…"].map((label, i) => {
            const done  = streamLog.length > i + 1;
            const active = streamLog.length === i + 1 || (i === 0 && streamLog.length === 0);
            const msg   = streamLog[i] || label;
            return (
              <div key={i} className={`flex items-start gap-3 text-sm transition-all duration-500 ${streamLog.length > i ? "opacity-100" : "opacity-25"}`}>
                {done
                  ? <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  : active
                    ? <Loader2 className="w-4 h-4 text-violet-400 animate-spin flex-shrink-0 mt-0.5" />
                    : <div className="w-4 h-4 rounded-full border border-zinc-700 flex-shrink-0 mt-0.5" />}
                <span className={active ? "text-white" : done ? "text-zinc-400" : "text-zinc-600"}>{msg}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 text-xs text-muted-foreground text-center">
          This usually takes 15–30 seconds
        </div>
      </div>

      {/* Right: live NIM output */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border" style={{ background:"oklch(5% 0 0)" }}>
          <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
            </span>
            nim_output_stream.json
          </div>
        </div>
        <div ref={logRef as any} className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed text-green-400/80 scrollbar-thin" style={{ background:"oklch(4% 0 0)" }}>
          {nimOutput
            ? <pre className="whitespace-pre-wrap break-all">{nimOutput}<span className="inline-block w-1.5 h-3 bg-green-400 animate-pulse ml-0.5 align-middle" /></pre>
            : <div className="text-zinc-600">Waiting for NVIDIA NIM response…<span className="inline-block w-1.5 h-3 bg-zinc-600 animate-pulse ml-1 align-middle" /></div>}
        </div>
      </div>
    </div>
  );
}

function FailedState({ error, onRetry, onReset, generating }: any) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-3xl bg-red-500/8 border border-red-500/15 flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Generation Failed</h2>
        {error && (
          <p className="text-red-400/80 text-xs mb-6 font-mono bg-red-500/5 border border-red-500/10 rounded-xl p-3 text-left break-all">{error}</p>
        )}
        <div className="flex items-center gap-3 justify-center">
          <button onClick={onRetry} disabled={generating}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold px-5 py-2 rounded-xl transition-all text-sm">
            <Zap className="w-4 h-4" /> Retry
          </button>
          <button onClick={onReset}
            className="flex items-center gap-2 text-zinc-400 hover:text-white px-5 py-2 rounded-xl border border-border hover:border-zinc-600 transition-all text-sm">
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
        </div>
      </div>
    </div>
  );
}

function ChainsSidebar({ g, selectedChain, expanded, onSelect, onToggle }: any) {
  return (
    <div className="p-4">
      {g.attackSurface && (
        <div className="mb-4 p-3 rounded-xl border border-violet-500/15" style={{ background:"rgba(139,92,246,.06)" }}>
          <div className="text-[10px] text-violet-400 uppercase tracking-wider font-semibold mb-1.5">Attack Surface</div>
          <p className="text-zinc-300 text-xs leading-relaxed">{g.attackSurface}</p>
        </div>
      )}

      <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-3">
        Attack Chains ({g.chains?.length ?? 0})
      </div>

      <div className="space-y-2">
        {g.chains?.map((chain: Chain) => {
          const isSelected = selectedChain?.id === chain.id;
          const isExpanded = expanded.has(chain.id);
          const c = RISK_C[chain.risk] || "#94a3b8";
          return (
            <div key={chain.id}
              className={`rounded-xl transition-all`}
              style={{ background: isSelected ? `${c}08` : "oklch(8% 0 0)", border: isSelected ? `1.5px solid ${c}50` : "1px solid oklch(14% 0 0)" }}>
              <button className="w-full text-left p-3" onClick={() => onSelect(chain)}>
                <div className="flex items-center gap-2 mb-1.5">
                  <RiskBadge level={chain.risk} />
                  <span style={{ color:c }} className="text-xs font-mono font-bold ml-auto">{chain.riskScore?.toFixed(1)}</span>
                </div>
                <div className="text-white text-xs font-semibold leading-tight">{chain.title}</div>
                {chain.mitreIds?.length && (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {chain.mitreIds.slice(0,3).map(id => (
                      <span key={id} className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">{id}</span>
                    ))}
                  </div>
                )}
                <div className="text-muted-foreground text-[11px] mt-1">{chain.steps?.length} steps</div>
              </button>
              <button onClick={() => onToggle(chain.id)}
                className="w-full flex items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-white py-1.5 border-t border-border/40 transition-colors">
                {isExpanded ? <><ChevronUp className="w-3 h-3" /> Hide</> : <><ChevronDown className="w-3 h-3" /> Steps</>}
              </button>
              {isExpanded && (
                <div className="px-3 pb-3 space-y-2 border-t border-border/30">
                  {chain.steps?.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 pt-2">
                      <div style={{ background:`${c}18`, color:c }} className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">{s.stepNumber}</div>
                      <div>
                        <div className="text-white text-[11px] font-medium">{s.title}</div>
                        <div className="text-muted-foreground text-[11px]">{s.impact}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChainDetail({ chain }: { chain: Chain }) {
  const c = RISK_C[chain.risk] || "#94a3b8";
  return (
    <div className="p-5">
      <div className="mb-4">
        <RiskBadge level={chain.risk} />
        <h2 className="text-base font-bold text-white mt-2 leading-tight">{chain.title}</h2>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">Risk Score:</span>
          <span style={{ color:c }} className="text-sm font-mono font-bold">{chain.riskScore?.toFixed(1)} / 10</span>
        </div>
        {chain.mitreIds?.length && (
          <div className="flex gap-1 mt-2 flex-wrap">
            {chain.mitreIds.map(id => (
              <a key={id} href={`https://attack.mitre.org/techniques/${id}/`} target="_blank" rel="noopener"
                className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded font-mono flex items-center gap-0.5 transition-colors">
                {id}<ExternalLink className="w-2.5 h-2.5" />
              </a>
            ))}
          </div>
        )}
      </div>
      <p className="text-zinc-300 text-xs leading-relaxed mb-4">{chain.description}</p>

      <div className="relative space-y-4">
        {chain.steps?.map((s, i) => (
          <div key={i} className="relative">
            {i < chain.steps.length-1 && (
              <div className="absolute left-[14px] top-8 bottom-0 w-px" style={{ background:`${c}20` }} />
            )}
            <div className="flex items-start gap-3">
              <div style={{ background:`${c}18`, border:`1px solid ${c}35`, color:c }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                {s.stepNumber}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold text-xs mb-0.5">{s.title}</div>
                {s.technique && <div className="text-[10px] font-mono text-zinc-500 mb-1">{s.technique}</div>}
                {s.endpoint && <div className="font-mono text-[10px] text-zinc-500 mb-1 truncate">{s.endpoint}</div>}
                <div className="text-zinc-400 text-xs mb-2">{s.action}</div>
                {s.payload && (
                  <div className="rounded-lg p-2 mb-2" style={{ background:"oklch(4% 0 0)", border:"1px solid oklch(15% 0 0)" }}>
                    <div className="text-[9px] text-zinc-600 uppercase mb-1">Payload</div>
                    <code className="text-amber-400 text-[10px] break-all">{s.payload}</code>
                  </div>
                )}
                {s.poc && (
                  <div className="rounded-lg p-2 mb-2" style={{ background:"oklch(4% 0 0)", border:"1px solid oklch(15% 0 0)" }}>
                    <div className="text-[9px] text-zinc-600 uppercase mb-1">PoC</div>
                    <code className="text-green-400 text-[10px] break-all whitespace-pre-wrap">{s.poc}</code>
                  </div>
                )}
                <div className="flex items-start gap-1">
                  <ChevronRight className="w-3 h-3 text-violet-400 flex-shrink-0 mt-0.5" />
                  <span className="text-violet-300 text-[11px]">{s.impact}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NodeDetail({ node, g }: { node: GNode; g: Graph }) {
  const chain = g.chains?.find(c => c.steps?.some(s => s.findingId === node.findingId));
  const c = RISK_C[node.severity||""] || "#94a3b8";
  return (
    <div className="p-5">
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          {node.type === "attacker" && <Crosshair className="w-4 h-4 text-red-400" />}
          {node.type === "vulnerability" && <AlertTriangle style={{ color:c }} className="w-4 h-4" />}
          {node.type === "target" && <Target className="w-4 h-4 text-violet-400" />}
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
            {node.type === "attacker" ? "Threat Actor" : node.type === "vulnerability" ? "Vulnerability" : "Compromised Asset"}
          </span>
        </div>
        {node.severity && <RiskBadge level={node.severity} />}
        <h2 className="text-base font-bold text-white mt-2">{node.label}</h2>
        {node.endpoint && <div className="font-mono text-xs text-zinc-400 mt-1">{node.endpoint}</div>}
        {node.technique && <div style={{ color:c }} className="text-xs font-mono mt-1 opacity-80">{node.technique}</div>}
        {node.description && <p className="text-zinc-400 text-xs mt-2">{node.description}</p>}
      </div>
      {chain && (
        <div className="border-t border-border pt-4">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">Part of Attack Chain</div>
          <div className="rounded-xl border border-border p-3" style={{ background:"oklch(8% 0 0)" }}>
            <RiskBadge level={chain.risk} />
            <div className="text-white text-xs font-semibold mt-2">{chain.title}</div>
            <div className="text-muted-foreground text-[11px] mt-1">{chain.steps?.length} exploitation steps</div>
          </div>
        </div>
      )}
    </div>
  );
}
