import { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import { motion, AnimatePresence, LazyMotion, domAnimation } from "framer-motion";
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

// --- Types ---
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
  updated_at: string;
}

interface Feedback {
  rating: "up" | "down" | null;
  comment?: string;
}

// --- API ---
const api = {
  get: async (url: string) => {
    const r = await fetch(`${BASE}/api${url}`);
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  post: async (url: string, body: any) => {
    const r = await fetch(`${BASE}/api${url}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  patch: async (url: string, body: any) => {
    const r = await fetch(`${BASE}/api${url}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  delete: async (url: string) => {
    const r = await fetch(`${BASE}/api${url}`, { method: "DELETE" });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  deleteWithQuery: async (url: string, query: string) => {
    const r = await fetch(`${BASE}/api${url}?${query}`, { method: "DELETE" });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }
};

const streamChat = async (
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  onFinish: () => void,
  onError: (err: string) => void
) => {
  try {
    const r = await fetch(`${BASE}/api/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messages.map(m => ({ role: m.role, content: m.content })) }),
    });
    if (!r.ok) {
      const txt = await r.text();
      if (txt.includes("AI_KEY_MISSING")) return onError("AI_KEY_MISSING");
      throw new Error(txt);
    }
    const reader = r.body?.getReader();
    if (!reader) throw new Error("No reader");
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      onChunk(decoder.decode(value));
    }
    onFinish();
  } catch (e: any) { onError(e.message); }
};

const WELCOME: ChatMessage = {
  id: "welcome", role: "assistant",
  content: "### Welcome to Obsidian Sentinel AI\nI'm your advanced security orchestration partner. I can help you analyze vulnerabilities, remediate code, and manage your infrastructure security.\n\n**How can I assist you today?**",
};

// --- Waveform ---
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
          style={{ 
            width: 3, 
            backgroundColor: i % 3 === 0 ? "hsl(348 83% 55%)" : i % 3 === 1 ? "hsl(348 83% 45%)" : "hsl(348 83% 35%)",
            willChange: "height" 
          }}
          animate={{ height: isRecording ? [bar.h1, bar.h2, bar.h3, bar.h4, bar.h1] : 4 }}
          transition={{ duration: 0.6, repeat: isRecording ? Infinity : 0, delay: bar.delay, repeatType: "reverse", ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

// --- Message Item ---
const MessageItem = memo(({ msg, isLast, feedback, onRate, onRegenerate, onEdit }: any) => {
  const isAI = msg.role === "assistant";
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className={cn("group w-full flex gap-4 p-4 rounded-xl transition-all", isAI ? "bg-white/[0.02]" : "bg-transparent")}>
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
        isAI ? "bg-primary/10 border-primary/20 text-primary" : "bg-white/5 border-white/10 text-zinc-400")}>
        {isAI ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {isAI ? "Obsidian Sentinel" : "Security Analyst"}
          </span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {!isAI && (
              <button onClick={() => onEdit(msg)} className="p-1.5 hover:bg-white/5 rounded-md text-zinc-500 hover:text-zinc-300 transition-colors">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={copy} className="p-1.5 hover:bg-white/5 rounded-md text-zinc-500 hover:text-zinc-300 transition-colors">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="prose prose-invert max-w-none text-zinc-300 prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10 prose-sm">
          {msg.content}
        </div>

        {msg.imagePreview && (
          <div className="mt-3 relative inline-block group/img">
            <img src={msg.imagePreview} alt="attachment" className="max-w-md max-h-[300px] rounded-lg border border-white/10 object-cover shadow-2xl" />
          </div>
        )}

        {isAI && !msg.streaming && msg.id !== "welcome" && (
          <div className="pt-4 flex items-center justify-between border-t border-white/[0.05]">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <button onClick={() => onRate(msg.id, "up")} 
                  className={cn("p-1.5 rounded-md transition-colors", feedback?.rating === "up" ? "text-primary bg-primary/10" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5")}>
                  <ThumbsUp className="w-4 h-4" />
                </button>
                <button onClick={() => onRate(msg.id, "down")}
                  className={cn("p-1.5 rounded-md transition-colors", feedback?.rating === "down" ? "text-red-400 bg-red-400/10" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5")}>
                  <ThumbsDown className="w-4 h-4" />
                </button>
              </div>
              {isLast && (
                <button onClick={onRegenerate} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-primary transition-colors">
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Regenerate</span>
                </button>
              )}
            </div>
            <button className="text-zinc-500 hover:text-zinc-300 p-1.5 hover:bg-white/5 rounded-md transition-colors">
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
});

// --- Sidebar ---
const ConversationSidebar = memo(({ 
  conversations, activeConvId, onSelect, onNew, onDelete, onRename, isOpen, onToggle 
}: any) => {
  const [search, setSearch] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");

  const filtered = conversations.filter((c: any) => c.title.toLowerCase().includes(search.toLowerCase()));
  const groups = useMemo(() => {
    const g: Record<string, any[]> = { Today: [], Yesterday: [], Previous: [] };
    const now = new Date();
    filtered.forEach((c: any) => {
      const d = new Date(c.updated_at);
      const diff = (now.getTime() - d.getTime()) / (1000 * 3600 * 24);
      if (diff < 1) g.Today.push(c);
      else if (diff < 2) g.Yesterday.push(c);
      else g.Previous.push(c);
    });
    return g;
  }, [filtered]);

  const handleRename = (id: string, currentTitle: string) => {
    setRenamingId(id);
    setRenameText(currentTitle);
  };

  const submitRename = () => {
    if (renamingId && renameText.trim()) {
      onRename(renamingId, renameText.trim());
      setRenamingId(null);
    }
  };

  return (
    <motion.aside initial={false} animate={{ width: isOpen ? 280 : 0, opacity: isOpen ? 1 : 0 }}
      className="h-full border-r border-white/5 bg-black/40 backdrop-blur-xl flex flex-col overflow-hidden relative z-40">
      <div className="p-4 flex items-center justify-between gap-3 border-b border-white/5">
        <div className="flex items-center gap-2 text-primary">
          <Shield className="w-6 h-6" />
          <span className="font-bold tracking-tight text-white">RED<span className="text-primary">FORGE</span></span>
        </div>
        <button onClick={onToggle} className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-white transition-colors">
          <PanelLeft className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <button onClick={onNew} 
          className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary/90 text-white font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/10 group active:scale-95">
          <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
          <span>New Thread</span>
        </button>
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-primary transition-colors" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search findings..."
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-6 custom-scrollbar pb-10">
        {Object.entries(groups).map(([name, items]) => items.length > 0 && (
          <div key={name} className="space-y-1">
            <h3 className="px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500/80 mb-2">{name}</h3>
            {items.map((conv: any) => (
              <div key={conv.id} onMouseEnter={() => setHovered(conv.id)} onMouseLeave={() => setHovered(null)}
                className={cn("group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer",
                  activeConvId === conv.id ? "bg-white/10 text-white shadow-lg" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200")}>
                <div onClick={() => onSelect(conv.id)} className="flex-1 min-w-0 flex items-center gap-3">
                  <MessageSquare className={cn("w-4 h-4 shrink-0", activeConvId === conv.id ? "text-primary" : "text-zinc-500")} />
                  {renamingId === conv.id ? (
                    <input autoFocus value={renameText} onChange={e => setRenameText(e.target.value)} onBlur={submitRename} onKeyDown={e => e.key === "Enter" && submitRename()}
                      className="flex-1 bg-white/10 border-none p-0 text-sm focus:ring-0 text-white" />
                  ) : (
                    <span className="truncate text-sm font-medium">{conv.title}</span>
                  )}
                </div>
                <AnimatePresence>
                  {hovered === conv.id && renamingId !== conv.id && (
                    <motion.div initial={{ opacity: 0, x: 5 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 5 }} className="flex items-center gap-1">
                      <button onClick={() => handleRename(conv.id, conv.title)} className="p-1 hover:text-white transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => onDelete(conv.id)} className="p-1 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-white/5 bg-black/20 mt-auto">
        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white tracking-tight">Obsidian v2.4.0</p>
            <p className="text-[10px] text-zinc-500 truncate">Enterprise Security AI</p>
          </div>
          <Zap className="w-3.5 h-3.5 text-zinc-700 group-hover:text-amber-500 transition-colors" />
        </div>
      </div>
    </motion.aside>
  );
});

// --- Main Chat ---
export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsForId, setSuggestionsForId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [convLoading, setConvLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<boolean>(false);
  const recognitionRef = useRef<any>(null);
  const activeConvIdRef = useRef<string | null>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);

  const [isRecording, setIsRecording] = useState(false);
  const [micSupported, setMicSupported] = useState(true);
  const [liveTranscript, setLiveTranscript] = useState("");

  const { data: rawFindings } = useListFindings({} as any);
  const findings = Array.isArray(rawFindings) ? rawFindings : (rawFindings as any)?.findings ?? [];
  const criticalCount = findings.filter((f: any) => f.severity === "CRITICAL").length;
  const highCount = findings.filter((f: any) => f.severity === "HIGH").length;
  const openCount = findings.filter((f: any) => f.status === "OPEN" || f.status === "IN_PROGRESS").length;

  const riskBadge = criticalCount > 0
    ? { label: "CRITICAL RISK", color: "text-red-400 bg-red-500/10 border-red-500/20" }
    : highCount > 2
    ? { label: "HIGH RISK", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" }
    : openCount > 0
    ? { label: "MEDIUM RISK", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" }
    : { label: "LOW RISK", color: "text-green-400 bg-green-500/10 border-green-500/20" };

  // Sync refs
  useEffect(() => { activeConvIdRef.current = activeConvId; }, [activeConvId]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Image Upload
  const clearImage = useCallback(() => { setImagePreview(null); setImageName(null); }, []);
  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { setImagePreview(ev.target?.result as string); setImageName(file.name); };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  // Suggestions
  const fetchSuggestions = useCallback(async (aiMsgId: string, content: string) => {
    setSuggestions([]);
    setSuggestionsForId(aiMsgId);
    const data = await api.post("/followups", { lastResponse: content, topic: "security" }).catch(() => ({ suggestions: [] }));
    if (Array.isArray(data?.suggestions)) setSuggestions(data.suggestions);
  }, []);

  // Mic logic
  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setLiveTranscript("");
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const startRecording = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Mic not supported"); return; }
    const rec = new SR();
    rec.continuous = true; rec.interimResults = true; rec.lang = "en-US";
    rec.onresult = (e: any) => {
      const t = Array.from(e.results as any[]).map((r: any) => r[0].transcript).join(" ");
      setLiveTranscript(t);
    };
    rec.onerror = () => { toast.error("Mic error"); stopRecording(); };
    rec.onend = () => { if (recognitionRef.current) try { recognitionRef.current.start(); } catch { } };
    rec.start();
    recognitionRef.current = rec;
    setIsRecording(true);
    setLiveTranscript("");
  }, [stopRecording]);

  const toggleMic = useCallback(() => isRecording ? stopRecording() : startRecording(), [isRecording, stopRecording, startRecording]);

  // Streaming Engine
  const runStream = useCallback(async (hist: ChatMessage[], userMsg: ChatMessage, convId: string | null, dbMsgs: any[]) => {
    const aiId = crypto.randomUUID();
    const aiMsg: ChatMessage = { id: aiId, role: "assistant", content: "", streaming: true };

    setSuggestions([]);
    setSuggestionsForId(null);
    setMessages(prev => {
      const filtered = prev.filter(m => m.id !== "welcome" && m.id !== aiId);
      const hasUser = filtered.some(m => m.id === userMsg.id);
      return [...(hasUser ? filtered : [...filtered, userMsg]), aiMsg];
    });
    setIsStreaming(true);
    abortRef.current = false;

    let cid = convId || activeConvIdRef.current;
    if (!cid) {
      const title = userMsg.content.slice(0, 50).trim() || "New Chat";
      const newConv = await api.post("/conversations", { title });
      if (newConv?.id) { cid = newConv.id; setActiveConvId(cid); setConversations(prev => [newConv, ...prev]); }
    }
    if (cid && dbMsgs.length > 0) api.post(`/conversations/${cid}/messages`, { messages: dbMsgs }).catch(() => {});

    let full = "";
    let rafScheduled = false;
    const flush = () => {
      setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: full } : m));
      rafScheduled = false;
    };

    await streamChat(
      [...hist.filter(m => m.id !== "welcome"), userMsg],
      (chunk) => {
        if (abortRef.current) return;
        full += chunk;
        if (!rafScheduled) { rafScheduled = true; requestAnimationFrame(flush); }
      },
      async () => {
        setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: full, streaming: false } : m));
        setIsStreaming(false);
        if (cid && full) {
          await api.post(`/conversations/${cid}/messages`, { messages: [{ role: "assistant", content: full }] }).catch(() => {});
          api.get("/conversations").then(d => Array.isArray(d) && setConversations(d)).catch(() => {});
          fetchSuggestions(aiId, full);
        }
      },
      (err) => {
        if (err === "AI_KEY_MISSING") setApiKeyMissing(true);
        else setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: `Error: ${err}`, streaming: false } : m));
        setIsStreaming(false);
      }
    );
  }, [fetchSuggestions]);

  const sendMessage = useCallback(async (text: string) => {
    const t = text.trim();
    if (!t && !imagePreview) return;
    if (isStreaming) return;
    if (isRecording) stopRecording();

    const userContent = imageName ? `${t}\n\n[User attached image: ${imageName}]` : t;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: userContent, imagePreview: imagePreview || undefined, imageName: imageName || undefined };

    setInput(""); clearImage();
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    await runStream(messagesRef.current, userMsg, null, [{ role: "user", content: userContent, imagePreview, imageName }]);
  }, [isStreaming, imagePreview, imageName, isRecording, stopRecording, runStream, clearImage]);

  // Silence Detection
  useEffect(() => {
    if (!liveTranscript || !isRecording) return;
    const timer = setTimeout(() => {
      const t = liveTranscript.trim();
      if (t) { stopRecording(); sendMessage(t); }
    }, 2000);
    return () => clearTimeout(timer);
  }, [liveTranscript, isRecording, stopRecording, sendMessage]);

  const startNewConversation = useCallback(() => {
    setActiveConvId(null); setMessages([WELCOME]); setSuggestions([]); setInput(""); clearImage();
    abortRef.current = true; setIsStreaming(false);
  }, [clearImage]);

  const loadConversation = useCallback(async (id: string) => {
    setActiveConvId(id); setMessages([]); setSuggestions([]);
    const d = await api.get(`/conversations/${id}/messages`);
    if (Array.isArray(d) && d.length > 0) {
      const msgs = d.map((m: any) => ({ id: m.id, role: m.role, content: m.content, imagePreview: m.imagePreview, imageName: m.imageName }));
      setMessages(msgs);
      const lastAI = [...msgs].reverse().find(m => m.role === "assistant");
      if (lastAI) fetchSuggestions(lastAI.id, lastAI.content);
    } else setMessages([WELCOME]);
  }, [fetchSuggestions]);

  const deleteConversation = useCallback(async (id: string) => {
    await api.delete(`/conversations/${id}`);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvIdRef.current === id) startNewConversation();
    toast.success("Deleted");
  }, [startNewConversation]);

  const renameConversation = useCallback(async (id: string, title: string) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c));
    await api.patch(`/conversations/${id}`, { title }).catch(() => {});
  }, []);

  const regenerate = useCallback(async () => {
    if (isStreaming) return;
    const msgs = messagesRef.current.filter(m => m.id !== "welcome");
    const lastAIIdx = [...msgs].reverse().findIndex(m => m.role === "assistant");
    if (lastAIIdx === -1) return;
    const realIdx = msgs.length - 1 - lastAIIdx;
    const lastUser = [...msgs].slice(0, realIdx).reverse().find(m => m.role === "user");
    if (!lastUser) return;
    const newMsgs = msgs.slice(0, realIdx);
    setMessages(newMsgs);
    const convId = activeConvIdRef.current;
    if (convId) await api.deleteWithQuery(`/conversations/${convId}/messages/tail`, "count=1").catch(() => {});
    await runStream(newMsgs.slice(0, -1), lastUser, convId, []);
  }, [isStreaming, runStream]);

  const startEdit = useCallback((msg: ChatMessage) => { setEditingId(msg.id); setEditText(msg.content.trim()); }, []);
  const cancelEdit = useCallback(() => { setEditingId(null); setEditText(""); }, []);
  const submitEdit = useCallback(async (msg: ChatMessage) => {
    if (isStreaming) return;
    const t = editText.trim(); if (!t) return;
    const msgs = messagesRef.current.filter(m => m.id !== "welcome");
    const idx = msgs.findIndex(m => m.id === msg.id);
    if (idx === -1) return;
    const hist = msgs.slice(0, idx);
    const newUserMsg = { ...msg, content: t };
    setMessages([...hist, newUserMsg]); setEditingId(null);
    const convId = activeConvIdRef.current;
    if (convId) await api.deleteWithQuery(`/conversations/${convId}/messages/tail`, `count=${msgs.length - idx}`).catch(() => {});
    await runStream(hist, newUserMsg, convId, [{ role: "user", content: t }]);
  }, [isStreaming, editText, runStream]);

  const handleKey = (e: any) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } };

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) setMicSupported(false);
    api.get("/conversations").then(d => Array.isArray(d) && setConversations(d)).finally(() => setConvLoading(false));
  }, []);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, liveTranscript, suggestions]);
  useEffect(() => { if (textareaRef.current) { textareaRef.current.style.height = "auto"; textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`; } }, [input]);

  const realMsgs = messages.filter(m => m.id !== "welcome");
  const lastAIMsg = [...realMsgs].reverse().find(m => m.role === "assistant");

  return (
    <div className="flex h-screen bg-[#050505] text-zinc-300 font-sans selection:bg-primary/30 overflow-hidden">
      <ConversationSidebar conversations={conversations} activeConvId={activeConvId} onSelect={loadConversation} onNew={startNewConversation} onDelete={deleteConversation} onRename={renameConversation} isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <main className="flex-1 flex flex-col min-w-0 relative h-full">
        <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-black/40 backdrop-blur-xl shrink-0 z-30">
          <div className="flex items-center gap-4">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-white transition-colors">
                <PanelLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-white tracking-tight">Security Orchestration Hub</h1>
                <div className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold border", riskBadge.color)}>
                  {riskBadge.label}
                </div>
              </div>
              <p className="text-[10px] text-zinc-500 font-medium">Groq Engine Active</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] border border-white/5 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">System Optimal</span>
            </div>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar relative">
          <div className="max-w-4xl mx-auto py-8 px-6 space-y-6">
            {messages.map((msg, i) => (
              <MessageItem key={msg.id} msg={msg} isLast={i === messages.length - 1} feedback={feedback[msg.id]} onRate={(id: string, r: string) => setFeedback(prev => ({ ...prev, [id]: { rating: r as any } }))} onRegenerate={regenerate} onEdit={startEdit} />
            ))}
            
            {isStreaming && (
              <div className="flex gap-4 p-4 animate-pulse">
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-2 bg-white/5 rounded w-3/4" />
                  <div className="h-2 bg-white/5 rounded w-1/2" />
                </div>
              </div>
            )}

            {liveTranscript && (
              <div className="flex gap-4 p-4 bg-white/[0.02] rounded-xl border border-white/5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                  <Mic className="w-5 h-5 animate-pulse" />
                </div>
                <div className="flex-1">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest block mb-2">Live Voice Transcript</span>
                  <p className="text-zinc-400 italic text-sm">{liveTranscript}</p>
                </div>
              </div>
            )}

            {suggestions.length > 0 && !isStreaming && (
              <div className="pt-6 space-y-4 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center gap-2 text-zinc-500 px-2">
                  <Lightbulb className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Suggested Analysis</span>
                </div>
                <div className="flex flex-wrap gap-2 px-1">
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => sendMessage(s)} className="px-4 py-2 bg-white/[0.03] hover:bg-primary/10 border border-white/5 hover:border-primary/20 rounded-xl text-sm text-zinc-400 hover:text-primary transition-all active:scale-95">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 shrink-0 z-30">
          <div className="max-w-4xl mx-auto relative">
            {apiKeyMissing && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <p className="text-sm text-amber-200">
                  <span className="font-bold">Groq API Key missing.</span> Please add it to your <code className="bg-black/40 px-1.5 py-0.5 rounded text-amber-500">.env</code> file.
                </p>
              </motion.div>
            )}

            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-2 focus-within:border-primary/30 focus-within:ring-4 focus-within:ring-primary/5 transition-all relative shadow-2xl">
              <div className="flex flex-col gap-2">
                {imagePreview && (
                  <div className="px-3 pt-2">
                    <div className="relative inline-block group/img">
                      <img src={imagePreview} alt="upload" className="h-20 w-auto rounded-lg border border-white/10 object-cover" />
                      <button onClick={clearImage} className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="flex items-end gap-2 px-2">
                  <button onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-white/5 rounded-xl text-zinc-500 hover:text-zinc-300 transition-colors shrink-0 mb-1">
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleImageChange} className="hidden" accept="image/*" />
                  
                  <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} placeholder="Ask Obsidian anything about security..." className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder:text-zinc-600 py-3 text-sm resize-none max-h-40 min-h-[44px] custom-scrollbar" />

                  <div className="flex items-center gap-1.5 mb-1.5">
                    {isRecording && <MicWaveform isRecording={isRecording} />}
                    {micSupported && (
                      <button onClick={toggleMic} className={cn("p-2 rounded-xl transition-all relative shrink-0", isRecording ? "text-primary bg-primary/10" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5")}>
                        {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                      </button>
                    )}
                    <button onClick={() => sendMessage(input)} disabled={isStreaming || (!input.trim() && !imagePreview)} className="p-2 bg-primary hover:bg-primary/90 text-white rounded-xl disabled:opacity-20 disabled:grayscale transition-all active:scale-95 shrink-0">
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-3 flex items-center justify-between px-2">
              <div className="flex items-center gap-4 text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3 h-3" />
                  <span>Groq Llama-3-70b</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Terminal className="w-3 h-3" />
                  <span>v2.4.0-sentinel</span>
                </div>
              </div>
              <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                Protected by Obsidian RLS
              </p>
            </div>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {editingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-2xl bg-zinc-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Edit Message</h3>
                <button onClick={cancelEdit} className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <textarea autoFocus value={editText} onChange={e => setEditText(e.target.value)} className="w-full h-40 bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-primary/50 transition-all resize-none mb-6" />
              <div className="flex justify-end gap-3">
                <button onClick={cancelEdit} className="px-6 py-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all">Cancel</button>
                <button onClick={() => { const m = messages.find(msg => msg.id === editingId); if (m) submitEdit(m); }} className="px-8 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary/20">Resend & Regenerate</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
