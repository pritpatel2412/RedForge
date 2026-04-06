import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Loader2, Shield, Zap, Lock,
  Github, Eye, EyeOff, Check, Mail
} from "lucide-react";
import { useLogin, useRegister } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

type Mode = "signin" | "signup";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const features = [
  { icon: Shield, text: "OWASP Top 10 + SANS coverage" },
  { icon: Zap, text: "AI-generated security patches" },
  { icon: Lock, text: "Real-time vulnerability alerts" },
  { icon: Check, text: "SOC2 compliant · GDPR ready" },
];

const slideVariants = {
  enter: (dir: number) => ({ x: dir * 48, opacity: 0, scale: 0.98 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({ x: dir * -48, opacity: 0, scale: 0.98 }),
};

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function OAuthButton({
  provider, label, icon, onClick, loading,
}: {
  provider: "google" | "github";
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  loading: boolean;
}) {
  const isGithub = provider === "github";
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={loading}
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.985 }}
      className={`w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm border transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${isGithub
          ? "bg-white/6 border-white/12 text-white hover:bg-white/10 hover:border-white/20"
          : "bg-white border-white/20 text-gray-800 hover:bg-zinc-100"
        }`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      <span>{label}</span>
    </motion.button>
  );
}

function SignInForm({
  onSwitch, direction, onSuccess,
}: {
  onSwitch: () => void;
  direction: number;
  onSuccess: (path: string) => void;
}) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("demo@redforge.io");
  const [password, setPassword] = useState("demo1234");
  const [showPw, setShowPw] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);

  const { mutate: login, isPending } = useLogin({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        toast.success("Welcome back to RedForge");
        onSuccess("/dashboard");
      },
      onError: (err: any) => toast.error(err.message || "Invalid credentials"),
    },
  });

  const handleOAuth = (provider: "google" | "github") => {
    setOauthLoading(provider);
    window.location.href = `${BASE}/api/auth/oauth/${provider}`;
  };

  return (
    <motion.div
      key="signin"
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className="w-full"
    >
      <h1 className="text-2xl font-bold text-white mb-1 tracking-[-0.02em]">Welcome back</h1>
      <p className="text-sm text-muted-foreground mb-7">Sign in to your RedForge workspace</p>

      {/* Social logins */}
      <div className="space-y-2.5 mb-6">
        <OAuthButton
          provider="github"
          label="Continue with GitHub"
          icon={<Github className="w-4 h-4" />}
          onClick={() => handleOAuth("github")}
          loading={oauthLoading === "github"}
        />
        <OAuthButton
          provider="google"
          label="Continue with Google"
          icon={<GoogleIcon />}
          onClick={() => handleOAuth("google")}
          loading={oauthLoading === "google"}
        />
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-zinc-600 font-medium">or continue with email</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <form onSubmit={e => { e.preventDefault(); login({ data: { email, password } }); }} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Email</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl text-white text-sm outline-none border border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all placeholder:text-zinc-600"
              style={{ background: "oklch(8% 0 0)" }}
              placeholder="you@company.com"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Password</label>
            <Link href="/auth/forgot-password" title="Reset your password" className="text-xs text-primary hover:underline">Forgot?</Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full pl-10 pr-10 py-3 rounded-xl text-white text-sm outline-none border border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all"
              style={{ background: "oklch(8% 0 0)" }}
              required
            />
            <button
              type="button"
              onClick={() => setShowPw(p => !p)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <motion.button
          type="submit"
          disabled={isPending}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl py-3 font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-1 shadow-[0_0_24px_hsl(348_83%_50%_/_0.3)] hover:shadow-[0_0_32px_hsl(348_83%_50%_/_0.45)]"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign In <ArrowRight className="w-4 h-4" /></>}
        </motion.button>
      </form>

      <div className="mt-6 pt-5 border-t border-border text-center">
        <p className="text-sm text-muted-foreground">
          Don't have an account?{" "}
          <button onClick={onSwitch} className="text-primary hover:underline font-semibold transition-colors">
            Create one free
          </button>
        </p>
      </div>

      <div className="mt-4 p-3 rounded-xl border border-border" style={{ background: "oklch(7% 0 0)" }}>
        <p className="text-[11px] text-muted-foreground text-center">
          <span className="text-zinc-400 font-medium">Demo:</span> demo@redforge.io / demo1234
        </p>
      </div>
    </motion.div>
  );
}

