import { useState, useRef, useEffect, Component, type ReactNode } from "react";
import { Link } from "wouter";
import { motion, useInView, AnimatePresence, useAnimation } from "framer-motion";
import Dither from "@/components/Dither/Dither";
import GlobeCanvas from "@/components/landing/GlobeCanvas";
import MatrixBackground from "@/components/landing/MatrixBackground";
import {
  Shield, Cpu, Zap, ArrowRight, ChevronRight,
  Check, X, GitBranch,
  Slack, Bell, Code2, Sparkles,
  ShieldCheck, Eye, BarChart3, Webhook, Database,
} from "lucide-react";
import UnicornScene from "unicornstudio-react";
import BorderGlow from "@/components/BorderGlow/BorderGlow";
import MagneticTextFooter from "@/components/landing/MagneticTextFooter";

class DitherBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 }
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } }
};

function useScrollInView(threshold = 0.15) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "0px 0px -60px 0px", amount: threshold });
  return { ref, isInView };
}

function AnimatedSection({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const { ref, isInView } = useScrollInView();
  return (
    <motion.div
      ref={ref}
      variants={stagger}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

function SectionBadge({ color = "green", children }: { color?: "green" | "red" | "orange"; children: React.ReactNode }) {
  const colors = {
    green: "border-emerald-500/40 text-emerald-400",
    red: "border-primary/40 text-primary",
    orange: "border-amber-500/40 text-amber-400",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 border text-[11px] font-bold tracking-[0.18em] uppercase font-mono ${colors[color]}`}>
      [ {children} ]
    </span>
  );
}

function TerminalWindow({ lines, title = "bash" }: { lines: { text: string; color?: string }[]; title?: string }) {
  const [shown, setShown] = useState(0);
  const { ref, isInView } = useScrollInView(0.2);

  useEffect(() => {
    if (!isInView) return;
    const id = setInterval(() => {
      setShown(s => {
        if (s >= lines.length) { clearInterval(id); return s; }
        return s + 1;
      });
    }, 350);
    return () => clearInterval(id);
  }, [isInView, lines.length]);

  return (
    <div ref={ref} className="rounded-xl border border-white/10 overflow-hidden font-mono text-xs" style={{ background: "oklch(9% 0 0)" }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8" style={{ background: "oklch(11% 0 0)" }}>
        <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-2 text-zinc-500 text-[10px]">{title}</span>
      </div>
      <div className="p-4 space-y-1.5 min-h-[140px]">
        {lines.slice(0, shown).map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.15 }}
            className={`leading-relaxed ${line.color || "text-zinc-300"}`}
          >
            {line.text}
          </motion.div>
        ))}
        {shown < lines.length && shown > 0 && (
          <span className="inline-block w-1.5 h-3.5 bg-emerald-400 animate-pulse" />
        )}
      </div>
    </div>
  );
}

const PLANS = [
  {
    id: "free",
    name: "Starter",
    badge: null,
    monthlyPrice: 0,
    annualPrice: 0,
    description: "Perfect for individual developers and small projects.",
    cta: "Get Started Free",
    ctaLink: "/signup",
    ctaVariant: "secondary",
    features: [
      { text: "3 scan targets", included: true },
      { text: "50 scans / month", included: true },
      { text: "Basic vulnerability detection", included: true },
      { text: "OWASP Top 10 coverage", included: true },
      { text: "7-day finding history", included: true },
      { text: "AI fix generation", included: false },
      { text: "Slack notifications", included: false },
      { text: "CI/CD API access", included: false },
      { text: "Custom scan policies", included: false },
      { text: "Priority support", included: false },
    ]
  },
  {
    id: "pro",
    name: "Pro",
    badge: "Most Popular",
    monthlyPrice: 79,
    annualPrice: 63,
    description: "For security-conscious teams shipping fast.",
    cta: "Start 14-Day Trial",
    ctaLink: "/signup",
    ctaVariant: "primary",
    features: [
      { text: "Unlimited scan targets", included: true },
      { text: "Unlimited scans", included: true },
      { text: "Advanced AI vulnerability engine", included: true },
      { text: "Full OWASP + SANS coverage", included: true },
      { text: "90-day finding history", included: true },
      { text: "AI fix generation + patches", included: true },
      { text: "Slack & email alerts", included: true },
      { text: "CI/CD API access", included: true },
      { text: "Custom scan policies", included: false },
      { text: "Priority support", included: false },
    ]
  },
  {
    id: "enterprise",
    name: "Enterprise",
    badge: null,
    monthlyPrice: null,
    annualPrice: null,
    description: "Dedicated infrastructure, custom SLAs, and white-glove onboarding.",
    cta: "Contact Sales",
    ctaLink: "mailto:try.prit24@gmail.com",
    ctaVariant: "secondary",
    features: [
      { text: "Everything in Pro", included: true },
      { text: "Custom scan policies", included: true },
      { text: "On-premise deployment", included: true },
      { text: "SOC2 / HIPAA reports", included: true },
      { text: "Unlimited history retention", included: true },
      { text: "SSO / SAML", included: true },
      { text: "Dedicated Slack channel", included: true },
      { text: "Custom integrations", included: true },
      { text: "SLA guarantees", included: true },
      { text: "24/7 priority support", included: true },
    ]
  }
];

const FEATURES = [
  {
    icon: Cpu,
    title: "AI-Powered Engine",
    description: "Our models understand application logic to find complex chained vulnerabilities that static scanners miss entirely.",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20"
  },
  {
    icon: Shield,
    title: "Continuous Defense",
    description: "Trigger scans on every commit. RedForge acts as your automated red team that never sleeps, never tires.",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20"
  },
  {
    icon: Zap,
    title: "Auto-Generated Patches",
    description: "Don't just find bugs — get production-ready patches with exact remediation steps instantly generated.",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20"
  },
  {
    icon: Eye,
    title: "Real-Time Monitoring",
    description: "Watch scan progress live via SSE streams. Every log, every probe, every finding — as it happens.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20"
  },
  {
    icon: Slack,
    title: "Instant Alerts",
    description: "Critical vulnerabilities trigger immediate Slack notifications, so your team acts before attackers do.",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20"
  },
  {
    icon: GitBranch,
    title: "CI/CD Native",
    description: "Integrate into GitHub Actions, GitLab CI, or any pipeline via API. Security gates built in from day one.",
    color: "text-pink-400",
    bg: "bg-pink-500/10",
    border: "border-pink-500/20"
  }
];

const TERMINAL_LINES = [
  { prefix: "$", text: "redforge scan --target api.acme.io --mode ACTIVE", color: "text-zinc-300" },
  { prefix: "→", text: "RedForge Security Engine v3.0 — 10 modules active", color: "text-zinc-500" },
  { prefix: "→", text: "Phase 1: Fingerprinting... Detected: Next.js, AWS, Stripe", color: "text-zinc-500" },
  { prefix: "→", text: "Phase 2: Running 10 modules in parallel...", color: "text-zinc-500" },
  { prefix: "✓", text: "CRITICAL: XSS — reflected injection via ?q= param", color: "text-red-400" },
  { prefix: "✓", text: "HIGH: Cookie missing HttpOnly flag (auth session)", color: "text-orange-400" },
  { prefix: "✓", text: "HIGH: Missing HSTS header on HTTPS endpoint", color: "text-orange-400" },
  { prefix: "→", text: "Phase 5: Attack chain correlation engine...", color: "text-zinc-500" },
  { prefix: "⚠", text: "CHAIN: XSS + HttpOnly = Session Hijacking (CVSS 9.3)", color: "text-red-400" },
  { prefix: "✓", text: "Scan complete · 14 findings · 2 attack chains · Risk: 8.7/10", color: "text-blue-400" },
];

function SeverityBadge({ level }: { level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" }) {
  const styles = {
    CRITICAL: "bg-red-500/15 text-red-400 border-red-500/30",
    HIGH: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    MEDIUM: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    LOW: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wide ${styles[level]}`}>
      {level}
    </span>
  );
}

export default function Landing() {
  const [annual, setAnnual] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const logoSpin = useAnimation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleLogoHover = async () => {
    await logoSpin.start({ rotate: 360, transition: { duration: 0.7, ease: [0.45, 0, 0.55, 1] } });
    logoSpin.set({ rotate: 0 });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">

      {/* Subtle background orbs */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="orb absolute top-1/3 -right-60 w-[500px] h-[500px] bg-violet-600" style={{ opacity: 0.04 }} />
        <div className="orb absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-orange-600" style={{ opacity: 0.04 }} />
      </div>

      {/* ═══ FLOATING NAVBAR ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
        style={{ paddingTop: scrolled ? "8px" : "16px", transition: "padding 0.3s ease" }}
      >
        <header
          className="pointer-events-auto w-full mx-4 flex items-center justify-between transition-all duration-300"
          style={{
            maxWidth: scrolled ? "900px" : "1200px",
            padding: scrolled ? "8px 16px" : "12px 24px",
            borderRadius: scrolled ? "100px" : "20px",
            background: scrolled
              ? "oklch(8% 0 0 / 0.88)"
              : "oklch(8% 0 0 / 0.15)",
            backdropFilter: scrolled ? "blur(20px) saturate(1.4)" : "blur(4px)",
            border: scrolled
              ? "1px solid oklch(100% 0 0 / 0.10)"
              : "1px solid oklch(100% 0 0 / 0.06)",
            boxShadow: scrolled ? "0 4px 32px oklch(0% 0 0 / 0.4)" : "none",
          }}
        >
          <Link href="/" className="flex items-center gap-2.5 group shrink-0" onMouseEnter={handleLogoHover}>
            <motion.div
              animate={logoSpin}
              className="flex items-center justify-center shrink-0 transition-all duration-300"
              style={{ width: scrolled ? "30px" : "34px", height: scrolled ? "30px" : "34px" }}
            >
              <img src="/logo.png" alt="RedForge" className="w-full h-full object-contain" />
            </motion.div>
            <span
              className="font-bold tracking-tight text-white transition-all duration-300"
              style={{ fontSize: scrolled ? "15px" : "17px" }}
            >
              RedForge
            </span>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
              BETA
            </span>
          </Link>

          <nav className="hidden md:flex items-center" style={{ gap: scrolled ? "20px" : "28px", transition: "gap 0.3s ease" }}>
            {[
              { label: "Features", href: "#features" },
              { label: "Pricing", href: "#pricing" },
              { label: "Changelog", href: "/changelog" },
              { label: "Status", href: "/status" },
            ].map(item => (
              <a
                key={item.label}
                href={item.href}
                className="text-muted-foreground hover:text-white transition-colors font-medium"
                style={{ fontSize: scrolled ? "13px" : "14px" }}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/signin"
              className="font-medium text-muted-foreground hover:text-white transition-colors"
              style={{ fontSize: scrolled ? "13px" : "14px", padding: scrolled ? "6px 10px" : "8px 12px" }}
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-primary text-white font-semibold hover:bg-primary/90 glow-red-sm hover:glow-red transition-all duration-300 whitespace-nowrap"
              style={{ fontSize: scrolled ? "13px" : "14px", padding: scrolled ? "7px 16px" : "9px 20px" }}
            >
              Start Free Trial
            </Link>
          </div>
        </header>
      </motion.div>

      {/* ═══ HERO ═══ */}
      <div className="relative overflow-hidden">
        <DitherBoundary>
          <div className="absolute inset-0 z-0">
            <Dither
              waveColor={[0.55, 0.03, 0.12] as [number, number, number]}
              colorNum={4}
              pixelSize={2}
              waveAmplitude={0.3}
              waveFrequency={3}
              waveSpeed={0.05}
              enableMouseInteraction={true}
              mouseRadius={0.3}
            />
          </div>
        </DitherBoundary>
        <div
          className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none"
          style={{ height: "180px", background: "linear-gradient(to bottom, transparent, oklch(5% 0 0))" }}
        />

        <main className="relative z-10 flex flex-col items-center text-center px-4 pt-32 pb-24">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/8 border border-primary/20 text-primary text-xs font-semibold tracking-widest uppercase mb-8"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            RedForge Engine v3.0 — Now Live
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl md:text-[72px] lg:text-[84px] font-bold tracking-[-0.03em] text-white max-w-5xl leading-[1.05] mb-6"
          >
            Autonomous AI<br />
            <span className="gradient-text-red">Penetration Testing</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed"
          >
            Find vulnerabilities before attackers do. RedForge continuously scans your APIs and web apps using advanced AI to identify, prove, and patch critical security issues — in seconds.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center mb-6"
          >
            <Link
              href="/signup"
              className="px-8 py-4 w-full sm:w-auto rounded-xl bg-primary text-white font-semibold text-base hover:bg-primary/90 glow-red transition-all duration-300 flex items-center justify-center gap-2 group"
            >
              Start Scanning Free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/signin"
              className="px-8 py-4 w-full sm:w-auto rounded-xl bg-white/5 border border-white/10 text-white font-semibold text-base hover:bg-white/8 hover:border-white/20 transition-all duration-300 flex items-center justify-center gap-2"
            >
              View Live Demo
              <ChevronRight className="w-4 h-4" />
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-xs text-muted-foreground"
          >
            No credit card required · Free plan always available
          </motion.p>

          {/* Terminal mockup */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="mt-16 w-full max-w-2xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl"
            style={{ background: "oklch(8% 0 0 / 0.95)" }}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8" style={{ background: "oklch(10% 0 0)" }}>
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
              <span className="ml-3 text-zinc-500 text-xs font-mono">redforge — bash</span>
            </div>
            <div className="p-5 font-mono text-sm space-y-2">
              {TERMINAL_LINES.map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + i * 0.18, duration: 0.2 }}
                  className="flex items-start gap-3"
                >
                  <span className="text-zinc-600 select-none shrink-0 w-4 text-right">{line.prefix}</span>
                  <span className={line.color}>{line.text}</span>
                </motion.div>
              ))}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 + TERMINAL_LINES.length * 0.18 }}
                className="flex items-center gap-3 text-zinc-500"
              >
                <span className="text-zinc-600 select-none w-4 text-right">$</span>
                <span className="w-2 h-4 bg-zinc-500 cursor-blink" />
              </motion.div>
            </div>
          </motion.div>
        </main>
      </div>
      {/* ═══ END HERO ═══ */}


      {/* ═══ THE PROBLEM ═══ */}
      <section className="relative z-10 py-32 px-4 overflow-hidden" style={{ background: "oklch(6% 0 0)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-0 rounded-2xl overflow-hidden border border-white/8">

            {/* Left — problem statement */}
            <AnimatedSection className="p-12 lg:p-16 border-b lg:border-b-0 lg:border-r border-white/8" style={{ background: "oklch(7% 0 0)" }}>
              <motion.div variants={fadeUp} className="mb-8">
                <SectionBadge color="red">The Problem</SectionBadge>
              </motion.div>
              <motion.h2 variants={fadeUp} className="text-3xl lg:text-4xl font-bold leading-tight mb-4">
                <span className="text-primary">AI-enabled threats</span>
                <span className="text-white"> are<br />outpacing your defenses.</span>
              </motion.h2>
              <motion.p variants={fadeUp} className="text-2xl lg:text-3xl font-bold text-zinc-600 mb-12">
                Human review is no longer<br />scalable.
              </motion.p>

              <motion.div variants={fadeUp} className="grid grid-cols-2 gap-x-8 gap-y-4">
                <div className="space-y-4">
                  {[
                    "Static code scanning",
                    "Point-in-time testing",
                    "Generic compliance audits",
                  ].map(item => (
                    <div key={item} className="flex items-center gap-3 text-sm">
                      <span className="text-primary font-bold text-base">—</span>
                      <span className="text-zinc-500 line-through decoration-zinc-600">{item}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-4">
                  {[
                    "Semantic runtime validation",
                    "Continuous adversarial testing",
                    "Custom threat modeling",
                  ].map(item => (
                    <div key={item} className="flex items-center gap-3 text-sm">
                      <span className="text-emerald-400 font-bold text-base">+</span>
                      <span className="text-emerald-400">{item}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </AnimatedSection>

            {/* Right — globe + headline */}
            <AnimatedSection className="p-12 lg:p-16 flex flex-col justify-between" style={{ background: "oklch(5.5% 0 0)" }}>
              <div>
                <motion.h2 variants={fadeUp} className="text-3xl lg:text-4xl font-bold text-white leading-tight mb-3">
                  Weaponize AI to improve<br />your cyber defenses.
                </motion.h2>
                <motion.p variants={fadeUp} className="text-2xl lg:text-3xl font-bold text-emerald-400">
                  Stay ahead of threats.
                </motion.p>
              </div>
              <motion.div variants={fadeUp} className="flex justify-center mt-10">
                <GlobeCanvas size={340} />
              </motion.div>
            </AnimatedSection>

          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 py-32 px-4">
        <div className="max-w-7xl mx-auto">
          <AnimatedSection className="text-center mb-16">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold uppercase tracking-widest mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              Platform Capabilities
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-bold text-white tracking-[-0.02em] mb-4">
              Everything you need to stay <br className="hidden md:block" />
              <span className="gradient-text-red">ahead of threats</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-muted-foreground text-lg max-w-2xl mx-auto">
              A complete autonomous security platform built for modern engineering teams shipping at speed.
            </motion.p>
          </AnimatedSection>

          <AnimatedSection className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feat) => (
              <motion.div
                key={feat.title}
                variants={fadeUp}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="group cursor-default h-full"
              >
                <BorderGlow
                  borderRadius={16}
                  backgroundColor="#0e0c0c"
                  glowColor="5 75 65"
                  colors={['#ef4444', '#8b5cf6', '#f97316']}
                  glowRadius={44}
                  glowIntensity={1.1}
                  coneSpread={22}
                  fillOpacity={0.45}
                  className="h-full"
                >
                  <div className="p-6">
                    <div className={`w-11 h-11 rounded-xl ${feat.bg} border ${feat.border} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-200`}>
                      <feat.icon className={`w-5 h-5 ${feat.color}`} />
                    </div>
                    <h3 className="text-base font-semibold text-white mb-2">{feat.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feat.description}</p>
                  </div>
                </BorderGlow>
              </motion.div>
            ))}
          </AnimatedSection>
        </div>
      </section>

      {/* Integrations strip */}
      <section className="relative z-10 py-16 px-4 border-y border-white/5" style={{ background: "oklch(6.5% 0 0 / 0.6)" }}>
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-8 font-semibold">
            Integrates with your stack
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
            {[
              { icon: Slack, label: "Slack" },
              { icon: GitBranch, label: "GitHub" },
              { icon: Webhook, label: "Webhooks" },
              { icon: Database, label: "PostgreSQL" },
              { icon: Code2, label: "REST API" },
              { icon: Bell, label: "Alerts" },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2 text-muted-foreground hover:text-white transition-colors group">
                <item.icon className="w-5 h-5 group-hover:text-primary transition-colors" />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ═══ OFFENSE-DRIVEN DEFENSE ═══ */}
      <section className="relative z-10 py-32 px-4">
        <div className="max-w-7xl mx-auto">
          <AnimatedSection className="mb-14">
            <motion.div variants={fadeUp} className="mb-5">
              <SectionBadge color="green">Capabilities</SectionBadge>
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-bold text-white tracking-[-0.02em] mb-4">
              Offense-driven defense.
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-muted-foreground max-w-2xl">
              Deploy autonomous agents. Get verified findings. Ship fixes before attackers move.
            </motion.p>
          </AnimatedSection>

          <AnimatedSection className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Deploy in minutes */}
            <motion.div variants={fadeUp} whileHover={{ y: -3 }} className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: "oklch(8% 0 0)" }}>
              <div className="p-8">
                <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-2">AI / Attack</div>
                <h3 className="text-xl font-bold text-white mb-2">Deploy in minutes.</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  One config. Agents spin up sandboxes and begin adversarial testing across your full attack surface.
                </p>
                <TerminalWindow
                  title="Create New Project"
                  lines={[
                    { text: "$ redforge init --project acme-api", color: "text-emerald-400" },
                    { text: "→ Connecting to target...", color: "text-zinc-500" },
                    { text: "→ Crawling 84 endpoints", color: "text-zinc-500" },
                    { text: "✓ Agent provisioned. Scan running.", color: "text-emerald-300" },
                    { text: "→ auto-generated-pentest running", color: "text-zinc-500" },
                  ]}
                />
              </div>
            </motion.div>

            {/* Find critical exploits */}
            <motion.div variants={fadeUp} whileHover={{ y: -3 }} className="rounded-2xl border border-white/10 overflow-hidden flex flex-col" style={{ background: "oklch(8% 0 0)" }}>
              <div className="p-8 flex-1">
                <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-2">AI / Attack</div>
                <h3 className="text-xl font-bold text-white mb-2">Find critical exploits. All POC verified.</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Discover how an attacker can chain multiple exploits, evade your defenses, and compromise your systems. Every finding comes with a proof-of-concept script.
                </p>
              </div>
              <div className="flex justify-center pb-6">
                <GlobeCanvas size={220} />
              </div>
            </motion.div>

            {/* Auto-remediate */}
            <motion.div variants={fadeUp} whileHover={{ y: -3 }} className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: "oklch(8% 0 0)" }}>
              <div className="p-8">
                <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-2">AI / Fix</div>
                <h3 className="text-xl font-bold text-white mb-2">Auto-remediate before merge.</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Merge-ready patches with context-aware remediation. Fix vulns at the speed you ship.
                </p>
                <div className="rounded-xl border border-white/8 overflow-hidden font-mono text-xs" style={{ background: "oklch(6% 0 0)" }}>
                  <div className="px-4 py-2.5 border-b border-white/8 flex items-center justify-between">
                    <span className="text-zinc-500">Pull Request #42</span>
                    <SeverityBadge level="CRITICAL" />
                  </div>
                  <div className="p-4 space-y-1.5">
                    <div className="text-zinc-500 text-[10px] mb-2">↪ Fix: patch critical vulns</div>
                    <div className="flex gap-2 text-[11px]">
                      <Check className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                      <span className="text-zinc-400">SQL injection fixed</span>
                    </div>
                    <div className="flex gap-2 text-[11px]">
                      <Check className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                      <span className="text-zinc-400">Input validation added</span>
                    </div>
                    <div className="flex gap-2 text-[11px]">
                      <Check className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                      <span className="text-zinc-400">Review approved</span>
                    </div>
                  </div>
                  <div className="p-3 border-t border-white/8 flex gap-2">
                    <button className="flex-1 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-bold">Merge</button>
                    <button className="flex-1 py-2 rounded-lg bg-white/5 border border-white/8 text-zinc-400 text-xs font-bold">Review</button>
                  </div>
                </div>
              </div>
            </motion.div>


          </AnimatedSection>
        </div>
      </section>

      {/* ═══ AI SHIPS VULNERABILITIES BANNER ═══ */}
      <section
        className="relative z-10 py-32 px-4 overflow-hidden"
        style={{ background: "oklch(4.5% 0 0)" }}
      >
        {/* Matrix character background */}
        <MatrixBackground />

        {/* Vignette overlay so center text is readable */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            background: "radial-gradient(ellipse 55% 70% at 50% 50%, transparent 0%, oklch(4.5% 0 0 / 0.72) 60%, oklch(4.5% 0 0 / 0.95) 100%)",
          }}
        />

        <div className="relative z-20 max-w-4xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-[-0.03em] leading-tight mb-5"
          >
            AI ships <span className="text-primary">vulnerabilities</span><br />
            as fast as it ships features
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="text-lg text-zinc-400 mb-12"
          >
            Can your security program keep up with coding agents?
          </motion.p>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.25, duration: 0.4 }}
          >
            <a
              href="mailto:enterprise@redforge.io"
              className="inline-flex items-center gap-3 px-10 py-4 border border-emerald-500 text-emerald-400 font-bold tracking-[0.18em] text-xs uppercase hover:bg-emerald-500/10 transition-all duration-300 font-mono"
            >
              Talk to us about enterprise plans
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative z-10 py-32 px-4">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection className="text-center mb-16">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-widest mb-4">
              <BarChart3 className="w-3.5 h-3.5" />
              Simple Pricing
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-bold text-white tracking-[-0.02em] mb-4">
              Start free. Scale when <span className="gradient-text-red">ready.</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-muted-foreground text-lg max-w-xl mx-auto mb-10">
              No per-seat pricing. No surprise fees. Pay for what your team needs.
            </motion.p>

            <motion.div variants={fadeUp} className="inline-flex items-center gap-4">
              <span className={`text-sm font-medium transition-colors ${!annual ? "text-white" : "text-muted-foreground"}`}>Monthly</span>
              <button
                onClick={() => setAnnual(!annual)}
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${annual ? "bg-primary" : "bg-muted"}`}
              >
                <motion.div
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm"
                  animate={{ left: annual ? "calc(100% - 22px)" : "2px" }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </button>
              <span className={`text-sm font-medium transition-colors ${annual ? "text-white" : "text-muted-foreground"}`}>
                Annual
                <span className="ml-2 text-xs text-emerald-400 font-semibold">Save 20%</span>
              </span>
            </motion.div>
          </AnimatedSection>

          <AnimatedSection className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {PLANS.map((plan) => {
              const isPrimary = plan.id === "pro";
              const price = annual ? plan.annualPrice : plan.monthlyPrice;
              return (
                <motion.div
                  key={plan.id}
                  variants={fadeUp}
                  whileHover={{ y: isPrimary ? -2 : -4, transition: { duration: 0.2 } }}
                  className={`relative flex flex-col rounded-2xl border p-8 transition-all duration-300 ${isPrimary
                      ? "bg-primary/5 border-primary/40 shadow-[0_0_40px_hsl(348_83%_50%_/_0.12)] ring-1 ring-primary/20"
                      : "bg-card border-border hover:border-white/20"
                    }`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="px-4 py-1 rounded-full bg-primary text-white text-xs font-bold tracking-wide uppercase">
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-white mb-2">{plan.name}</h3>
                    <div className="flex items-end gap-2 mb-3">
                      {price === null ? (
                        <span className="text-4xl font-bold text-white">Custom</span>
                      ) : price === 0 ? (
                        <span className="text-4xl font-bold text-white">Free</span>
                      ) : (
                        <>
                          <span className="text-4xl font-bold text-white">
                            <AnimatePresence mode="wait">
                              <motion.span
                                key={annual ? "annual" : "monthly"}
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 8 }}
                                transition={{ duration: 0.15 }}
                                className="inline-block"
                              >
                                ${price}
                              </motion.span>
                            </AnimatePresence>
                          </span>
                          <span className="text-muted-foreground text-sm mb-1">/mo</span>
                        </>
                      )}
                    </div>
                    {price !== null && price > 0 && annual && (
                      <p className="text-xs text-muted-foreground">Billed annually (${price * 12}/yr)</p>
                    )}
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{plan.description}</p>
                  </div>

                  {plan.id === "enterprise" ? (
                    <a
                      href={plan.ctaLink}
                      className="w-full py-3 rounded-xl bg-white/5 border border-white/15 text-white font-semibold text-sm hover:bg-white/10 hover:border-white/25 transition-all text-center mb-8 block"
                    >
                      {plan.cta}
                    </a>
                  ) : (
                    <Link
                      href={plan.ctaLink as string}
                      className={`w-full py-3 rounded-xl font-semibold text-sm transition-all text-center mb-8 block ${isPrimary
                          ? "bg-primary text-white hover:bg-primary/90 glow-red-sm hover:glow-red"
                          : "bg-white/5 border border-white/15 text-white hover:bg-white/10 hover:border-white/25"
                        }`}
                    >
                      {plan.cta}
                    </Link>
                  )}

                  <div className="flex-1 space-y-3">
                    {plan.features.map((feat) => (
                      <div key={feat.text} className="flex items-center gap-3">
                        {feat.included ? (
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${isPrimary ? "bg-primary/20" : "bg-white/8"}`}>
                            <Check className={`w-2.5 h-2.5 ${isPrimary ? "text-primary" : "text-white"}`} strokeWidth={3} />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 bg-white/4">
                            <X className="w-2.5 h-2.5 text-muted-foreground" strokeWidth={3} />
                          </div>
                        )}
                        <span className={`text-sm ${feat.included ? "text-zinc-300" : "text-muted-foreground"}`}>
                          {feat.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </AnimatedSection>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="text-center text-sm text-muted-foreground mt-8"
          >
            All plans include SSL encryption and secure data handling.
            <a href="mailto:try.prit24@gmail.com" className="text-primary hover:underline ml-1">Questions? Talk to sales.</a>
          </motion.p>
        </div>
      </section>


      {/* CTA */}
      <section className="relative z-10 py-32 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative p-12 rounded-3xl border border-primary/20 overflow-hidden"
            style={{ background: "linear-gradient(135deg, oklch(8% 0 0), oklch(10% 0.01 20))" }}
          >
            <div className="orb absolute -top-20 -right-20 w-60 h-60 bg-primary" style={{ opacity: 0.12 }} />
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center mx-auto mb-6">
                <ShieldCheck className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.02em] mb-4">
                Start protecting your APIs today
              </h2>
              <p className="text-muted-foreground mb-8 max-w-xl mx-auto leading-relaxed">
                Start scanning your APIs for vulnerabilities with our AI-powered engine. Get your first scan running in under 2 minutes.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/signup"
                  className="px-8 py-4 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 glow-red transition-all duration-300 flex items-center justify-center gap-2 group"
                >
                  Get Started Free
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <a
                  href="mailto:try.prit24@gmail.com"
                  className="px-8 py-4 rounded-xl bg-white/5 border border-white/10 text-white font-semibold hover:bg-white/8 transition-all duration-300 text-center"
                >
                  Talk to Sales
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/6 py-12 px-6" style={{ background: "oklch(5% 0 0)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
            <div className="col-span-2">
              <div className="flex items-center gap-2.5 mb-3">
                <img src="/logo.png" alt="RedForge" className="w-8 h-8 object-contain" />
                <span className="font-bold text-white">RedForge</span>
              </div>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                Autonomous AI penetration testing for modern engineering teams.
              </p>
            </div>
            {[
              {
                title: "Product",
                links: [
                  { label: "Features", href: "#features" },
                  { label: "Pricing", href: "#pricing" },
                  { label: "Changelog", href: "/changelog" },
                  { label: "Status", href: "/status" },
                ]
              },
              {
                title: "Support",
                links: [
                  { label: "Contact Us", href: "mailto:hello@redforge.io" },
                  { label: "Sales", href: "mailto:try.prit24@gmail.com" },
                ]
              },
              {
                title: "Legal",
                links: [
                  { label: "Privacy Policy", href: "/privacy" },
                  { label: "Terms of Service", href: "/terms" },
                ]
              }
            ].map(col => (
              <div key={col.title}>
                <p className="text-xs font-semibold text-white uppercase tracking-widest mb-4">{col.title}</p>
                <ul className="space-y-2.5">
                  {col.links.map(link => (
                    <li key={link.label}>
                      <a href={link.href} className="text-sm text-muted-foreground hover:text-white transition-colors">{link.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-white/6 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">© 2026 RedForge, Inc. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-muted-foreground">All systems operational</span>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* ── Magnetic Brand Reveal ── */}
      <MagneticTextFooter />
    </div>
  );
}
