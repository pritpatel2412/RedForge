import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Send, Copy, Check, Sparkles, RotateCcw, User,
  AlertTriangle, Shield, ChevronRight, Zap, Code2,
  MessageSquare, Terminal, Lock, ThumbsUp, ThumbsDown,
  Share2, Paperclip, Mic, MicOff, X, ImageIcon,
  PanelLeft, Plus, Trash2, Clock, MessagesSquare,
  RefreshCw, Pencil, Search, Lightbulb,
} from "lucide-react";
import { useGetDashboardStats, useListFindings } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  imagePreview?: string;
  imageName?: string;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

type Feedback = "like" | "dislike" | null;

// ─── Quick Prompts ────────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  { label: "Most critical?",      icon: AlertTriangle, color: "text-red-400",    q: "Which of my findings is most critical and most likely to be exploited right now? Give me a detailed breakdown." },
  { label: "Remediation plan",    icon: ChevronRight,  color: "text-amber-400",  q: "Create a prioritized 30-day remediation roadmap for all my open findings, ordered by risk and fix complexity." },
  { label: "Explain CORS attack", icon: Shield,        color: "text-blue-400",   q: "Explain how a CORS misconfiguration can be exploited in practice, with a real attack scenario and the exact fix." },
  { label: "Explain SSRF",        icon: Zap,           color: "text-purple-400", q: "What is Server-Side Request Forgery (SSRF)? Show me how to exploit it and how to prevent it with code examples." },
  { label: "Executive summary",   icon: MessageSquare, color: "text-green-400",  q: "Generate a professional executive summary of our current security posture that I can share with non-technical stakeholders." },
  { label: "Quick wins",          icon: Code2,         color: "text-cyan-400",   q: "Which of my open findings can be fixed in under an hour? List them with exact steps I can take right now." },
];