function SignUpForm({
  onSwitch, direction, onSuccess,
}: {
  onSwitch: () => void;
  direction: number;
  onSuccess: (path: string) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);

  const { mutate: register, isPending } = useRegister({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        toast.success("Account created — welcome to RedForge!");
        onSuccess("/dashboard");
      },
      onError: (err: any) => toast.error(err.message || "Failed to create account"),
    },
  });

  const handleOAuth = (provider: "google" | "github") => {
    setOauthLoading(provider);
    window.location.href = `${BASE}/api/auth/oauth/${provider}`;
  };

  const strengthScore = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strengthScore];
  const strengthColor = ["", "bg-red-500", "bg-amber-500", "bg-blue-500", "bg-emerald-500"][strengthScore];

  return (
    <motion.div
      key="signup"
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className="w-full"
    >
      <h1 className="text-2xl font-bold text-white mb-1 tracking-[-0.02em]">Create your account</h1>
      <p className="text-sm text-muted-foreground mb-7">Start scanning free — no credit card needed</p>

      {/* Social logins */}
      <div className="space-y-2.5 mb-6">
        <OAuthButton
          provider="github"
          label="Sign up with GitHub"
          icon={<Github className="w-4 h-4" />}
          onClick={() => handleOAuth("github")}
          loading={oauthLoading === "github"}
        />
        <OAuthButton
          provider="google"
          label="Sign up with Google"
          icon={<GoogleIcon />}
          onClick={() => handleOAuth("google")}
          loading={oauthLoading === "google"}
        />
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-zinc-600 font-medium">or sign up with email</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <form
        onSubmit={e => { e.preventDefault(); register({ data: { name, email, password, workspaceName } }); }}
        className="space-y-3.5"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none border border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all placeholder:text-zinc-600"
              style={{ background: "oklch(8% 0 0)" }}
              placeholder="John Doe"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Workspace</label>
            <input
              type="text"
              value={workspaceName}
              onChange={e => setWorkspaceName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none border border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all placeholder:text-zinc-600"
              style={{ background: "oklch(8% 0 0)" }}
              placeholder="Company Inc."
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Work Email</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl text-white text-sm outline-none border border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all placeholder:text-zinc-600"
              style={{ background: "oklch(8% 0 0)" }}
              placeholder="john@company.com"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Password</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full pl-10 pr-10 py-3 rounded-xl text-white text-sm outline-none border border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all"
              style={{ background: "oklch(8% 0 0)" }}
              required
              minLength={8}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPw(p => !p)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {password && (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${strengthColor}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${strengthScore * 25}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <span className="text-[10px] text-zinc-500">{strengthLabel}</span>
            </div>
          )}
        </div>

        <motion.button
          type="submit"
          disabled={isPending}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl py-3 font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-1 shadow-[0_0_24px_hsl(348_83%_50%_/_0.3)] hover:shadow-[0_0_32px_hsl(348_83%_50%_/_0.45)]"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Start Free Trial <ArrowRight className="w-4 h-4" /></>}
        </motion.button>

        <p className="text-[11px] text-zinc-600 text-center leading-relaxed">
          By signing up you agree to our{" "}
          <Link href="/terms" className="text-zinc-500 hover:text-zinc-300 underline">Terms</Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-zinc-500 hover:text-zinc-300 underline">Privacy Policy</Link>.
        </p>
      </form>

      <div className="mt-5 pt-5 border-t border-border text-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <button onClick={onSwitch} className="text-primary hover:underline font-semibold transition-colors">
            Sign in
          </button>
        </p>
      </div>
    </motion.div>
  );
}

