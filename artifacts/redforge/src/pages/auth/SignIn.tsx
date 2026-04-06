import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Loader2, Shield, Zap, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { useLogin } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

const features = [
  { icon: Shield, text: "OWASP Top 10 coverage" },
  { icon: Zap, text: "AI-generated security patches" },
  { icon: Lock, text: "Real-time vulnerability alerts" },
];

export default function SignIn() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("demo@redforge.io");
  const [password, setPassword] = useState("demo1234");

  const { mutate: login, isPending } = useLogin({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        toast.success("Welcome back to RedForge");
        setLocation("/dashboard");
      },
      onError: (err: any) => {
        toast.error(err.message || "Invalid credentials");
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ data: { email, password } });
  };

  return (
    <div className="min-h-screen bg-background flex relative overflow-hidden">
      {/* Left panel - branding */}
      <div className="hidden lg:flex flex-col justify-between w-[440px] shrink-0 p-10 border-r border-border relative overflow-hidden" style={{ background: "oklch(6% 0 0)" }}>
        <div className="orb absolute -top-20 -left-20 w-80 h-80 bg-primary" style={{ opacity: 0.1 }} />
        <div className="orb absolute bottom-0 right-0 w-60 h-60 bg-violet-600" style={{ opacity: 0.06 }} />
        <div className="bg-dot-grid absolute inset-0 opacity-20" />

        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2.5 group">
            <img src="/logo.png" alt="RedForge" className="w-9 h-9 object-contain" />
            <span className="font-bold text-lg tracking-tight text-white">RedForge</span>
          </Link>
        </div>

        <div className="relative z-10">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-bold text-white tracking-[-0.02em] mb-4"
          >
            Autonomous security<br/>for modern teams
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-sm text-muted-foreground mb-8 leading-relaxed"
          >
            Find and fix critical vulnerabilities before attackers do. Trusted by 1,200+ engineering teams.
          </motion.p>
          <div className="space-y-3">
            {features.map((feat, i) => (
              <motion.div
                key={feat.text}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
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

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="relative z-10 text-xs text-muted-foreground"
        >
          © 2026 RedForge, Inc.
        </motion.p>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        <div className="orb absolute top-0 right-0 w-96 h-96 bg-primary" style={{ opacity: 0.06 }} />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm relative z-10"
        >
          <div className="lg:hidden flex items-center gap-2.5 justify-center mb-8">
            <img src="/logo.png" alt="RedForge" className="w-9 h-9 object-contain" />
            <span className="font-bold text-lg text-white">RedForge</span>
          </div>

          <h1 className="text-2xl font-bold text-white mb-1 tracking-[-0.02em]">Welcome back</h1>
          <p className="text-sm text-muted-foreground mb-8">Sign in to your RedForge workspace</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none border border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all placeholder:text-muted-foreground"
                style={{ background: "oklch(8% 0 0)" }}
                placeholder="you@company.com"
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Password</label>
                <Link href="/auth/forgot-password" className="text-xs text-primary hover:underline">Forgot?</Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none border border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all"
                style={{ background: "oklch(8% 0 0)" }}
                required
              />
            </div>

            <motion.button
              type="submit"
              disabled={isPending}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl py-3 font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-[0_0_20px_hsl(348_83%_50%_/_0.3)] hover:shadow-[0_0_30px_hsl(348_83%_50%_/_0.45)]"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>

          <div className="mt-6 pt-5 border-t border-border text-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link href="/signup" className="text-primary hover:underline font-semibold">
                Request Access
              </Link>
            </p>
          </div>

          <div className="mt-4 p-3 rounded-xl border border-border" style={{ background: "oklch(7% 0 0)" }}>
            <p className="text-[11px] text-muted-foreground text-center">
              <span className="text-zinc-400 font-medium">Demo:</span> demo@redforge.io / demo1234
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