// ─── Waveform ─────────────────────────────────────────────────────────────────
function MicWaveform({ isRecording }: { isRecording: boolean }) {
  const bars = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      h1: 10 + Math.random() * 14, h2: 6 + Math.random() * 22,
      h3: 8 + Math.random() * 12, h4: 14 + Math.random() * 10,
      delay: i * 0.05,
    })), []
  );
  return (
    <div className="flex items-center gap-[2.5px] h-9">
      {bars.map((bar, i) => (
        <motion.div key={i} className="rounded-full"
          style={{ width: 3, backgroundColor: i % 3 === 0 ? "hsl(348 83% 55%)" : i % 3 === 1 ? "hsl(348 83% 45%)" : "hsl(348 83% 35%)" }}
          animate={{ height: isRecording ? [bar.h1, bar.h2, bar.h3, bar.h4, bar.h1] : 4 }}
          transition={{ duration: 0.6, repeat: isRecording ? Infinity : 0, delay: bar.delay, repeatType: "reverse", ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

// ─── Markdown renderer ────────────────────────────────────────────────────────
function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <div className="my-3 rounded-xl overflow-hidden border border-white/8" style={{ background: "oklch(4% 0 0)" }}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/8" style={{ background: "oklch(6% 0 0)" }}>
        <div className="flex items-center gap-2">
          <Terminal className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{lang || "code"}</span>
        </div>
        <button onClick={copy} className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-white transition-colors px-2 py-0.5 rounded hover:bg-white/8">
          {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="p-4 text-xs font-mono text-zinc-200 overflow-x-auto leading-relaxed whitespace-pre-wrap"><code>{code}</code></pre>
    </div>
  );
}

function renderInline(text: string): React.ReactNode[] {
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  const parts: React.ReactNode[] = [];
  let last = 0; let m: RegExpExecArray | null; let key = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) parts.push(<strong key={key++} className="font-semibold text-white">{tok.slice(2,-2)}</strong>);
    else if (tok.startsWith("`")) parts.push(<code key={key++} className="font-mono text-[11px] px-1.5 py-0.5 rounded text-emerald-300" style={{ background: "oklch(9% 0.02 150)" }}>{tok.slice(1,-1)}</code>);
    else if (tok.startsWith("*")) parts.push(<em key={key++} className="text-zinc-300 italic">{tok.slice(1,-1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function TextSection({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  let listItems: React.ReactNode[] = [];
  let listType: "ul" | "ol" | null = null;

  function flushList() {
    if (!listItems.length) return;
    elements.push(listType === "ul"
      ? <ul key={`ul-${i}`} className="space-y-1 my-2">{listItems}</ul>
      : <ol key={`ol-${i}`} className="space-y-1 my-2">{listItems}</ol>
    );
    listItems = []; listType = null;
  }

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("# ")) {
      flushList();
      elements.push(<h2 key={i} className="text-lg font-bold text-white mt-5 mb-2 border-b border-white/10 pb-1">{renderInline(line.slice(2))}</h2>);
    } else if (line.startsWith("## ")) {
      flushList();
      elements.push(<h3 key={i} className="text-base font-bold text-white mt-4 mb-1.5">{renderInline(line.slice(3))}</h3>);
    } else if (line.startsWith("### ")) {
      flushList();
      elements.push(<h4 key={i} className="text-sm font-semibold text-zinc-100 mt-3 mb-1">{renderInline(line.slice(4))}</h4>);
    } else if (line.match(/^[-*•] /)) {
      if (listType !== "ul") { flushList(); listType = "ul"; }
      listItems.push(
        <li key={i} className="flex items-start gap-2 text-sm text-zinc-200 leading-relaxed">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/70 shrink-0" />
          <span>{renderInline(line.replace(/^[-*•] /, ""))}</span>
        </li>
      );
    } else if (line.match(/^\d+\. /)) {
      if (listType !== "ol") { flushList(); listType = "ol"; }
      const nm = line.match(/^(\d+)\. (.*)/);
      listItems.push(
        <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-200 leading-relaxed">
          <span className="text-primary font-mono text-xs font-bold shrink-0 mt-0.5">{nm?.[1]}.</span>
          <span>{renderInline(nm?.[2] || "")}</span>
        </li>
      );
    } else if (line.match(/^\|/) && line.includes("|") && !line.includes("---")) {
      flushList();
      const cells = line.split("|").filter(c => c.trim() !== "");
      const isHeader = lines[i + 1]?.includes("---");
      if (isHeader) {
        const headerCells = cells.map((c, j) => <th key={j} className="px-3 py-1.5 text-left text-xs font-semibold text-zinc-300">{renderInline(c.trim())}</th>);
        const rows: React.ReactNode[] = [];
        let ti = i; i += 2;
        while (i < lines.length && lines[i].match(/^\|/) && !lines[i].includes("---")) {
          const rc = lines[i].split("|").filter(c => c.trim() !== "");
          rows.push(<tr key={i} className="border-b border-white/5">{rc.map((c, j) => <td key={j} className="px-3 py-1.5 text-xs text-zinc-400">{renderInline(c.trim())}</td>)}</tr>);
          i++;
        }
        elements.push(
          <div key={`tbl-${ti}`} className="my-3 rounded-xl overflow-hidden border border-white/8">
            <table className="w-full" style={{ background: "oklch(6% 0 0)" }}>
              <thead className="border-b border-white/10" style={{ background: "oklch(8% 0 0)" }}><tr>{headerCells}</tr></thead>
              <tbody>{rows}</tbody>
            </table>
          </div>
        );
        continue;
      }
    } else if (line.trim() === "---") {
      flushList();
      elements.push(<hr key={i} className="my-3 border-white/8" />);
    } else if (line.trim() === "") {
      flushList();
      elements.push(<div key={i} className="h-1.5" />);
    } else {
      flushList();
      elements.push(<p key={i} className="text-sm text-zinc-200 leading-relaxed">{renderInline(line)}</p>);
    }
    i++;
  }
  flushList();
  return <>{elements}</>;
}

function MarkdownMessage({ content }: { content: string }) {
  const segments: React.ReactNode[] = [];
  const re = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0; let m: RegExpExecArray | null; let idx = 0;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) segments.push(<TextSection key={idx++} text={content.slice(last, m.index)} />);
    segments.push(<CodeBlock key={idx++} lang={m[1]} code={m[2].trim()} />);
    last = m.index + m[0].length;
  }
  if (last < content.length) segments.push(<TextSection key={idx++} text={content.slice(last)} />);
  return <div className="space-y-0.5">{segments}</div>;
}

function TypingCursor() {
  return <span className="inline-block w-0.5 h-3.5 bg-primary ml-0.5 animate-pulse align-middle" />;
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map(i => (
        <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-primary/70"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
      ))}
    </div>
  );
}

// ─── Message Action Bar ───────────────────────────────────────────────────────
function MessageActions({
  msg, feedback, onFeedback, isLast: _isLast, isStreaming: _isStreaming,
}: {
  msg: ChatMessage;
  feedback: Feedback;
  onFeedback: (f: Feedback) => void;
  isLast: boolean;
  isStreaming: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copyMsg = () => {
    navigator.clipboard.writeText(msg.content).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
      toast.success("Copied to clipboard");
    });
  };
  const shareMsg = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "RedForge AI Security Analysis", text: msg.content }); } catch {}
    } else {
      navigator.clipboard.writeText(msg.content);
      toast.success("Response copied for sharing");
    }
  };
  return (
    <div className="flex items-center gap-0.5 mt-2 ml-0.5 opacity-40 group-hover:opacity-100 transition-all duration-200">
      <button onClick={() => onFeedback(feedback === "like" ? null : "like")}
        className={cn("flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] transition-all",
          feedback === "like" ? "bg-green-500/15 text-green-400 border border-green-500/25" : "text-zinc-600 hover:text-green-400 hover:bg-green-500/10 border border-transparent")}
        title="Helpful">
        <ThumbsUp className="w-3 h-3" />
        {feedback === "like" && <span className="font-medium">Helpful</span>}
      </button>
      <button onClick={() => onFeedback(feedback === "dislike" ? null : "dislike")}
        className={cn("flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] transition-all",
          feedback === "dislike" ? "bg-red-500/15 text-red-400 border border-red-500/25" : "text-zinc-600 hover:text-red-400 hover:bg-red-500/10 border border-transparent")}
        title="Not helpful">
        <ThumbsDown className="w-3 h-3" />
        {feedback === "dislike" && <span className="font-medium">Not helpful</span>}
      </button>
      <div className="w-px h-3 bg-white/10 mx-0.5" />
      <button onClick={copyMsg} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-zinc-600 hover:text-zinc-300 hover:bg-white/6 border border-transparent transition-all" title="Copy">
        {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
        <span>{copied ? "Copied" : "Copy"}</span>
      </button>
      <button onClick={shareMsg} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-zinc-600 hover:text-zinc-300 hover:bg-white/6 border border-transparent transition-all" title="Share">
        <Share2 className="w-3 h-3" /><span>Share</span>
      </button>
    </div>
  );
}