export default function AuthPage({ initialMode }: { initialMode: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [direction, setDirection] = useState(1);
  const [, navigate] = useLocation();

  const switchMode = (next: Mode) => {
    setDirection(next === "signup" ? 1 : -1);
    setMode(next);
    window.history.pushState({}, "", next === "signin" ? `${BASE}/signin` : `${BASE}/signup`);
  };

  const handleSuccess = (path: string) => {
    navigate(path);
  };

  return (
    <div className="min-h-screen bg-background flex relative overflow-hidden">

      {/* ── Left branding panel ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[440px] shrink-0 p-10 border-r border-border relative overflow-hidden"
        style={{ background: "oklch(6% 0 0)" }}
      >
        <div className="orb absolute -top-20 -left-20 w-80 h-80 bg-primary" style={{ opacity: 0.1 }} />
        <div className="orb absolute bottom-0 right-0 w-60 h-60 bg-violet-600" style={{ opacity: 0.06 }} />
        <div className="bg-dot-grid absolute inset-0 opacity-20" />

        {/* Logo */}
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2.5 group">
            <img src="/logo.png" alt="RedForge" className="w-9 h-9 object-contain" />
            <span className="font-bold text-lg tracking-tight text-white">RedForge</span>
          </Link>
        </div>

        {/* Middle copy — animates with mode */}
        <div className="relative z-10">
          <AnimatePresence mode="wait">
            {mode === "signin" ? (
              <motion.div
                key="signin-copy"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.28 }}
              >
                <h2 className="text-3xl font-bold text-white tracking-[-0.02em] mb-3">
                  Autonomous security<br />for modern teams
                </h2>
                <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
                  Find and fix critical vulnerabilities before attackers do. Trusted by 1,200+ engineering teams.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="signup-copy"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.28 }}
              >
                <h2 className="text-3xl font-bold text-white tracking-[-0.02em] mb-3">
                  Ship secure code<br />with confidence
                </h2>
                <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
                  Join 1,200+ teams using RedForge to catch critical vulnerabilities in seconds — not weeks.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-3">
            {features.map((feat, i) => (
              <motion.div
                key={feat.text}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08, duration: 0.3 }}
                className="flex items-center gap-3"
              >
                <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <feat.icon className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-sm text-zinc-400">{feat.text}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Meet the Developer ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.4 }}
          className="relative z-10"
        >
          {/* Card */}
          <div
            className="rounded-2xl border border-white/10 overflow-hidden"
            style={{ background: "oklch(7.5% 0.005 260)" }}
          >
            {/* Top accent bar */}
            <div className="h-0.5 w-full bg-gradient-to-r from-primary via-violet-500 to-transparent" />

            <div className="p-4">
              {/* Label */}
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-3">Built by</p>

              {/* Profile row */}
              <div className="flex items-center gap-3 mb-3">
                {/* Real GitHub avatar */}
                <div className="relative shrink-0">
                  <img
                    src="https://github.com/pritpatel2412.png?size=80"
                    alt="Prit Patel"
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/30"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                      (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                    }}
                  />
                  {/* Fallback avatar */}
                  <div className="hidden w-12 h-12 rounded-full bg-gradient-to-br from-primary to-violet-600 items-center justify-center text-white font-bold text-base ring-2 ring-primary/30">P</div>
                  {/* Online dot */}
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[oklch(7.5%_0.005_260)]" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white tracking-tight">Prit Patel</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Full-Stack · AI · Security</p>
                </div>
              </div>

              {/* Tech badges */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {["React", "Node.js", "AI/ML", "Security"].map(tag => (
                  <span
                    key={tag}
                    className="text-[9px] font-semibold px-2 py-0.5 rounded-full border border-white/10 text-zinc-500"
                    style={{ background: "oklch(10% 0 0)" }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* CTA buttons */}
              <div className="grid grid-cols-2 gap-1.5">
                <a
                  href="https://pritfolio.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-95"
                  style={{ background: "linear-gradient(135deg, #e11d48, #9f1239)" }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  Portfolio
                </a>
                <a
                  href="https://github.com/pritpatel2412"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold text-zinc-300 border border-white/10 hover:bg-white/8 hover:text-white hover:border-white/20 transition-all duration-200 active:scale-95"
                  style={{ background: "oklch(10% 0 0)" }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  GitHub
                </a>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-zinc-700 mt-3 text-center">© 2026 RedForge, Inc.</p>
        </motion.div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="orb absolute top-0 right-0 w-96 h-96 bg-primary" style={{ opacity: 0.05 }} />
        <div className="orb absolute bottom-0 left-0 w-72 h-72 bg-violet-600" style={{ opacity: 0.04 }} />

        <div className="w-full max-w-sm relative z-10">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 justify-center mb-8">
            <img src="/logo.png" alt="RedForge" className="w-9 h-9 object-contain" />
            <span className="font-bold text-lg text-white">RedForge</span>
          </div>

          <AnimatePresence mode="wait" custom={direction}>
            {mode === "signin" ? (
              <SignInForm
                key="signin"
                onSwitch={() => switchMode("signup")}
                direction={direction}
                onSuccess={handleSuccess}
              />
            ) : (
              <SignUpForm
                key="signup"
                onSwitch={() => switchMode("signin")}
                direction={direction}
                onSuccess={handleSuccess}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