// ─── Follow-up Chips ──────────────────────────────────────────────────────────
function FollowUpChips({ suggestions, onSelect, isStreaming }: {
  suggestions: string[];
  onSelect: (q: string) => void;
  isStreaming: boolean;
}) {
  if (!suggestions.length) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="mt-3 flex flex-wrap gap-1.5"
    >
      <div className="w-full flex items-center gap-1.5 mb-1">
        <Lightbulb className="w-3 h-3 text-amber-400/70" />
        <span className="text-[10px] text-zinc-600 font-medium uppercase tracking-widest">Follow-up questions</span>
      </div>
      {suggestions.map((s, i) => (
        <button
          key={i}
          onClick={() => onSelect(s)}
          disabled={isStreaming}
          className="text-[11px] px-2.5 py-1.5 rounded-xl border border-primary/15 text-zinc-400 hover:text-white hover:border-primary/35 hover:bg-primary/8 transition-all disabled:opacity-30 text-left leading-snug"
          style={{ background: "oklch(7% 0 0)" }}
        >
          {s}
        </button>
      ))}
    </motion.div>
  );
}

// ─── Relative time ────────────────────────────────────────────────────────────
function relativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffM = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);
  if (diffM < 1) return "just now";
  if (diffM < 60) return `${diffM}m ago`;
  if (diffH < 24) return `${diffH}h ago`;
  if (diffD === 1) return "yesterday";
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function groupConversations(conversations: Conversation[]): { label: string; items: Conversation[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const lastWeek = new Date(today.getTime() - 7 * 86400000);

  const groups: { label: string; items: Conversation[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Last 7 days", items: [] },
    { label: "Older", items: [] },
  ];
  conversations.forEach(c => {
    const d = new Date(c.updatedAt);
    if (d >= today)          groups[0].items.push(c);
    else if (d >= yesterday) groups[1].items.push(c);
    else if (d >= lastWeek)  groups[2].items.push(c);
    else                     groups[3].items.push(c);
  });
  return groups.filter(g => g.items.length > 0);
}

// ─── API helpers ──────────────────────────────────────────────────────────────
const api = {
  get: (path: string) =>
    fetch(`${BASE}/api/chat${path}`, { credentials: "include" }).then(r => r.json()),
  post: (path: string, body: any) =>
    fetch(`${BASE}/api/chat${path}`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).then(r => r.json()),
  patch: (path: string, body: any) =>
    fetch(`${BASE}/api/chat${path}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }),
  delete: (path: string) =>
    fetch(`${BASE}/api/chat${path}`, { method: "DELETE", credentials: "include" }),
  deleteWithQuery: (path: string, query: string) =>
    fetch(`${BASE}/api/chat${path}?${query}`, { method: "DELETE", credentials: "include" }),
};

async function streamChat(
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
) {
  const resp = await fetch(`${BASE}/api/chat`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: messages.map(m => ({ role: m.role, content: m.content })) }),
  });
  if (!resp.ok) {
    try { const e = await resp.json(); onError(e.error || "Request failed"); } catch { onError(`HTTP ${resp.status}`); }
    return;
  }
  const reader = resp.body?.getReader();
  if (!reader) { onError("No stream"); return; }
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      if (line.startsWith("event: done")) { onDone(); reader.cancel(); return; }
      if (line.startsWith("event: error")) { onError("Stream error"); reader.cancel(); return; }
      if (line.startsWith("data: ")) {
        try { const d = JSON.parse(line.slice(6)); if (d.text) onChunk(d.text); } catch {}
      }
    }
  }
  onDone();
}

// ─── Welcome message ──────────────────────────────────────────────────────────
const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content: `## Welcome to RedForge AI

I'm your dedicated security advisor with full access to your workspace's vulnerability data.

**I can help you:**
- Identify and explain your most critical vulnerabilities
- Create prioritized remediation roadmaps
- Generate working code fixes and patches
- Explain attack techniques with real-world scenarios
- Map findings to OWASP, CWE, and compliance frameworks
- Draft executive reports for stakeholders

Ask me anything — or pick a quick action below to get started.`,
};

// ─── History Sidebar ──────────────────────────────────────────────────────────
function ConversationSidebar({
  conversations, activeId, onSelect, onNew, onDelete, onRename, loading,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  loading: boolean;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);

  const filtered = search.trim()
    ? conversations.filter(c => c.title.toLowerCase().includes(search.toLowerCase()))
    : conversations;

  const groups = groupConversations(filtered);

  useEffect(() => {
    if (renamingId && renameRef.current) {
      renameRef.current.focus();
      renameRef.current.select();
    }
  }, [renamingId]);

  const startRename = (conv: Conversation) => {
    setRenamingId(conv.id);
    setRenameText(conv.title);
  };

  const commitRename = (id: string) => {
    if (renameText.trim() && renameText.trim() !== conversations.find(c => c.id === id)?.title) {
      onRename(id, renameText.trim());
    }
    setRenamingId(null);
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "oklch(5% 0 0)" }}>
      {/* New Chat */}
      <div className="p-3 border-b border-border shrink-0 space-y-2">
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-primary/25 text-primary hover:bg-primary/10 text-xs font-semibold transition-all"
          style={{ background: "hsl(348 83% 50% / 0.06)" }}
        >
          <Plus className="w-3.5 h-3.5" />
          New Chat
        </button>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search conversations…"
            className="w-full pl-7 pr-2 py-1.5 rounded-lg text-xs bg-white/4 border border-white/6 text-zinc-300 placeholder:text-zinc-700 outline-none focus:border-white/12 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5 scrollbar-hide">
        {loading && (
          <div className="flex flex-col gap-2 px-1 pt-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: "oklch(10% 0 0)" }} />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center px-3">
            <MessagesSquare className="w-8 h-8 text-zinc-800 mb-3" />
            <p className="text-zinc-600 text-xs">{search ? "No conversations match." : "No conversations yet."}</p>
            {!search && <p className="text-zinc-700 text-[10px] mt-1">Start chatting to create your first one.</p>}
          </div>
        )}

        {groups.map(group => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-700 px-2 py-1.5">{group.label}</p>
            {group.items.map(conv => (
              <div
                key={conv.id}
                onMouseEnter={() => setHovered(conv.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => renamingId !== conv.id && onSelect(conv.id)}
                onDoubleClick={() => startRename(conv)}
                className={cn(
                  "group/item flex items-center gap-1.5 px-2 py-2 rounded-xl cursor-pointer transition-all",
                  activeId === conv.id
                    ? "bg-primary/12 border border-primary/20"
                    : "hover:bg-white/4 border border-transparent"
                )}
                title="Double-click to rename"
              >
                <div className="flex-1 min-w-0">
                  {renamingId === conv.id ? (
                    <input
                      ref={renameRef}
                      value={renameText}
                      onChange={e => setRenameText(e.target.value)}
                      onBlur={() => commitRename(conv.id)}
                      onKeyDown={e => {
                        if (e.key === "Enter") commitRename(conv.id);
                        if (e.key === "Escape") setRenamingId(null);
                        e.stopPropagation();
                      }}
                      onClick={e => e.stopPropagation()}
                      className="w-full text-xs text-white bg-white/8 border border-primary/30 rounded-md px-1.5 py-0.5 outline-none"
                    />
                  ) : (
                    <>
                      <p className={cn("text-xs truncate leading-tight", activeId === conv.id ? "text-white font-medium" : "text-zinc-400")}>
                        {conv.title}
                      </p>
                      <p className="text-[10px] text-zinc-700 mt-0.5 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {relativeTime(conv.updatedAt)}
                      </p>
                    </>
                  )}
                </div>
                <AnimatePresence>
                  {hovered === conv.id && renamingId !== conv.id && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.1 }}
                      className="flex items-center gap-0.5 shrink-0"
                    >
                      <button
                        onClick={e => { e.stopPropagation(); startRename(conv); }}
                        className="p-1 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/8 transition-colors"
                        title="Rename"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); onDelete(conv.id); }}
                        className="p-1 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});

  // Follow-up suggestions
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsForId, setSuggestionsForId] = useState<string | null>(null);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [convLoading, setConvLoading] = useState(true);

  // Edit mode for user messages
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // Image upload
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mic
  const [isRecording, setIsRecording] = useState(false);
  const [micSupported, setMicSupported] = useState(true);
  const [liveTranscript, setLiveTranscript] = useState("");
  const recognitionRef = useRef<any>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<boolean>(false);
  const activeConvIdRef = useRef<string | null>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);

  const { data: stats } = useGetDashboardStats();
  const { data: rawFindings } = useListFindings({} as any);
  const findings = Array.isArray(rawFindings) ? rawFindings : (rawFindings as any)?.findings ?? [];

  const criticalCount = findings.filter((f: any) => f.severity === "CRITICAL").length;
  const highCount     = findings.filter((f: any) => f.severity === "HIGH").length;
  const openCount     = findings.filter((f: any) => f.status === "OPEN" || f.status === "IN_PROGRESS").length;

  const riskBadge = criticalCount > 0
    ? { label: "CRITICAL RISK", color: "text-red-400 bg-red-500/10 border-red-500/20" }
    : highCount > 2
    ? { label: "HIGH RISK",     color: "text-amber-400 bg-amber-500/10 border-amber-500/20" }
    : openCount > 0
    ? { label: "MEDIUM RISK",   color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" }
    : { label: "LOW RISK",      color: "text-green-400 bg-green-500/10 border-green-500/20" };

  // Keep refs in sync
  useEffect(() => { activeConvIdRef.current = activeConvId; }, [activeConvId]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Load conversation list on mount
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) setMicSupported(false);
    api.get("/conversations").then((data: any) => {
      if (Array.isArray(data)) setConversations(data);
    }).catch(() => {}).finally(() => setConvLoading(false));
  }, []);

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, liveTranscript, suggestions]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [input]);

  // ── Follow-up suggestions ─────────────────────────────────────────────────
  const fetchSuggestions = useCallback(async (aiMsgId: string, content: string) => {
    setSuggestions([]);
    setSuggestionsForId(aiMsgId);
    const data = await api.post("/followups", {
      lastResponse: content,
      topic: "security vulnerability analysis",
    }).catch(() => ({ suggestions: [] }));
    if (Array.isArray(data?.suggestions) && data.suggestions.length > 0) {
      setSuggestions(data.suggestions);
    }
  }, []);

  // ── Load a conversation ───────────────────────────────────────────────────
  const loadConversation = useCallback(async (id: string) => {
    setActiveConvId(id);
    setMessages([]);
    setFeedback({});
    setSuggestions([]);
    setSuggestionsForId(null);
    setEditingId(null);
    const data = await api.get(`/conversations/${id}/messages`);
    if (Array.isArray(data) && data.length > 0) {
      const msgs = data.map((m: any) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        imagePreview: m.imagePreview || undefined,
        imageName: m.imageName || undefined,
      }));
      setMessages(msgs);
      const lastAI = [...msgs].reverse().find(m => m.role === "assistant");
      if (lastAI) fetchSuggestions(lastAI.id, lastAI.content);
    } else {
      setMessages([WELCOME]);
    }
  }, [fetchSuggestions]);

  // ── New conversation ───────────────────────────────────────────────────────
  const startNewConversation = useCallback(() => {
    setActiveConvId(null);
    setMessages([WELCOME]);
    setFeedback({});
    setSuggestions([]);
    setSuggestionsForId(null);
    setInput("");
    setEditingId(null);
    clearImage();
    abortRef.current = true;
    setIsStreaming(false);
  }, []);

  // ── Delete conversation ────────────────────────────────────────────────────
  const deleteConversation = useCallback(async (id: string) => {
    await api.delete(`/conversations/${id}`);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvIdRef.current === id) {
      setActiveConvId(null);
      setMessages([WELCOME]);
      setSuggestions([]);
    }
    toast.success("Conversation deleted");
  }, []);

  // ── Rename conversation ────────────────────────────────────────────────────
  const renameConversation = useCallback(async (id: string, title: string) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c));
    await api.patch(`/conversations/${id}`, { title }).catch(() => {});
  }, []);

  // ── Image upload ──────────────────────────────────────────────────────────
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { setImagePreview(ev.target?.result as string); setImageName(file.name); };
    reader.readAsDataURL(file);
    e.target.value = "";
  };
  const clearImage = () => { setImagePreview(null); setImageName(null); };

  // ── Mic ───────────────────────────────────────────────────────────────────
  const startRecording = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Microphone not supported in this browser"); return; }
    const recognition = new SR();
    recognition.continuous = true; recognition.interimResults = true; recognition.lang = "en-US";
    recognition.onresult = (event: any) => {
      const t = Array.from(event.results as SpeechRecognitionResultList).map((r: SpeechRecognitionResult) => r[0].transcript).join(" ");
      setLiveTranscript(t);
    };
    recognition.onerror = () => { toast.error("Microphone error"); stopRecording(); };
    recognition.onend = () => { if (isRecording) recognition.start(); };
    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true); setLiveTranscript("");
  };
  const stopRecording = () => {
    recognitionRef.current?.stop(); recognitionRef.current = null;
    setIsRecording(false);
    if (liveTranscript.trim()) setInput(prev => (prev ? prev + " " : "") + liveTranscript.trim());
    setLiveTranscript("");
    setTimeout(() => textareaRef.current?.focus(), 50);
  };
  const toggleMic = () => { isRecording ? stopRecording() : startRecording(); };

  // ── Core streaming engine ──────────────────────────────────────────────────
  const runStream = useCallback(async (
    historyMessages: ChatMessage[],
    userMsg: ChatMessage,
    convId: string | null,
    dbMsgsToSave: Array<{ role: string; content: string; imagePreview?: string | null; imageName?: string | null }>,
  ) => {
    const aiId = crypto.randomUUID();
    const aiMsg: ChatMessage = { id: aiId, role: "assistant", content: "", streaming: true };

    setSuggestions([]);
    setSuggestionsForId(null);
    setMessages(prev => {
      const withoutWelcome = prev.filter(m => m.id !== "welcome");
      const upToUser = withoutWelcome.filter(m => m.id !== aiId);
      // Find if userMsg already appended
      const hasUser = upToUser.some(m => m.id === userMsg.id);
      return [...(hasUser ? upToUser : [...upToUser, userMsg]), aiMsg];
    });
    setIsStreaming(true);
    abortRef.current = false;

    // Create conversation if needed
    let cid = convId || activeConvIdRef.current;
    if (!cid) {
      const title = userMsg.content.replace(/\n\n\[User attached image:[^\]]+\]/g, "").slice(0, 60).trim() || "New conversation";
      const newConv = await api.post("/conversations", { title });
      if (newConv?.id) {
        cid = newConv.id;
        setActiveConvId(newConv.id);
        setConversations(prev => [newConv, ...prev]);
      }
    }

    // Save user messages to DB
    if (cid && dbMsgsToSave.length > 0) {
      api.post(`/conversations/${cid}/messages`, { messages: dbMsgsToSave }).catch(() => {});
    }

    let full = "";
    await streamChat(
      [...historyMessages.filter(m => m.id !== "welcome"), userMsg],
      (chunk) => {
        if (abortRef.current) return;
        full += chunk;
        setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: full } : m));
      },
      async () => {
        setMessages(prev => prev.map(m => m.id === aiId ? { ...m, streaming: false } : m));
        setIsStreaming(false);
        if (cid && full) {
          await api.post(`/conversations/${cid}/messages`, {
            messages: [{ role: "assistant", content: full }],
          }).catch(() => {});
          api.get("/conversations").then((data: any) => {
            if (Array.isArray(data)) setConversations(data);
          }).catch(() => {});
          fetchSuggestions(aiId, full);
        }
      },
      (err) => {
        if (err === "AI_KEY_MISSING") {
          setApiKeyMissing(true);
          setMessages(prev => prev.filter(m => m.id !== aiId));
        } else {
          setMessages(prev => prev.map(m => m.id === aiId
            ? { ...m, content: `❌ **Error**: ${err}\n\nPlease try again.`, streaming: false }
            : m
          ));
        }
        setIsStreaming(false);
      },
    );
  }, [fetchSuggestions]);

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed && !imagePreview) return;
    if (isStreaming) return;
    if (isRecording) stopRecording();

    setInput(""); clearImage();
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userContent = imageName
      ? `${trimmed}${trimmed ? "\n\n" : ""}[User attached image: ${imageName}]`
      : trimmed;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(), role: "user", content: userContent,
      imagePreview: imagePreview || undefined, imageName: imageName || undefined,
    };

    const currentMsgs = messagesRef.current;
    await runStream(currentMsgs, userMsg, null, [
      { role: "user", content: userContent, imagePreview, imageName },
    ]);
  }, [isStreaming, imagePreview, imageName, isRecording, liveTranscript, runStream]);

  // ── Regenerate last response ───────────────────────────────────────────────
  const regenerate = useCallback(async () => {
    if (isStreaming) return;
    const allMsgs = messagesRef.current.filter(m => m.id !== "welcome");
    const lastAIIdx = [...allMsgs].reverse().findIndex(m => m.role === "assistant");
    if (lastAIIdx === -1) return;
    const realLastAIIdx = allMsgs.length - 1 - lastAIIdx;
    const lastUserMsg = [...allMsgs].slice(0, realLastAIIdx).reverse().find(m => m.role === "user");
    if (!lastUserMsg) return;

    // Remove last AI message from state
    const newMsgs = allMsgs.slice(0, realLastAIIdx);
    setMessages(newMsgs);
    setSuggestions([]);

    // Remove from DB
    const convId = activeConvIdRef.current;
    if (convId) {
      await api.deleteWithQuery(`/conversations/${convId}/messages/tail`, "count=1").catch(() => {});
    }

    await runStream(newMsgs.slice(0, -1), lastUserMsg, convId, []);
  }, [isStreaming, runStream]);

  // ── Edit + resend user message ─────────────────────────────────────────────
  const startEdit = useCallback((msg: ChatMessage) => {
    setEditingId(msg.id);
    setEditText(msg.content.replace(/\n\n\[User attached image:[^\]]+\]/g, "").trim());
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditText("");
  }, []);

  const submitEdit = useCallback(async (msg: ChatMessage) => {
    if (isStreaming) return;
    const trimmed = editText.trim();
    if (!trimmed) return;

    const allMsgs = messagesRef.current.filter(m => m.id !== "welcome");
    const msgIdx = allMsgs.findIndex(m => m.id === msg.id);
    if (msgIdx === -1) return;

    // Slice history to just before this message
    const historyBefore = allMsgs.slice(0, msgIdx);
    const tailCount = allMsgs.length - msgIdx; // messages to delete from DB

    const newUserMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed };
    setMessages([...historyBefore, newUserMsg]);
    setEditingId(null);
    setSuggestions([]);

    // Delete tail from DB
    const convId = activeConvIdRef.current;
    if (convId && tailCount > 0) {
      await api.deleteWithQuery(`/conversations/${convId}/messages/tail`, `count=${tailCount}`).catch(() => {});
    }

    await runStream(historyBefore, newUserMsg, convId, [{ role: "user", content: trimmed }]);
  }, [isStreaming, editText, runStream]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const reset = () => {
    abortRef.current = true;
    if (isRecording) stopRecording();
    startNewConversation();
    setApiKeyMissing(false);
  };

  // ─── Derived ────────────────────────────────────────────────────────────
  const realMsgs = messages.filter(m => m.id !== "welcome");
  const lastAIMsg = [...realMsgs].reverse().find(m => m.role === "assistant");

  // ─── API key missing ─────────────────────────────────────────────────────
  if (apiKeyMissing) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-center px-8 max-w-xl mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-5">
          <Lock className="w-7 h-7 text-amber-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">AI Chat Requires an NVIDIA NIM API Key</h2>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          Add your{" "}
          <code className="text-primary font-mono text-xs px-1.5 py-0.5 rounded bg-primary/10">NVIDIA_NIM_API_KEY</code>{" "}
          to the Replit Secrets panel to enable AI chat.
        </p>
        <button onClick={reset} className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors">
          Try again
        </button>
      </div>
    );
  }

  // ─── Full layout ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-3.5rem)] -mx-6 -mt-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0" style={{ background: "oklch(5% 0 0)" }}>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className={cn("p-1.5 rounded-lg transition-colors", sidebarOpen ? "text-white bg-white/8" : "text-zinc-600 hover:text-white hover:bg-white/6")}
            title={sidebarOpen ? "Hide history" : "Show history"}
          >
            <PanelLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, hsl(348 83% 50% / 0.2), hsl(260 80% 60% / 0.15))", border: "1px solid hsl(348 83% 50% / 0.25)" }}>
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">RedForge AI</p>
              <p className="text-[10px] text-muted-foreground">Powered by NVIDIA NIM</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-lg border tracking-wider", riskBadge.color)}>{riskBadge.label}</span>
          {stats && (
            <div className="hidden lg:flex items-center gap-1.5">
              <span className="text-[10px] px-2 py-1 rounded-lg border border-white/8 text-zinc-400" style={{ background: "oklch(7% 0 0)" }}>{stats.totalProjects} projects</span>
              <span className="text-[10px] px-2 py-1 rounded-lg border border-white/8 text-zinc-400" style={{ background: "oklch(7% 0 0)" }}>{stats.openFindings} open</span>
              {stats.criticalFindings > 0 && (
                <span className="text-[10px] px-2 py-1 rounded-lg border border-red-500/20 text-red-400" style={{ background: "oklch(7% 0 0)" }}>{stats.criticalFindings} critical</span>
              )}
            </div>
          )}
          <button onClick={reset} title="New conversation" className="p-1.5 rounded-xl text-muted-foreground hover:text-white hover:bg-white/6 transition-colors border border-transparent hover:border-white/10">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Body: sidebar + chat ── */}
      <div className="flex flex-1 min-h-0">

        {/* Sidebar */}
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="shrink-0 border-r border-border overflow-hidden"
            >
              <ConversationSidebar
                conversations={conversations}
                activeId={activeConvId}
                onSelect={loadConversation}
                onNew={startNewConversation}
                onDelete={deleteConversation}
                onRename={renameConversation}
                loading={convLoading}
              />
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main chat column */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-5 scrollbar-hide">
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => {
                const isLastMsg = idx === messages.length - 1;
                const isLastAI = msg.role === "assistant" && msg.id === lastAIMsg?.id;
                const isEditing = editingId === msg.id;

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className={cn("flex gap-3 max-w-3xl group", msg.role === "user" ? "ml-auto flex-row-reverse" : "")}
                  >
                    <div
                      className={cn("w-8 h-8 rounded-xl shrink-0 flex items-center justify-center mt-0.5",
                        msg.role === "assistant" ? "border border-primary/20" : "border border-white/10")}
                      style={{ background: msg.role === "assistant" ? "linear-gradient(135deg, hsl(348 83% 50% / 0.15), hsl(260 80% 60% / 0.1))" : "oklch(10% 0 0)" }}>
                      {msg.role === "assistant" ? <Bot className="w-4 h-4 text-primary" /> : <User className="w-4 h-4 text-zinc-300" />}
                    </div>

                    <div className={cn("flex flex-col max-w-[85%] min-w-0", msg.role === "user" ? "items-end" : "items-start")}>
                      {/* Bubble */}
                      <div
                        className={cn("rounded-2xl px-4 py-3 w-full", msg.role === "user" ? "rounded-tr-sm" : "rounded-tl-sm")}
                        style={{
                          background: msg.role === "user"
                            ? "linear-gradient(135deg, hsl(348 83% 50% / 0.2), hsl(348 83% 50% / 0.1))"
                            : "oklch(7% 0 0)",
                          border: msg.role === "user"
                            ? "1px solid hsl(348 83% 50% / 0.25)"
                            : "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        {msg.role === "user" ? (
                          <div>
                            {msg.imagePreview && (
                              <div className="mb-2">
                                <img src={msg.imagePreview} alt={msg.imageName || "Attached"} className="max-w-[200px] max-h-[140px] rounded-lg object-cover border border-white/10" />
                                <p className="text-[10px] text-zinc-400 mt-1 flex items-center gap-1"><ImageIcon className="w-3 h-3" />{msg.imageName}</p>
                              </div>
                            )}
                            {isEditing ? (
                              <div className="flex flex-col gap-2">
                                <textarea
                                  value={editText}
                                  onChange={e => setEditText(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitEdit(msg); }
                                    if (e.key === "Escape") cancelEdit();
                                  }}
                                  autoFocus
                                  rows={3}
                                  className="w-full bg-white/8 text-white text-sm rounded-lg px-3 py-2 border border-primary/30 outline-none resize-none leading-relaxed"
                                />
                                <div className="flex gap-2 justify-end">
                                  <button onClick={cancelEdit} className="px-3 py-1 rounded-lg text-xs text-zinc-400 hover:text-white border border-white/10 hover:bg-white/6 transition-all">
                                    Cancel
                                  </button>
                                  <button onClick={() => submitEdit(msg)} disabled={!editText.trim() || isStreaming}
                                    className="px-3 py-1 rounded-lg text-xs bg-primary text-white hover:bg-primary/90 transition-all disabled:opacity-40 flex items-center gap-1">
                                    <Send className="w-3 h-3" /> Resend
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm leading-relaxed text-white whitespace-pre-wrap">
                                {msg.content.replace(/\n\n\[User attached image:[^\]]+\]/g, "")}
                              </p>
                            )}
                          </div>
                        ) : (
                          <>
                            {msg.content ? <MarkdownMessage content={msg.content} /> : <ThinkingDots />}
                            {msg.streaming && msg.content && <TypingCursor />}
                          </>
                        )}
                      </div>

                      {/* User message edit button */}
                      {msg.role === "user" && !isEditing && msg.id !== "welcome" && (
                        <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                          <button
                            onClick={() => startEdit(msg)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] text-zinc-600 hover:text-zinc-300 hover:bg-white/6 transition-all"
                            title="Edit and resend"
                          >
                            <Pencil className="w-3 h-3" /><span>Edit</span>
                          </button>
                        </div>
                      )}

                                      {/* AI message actions */}
                      {msg.role === "assistant" && !msg.streaming && msg.id !== "welcome" && (
                        <div className="w-full">
                          <MessageActions
                            msg={msg}
                            feedback={feedback[msg.id] ?? null}
                            onFeedback={f => setFeedback(prev => ({ ...prev, [msg.id]: f }))}
                            isLast={isLastAI}
                            isStreaming={isStreaming}
                          />
                          {/* Standalone regenerate button — always visible for last AI message */}
                          {isLastAI && (
                            <motion.button
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              onClick={regenerate}
                              disabled={isStreaming}
                              className="mt-1.5 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium text-violet-400 border border-violet-500/20 hover:bg-violet-500/10 hover:border-violet-500/35 transition-all disabled:opacity-30"
                              style={{ background: "oklch(7% 0 0)" }}
                              title="Get a different response"
                            >
                              <RefreshCw className="w-3 h-3" />
                              Regenerate response
                            </motion.button>
                          )}
                          {/* Follow-up suggestions — only for the last AI message */}
                          {isLastAI && suggestionsForId === msg.id && (
                            <FollowUpChips
                              suggestions={suggestions}
                              onSelect={q => sendMessage(q)}
                              isStreaming={isStreaming}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Live transcript */}
            {isRecording && liveTranscript && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 max-w-3xl ml-auto flex-row-reverse">
                <div className="w-8 h-8 rounded-xl shrink-0 border border-white/10 flex items-center justify-center" style={{ background: "oklch(10% 0 0)" }}>
                  <User className="w-4 h-4 text-zinc-300" />
                </div>
                <div className="rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] border border-primary/15" style={{ background: "hsl(348 83% 50% / 0.06)" }}>
                  <p className="text-sm text-zinc-400 italic">{liveTranscript}</p>
                </div>
              </motion.div>
            )}
          </div>

          {/* Quick prompts */}
          <div className="px-4 md:px-8 pb-2 shrink-0">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {QUICK_PROMPTS.map(p => (
                <button key={p.label} onClick={() => sendMessage(p.q)} disabled={isStreaming || isRecording}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/8 text-xs text-zinc-400 hover:text-white hover:border-white/20 transition-all whitespace-nowrap shrink-0 disabled:opacity-40"
                  style={{ background: "oklch(7% 0 0)" }}>
                  <p.icon className={cn("w-3 h-3 shrink-0", p.color)} />{p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="px-4 md:px-8 pb-5 shrink-0">
            <AnimatePresence>
              {imagePreview && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-2 flex items-center gap-2">
                  <div className="relative inline-block">
                    <img src={imagePreview} alt={imageName || "Preview"} className="h-16 w-auto rounded-xl object-cover border border-white/10" />
                    <button onClick={clearImage} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-zinc-800 border border-white/15 flex items-center justify-center hover:bg-zinc-700 transition-colors">
                      <X className="w-2.5 h-2.5 text-white" />
                    </button>
                  </div>
                  <div className="text-xs text-zinc-500">
                    <p className="text-zinc-300 font-medium truncate max-w-[180px]">{imageName}</p>
                    <p>Image attached</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div
              className={cn("flex items-end gap-2 rounded-2xl border px-3 py-3 transition-all",
                isRecording ? "border-primary/40 shadow-[0_0_16px_hsl(348_83%_50%_/_0.12)]" : "focus-within:border-primary/30")}
              style={{ background: "oklch(6% 0 0)", borderColor: isRecording ? undefined : "rgba(255,255,255,0.08)" }}
            >
              <button onClick={() => fileInputRef.current?.click()} disabled={isStreaming}
                className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/6 transition-all shrink-0 disabled:opacity-30" title="Attach image">
                <Paperclip className="w-4 h-4" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />

              <div className="flex-1 flex flex-col min-w-0">
                {isRecording ? (
                  <div className="flex flex-col gap-1 py-0.5">
                    <MicWaveform isRecording={isRecording} />
                    <p className="text-[10px] text-primary/70 font-mono">
                      Listening… tap stop when done
                      {liveTranscript && <span className="text-zinc-500"> · "{liveTranscript.slice(0, 40)}{liveTranscript.length > 40 ? "…" : ""}"</span>}
                    </p>
                  </div>
                ) : (
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Ask anything about your security posture, findings, or remediation…"
                    rows={1}
                    disabled={isStreaming}
                    className="bg-transparent text-sm text-white placeholder:text-zinc-600 resize-none outline-none leading-relaxed max-h-40 disabled:opacity-50 w-full"
                    style={{ scrollbarWidth: "none" }}
                  />
                )}
              </div>

              {micSupported && (
                <motion.button onClick={toggleMic} disabled={isStreaming} whileTap={{ scale: 0.9 }}
                  title={isRecording ? "Stop recording" : "Start voice input"}
                  className={cn("p-1.5 rounded-lg transition-all shrink-0 disabled:opacity-30 relative",
                    isRecording ? "text-primary" : "text-zinc-600 hover:text-zinc-300 hover:bg-white/6")}>
                  {isRecording ? (
                    <>
                      <motion.span className="absolute inset-0 rounded-lg bg-primary/15"
                        animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1, repeat: Infinity }} />
                      <MicOff className="w-4 h-4 relative z-10" />
                    </>
                  ) : <Mic className="w-4 h-4" />}
                </motion.button>
              )}

              <motion.button
                onClick={() => isRecording ? stopRecording() : sendMessage(input)}
                disabled={(!input.trim() && !imagePreview && !isRecording) || isStreaming}
                whileTap={{ scale: 0.92 }}
                className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all",
                  (input.trim() || imagePreview || isRecording) && !isStreaming
                    ? "bg-primary text-white shadow-[0_0_14px_hsl(348_83%_50%_/_0.35)] hover:bg-primary/90"
                    : "bg-white/6 text-zinc-600 cursor-not-allowed")}>
                {isStreaming
                  ? <motion.div className="w-3 h-3 rounded-full bg-primary" animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
                  : <Send className="w-3.5 h-3.5" />}
              </motion.button>
            </div>
            <p className="text-center text-[10px] text-zinc-700 mt-2">
              Enter to send · Shift+Enter for new line · Hover message to edit or regenerate
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
