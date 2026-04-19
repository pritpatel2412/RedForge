import { useRef, useEffect, useState, memo, useMemo } from "react";
import { useGetDashboardStats } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Shield, Bug, Target, Activity, ArrowRight, ShieldAlert, TrendingUp, Zap } from "lucide-react";
import { motion, useInView, AnimatePresence, LazyMotion, domAnimation } from "framer-motion";
import { formatDate } from "@/lib/utils";
import { SeverityBadge, StatusBadge } from "@/components/Badges";

const AnimatedCount = memo(({ value, className }: { value: number; className?: string }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [displayed, setDisplayed] = useState(value);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasAnimated = useRef(false);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView || hasAnimated.current) return;
    hasAnimated.current = true;
    const steps = 24;
    const duration = 480;
    const stepTime = duration / steps;
    let step = 0;
    animRef.current = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(value * eased));
      if (step >= steps) {
        setDisplayed(value);
        if (animRef.current) clearInterval(animRef.current);
      }
    }, stepTime);
    return () => { if (animRef.current) clearInterval(animRef.current); };
  }, [isInView, value]);

  return <span ref={ref} className={className}>{displayed}</span>;
});

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1 }
};

const stagger = {
  visible: { transition: { staggerChildren: 0.07 } }
};

const rowVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0 }
};

export default function Dashboard() {
  const { data: stats, isLoading } = useGetDashboardStats();

  const statCards = useMemo(() => [
    {
      label: "Total Projects",
      value: stats?.totalProjects || 0,
      icon: Shield,
      iconColor: "text-blue-400",
      iconBg: "bg-blue-500/10",
      iconBorder: "border-blue-500/20",
      accent: null,
    },
    {
      label: "Open Findings",
      value: stats?.openFindings || 0,
      icon: Bug,
      iconColor: "text-amber-400",
      iconBg: "bg-amber-500/10",
      iconBorder: "border-amber-500/20",
      accent: null,
    },
    {
      label: "Critical Issues",
      value: stats?.criticalFindings || 0,
      icon: ShieldAlert,
      iconColor: "text-primary",
      iconBg: "bg-primary/10",
      iconBorder: "border-primary/30",
      accent: "critical",
    },
    {
      label: "Scans this Month",
      value: stats?.scansThisMonth || 0,
      icon: Activity,
      iconColor: "text-emerald-400",
      iconBg: "bg-emerald-500/10",
      iconBorder: "border-emerald-500/20",
      accent: null,
    },
  ], [stats]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 skeleton rounded-lg" />
          <div className="h-10 w-36 skeleton rounded-xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0,1,2,3].map(i => (
            <div key={i} className="h-32 skeleton rounded-2xl" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 skeleton rounded-2xl" />
          <div className="h-64 skeleton rounded-2xl" style={{ animationDelay: "80ms" }} />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence mode="wait">
        <motion.div
          key="dashboard-content"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={stagger}
          className="space-y-6 relative"
        >
          {/* Background Decor */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute top-1/2 -left-24 w-64 h-64 bg-blue-500/5 blur-[100px] rounded-full pointer-events-none" />
          
          <motion.div variants={cardVariants} className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Security overview for your workspace</p>
            </div>
            <Link
              href="/projects/new"
              className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold text-sm transition-all duration-200 shadow-[0_0_15px_hsl(348_83%_50%_/_0.2)] hover:shadow-[0_0_25px_hsl(348_83%_50%_/_0.35)] group"
            >
              <Zap className="w-4 h-4" />
              New Scan Target
            </Link>
          </motion.div>

          <motion.div variants={stagger} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={card.label}
                  variants={cardVariants}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className={`relative group bg-zinc-900/40 backdrop-blur-xl rounded-2xl p-5 overflow-hidden cursor-default transition-all duration-300 ${
                    card.accent === "critical"
                      ? "border border-primary/30 shadow-[0_0_20px_hsl(348_83%_50%_/_0.12)] bg-primary/[0.02]"
                      : "border border-white/5 hover:border-white/10 hover:shadow-2xl hover:shadow-black/50"
                  }`}
                >
                  <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br ${card.accent === "critical" ? 'from-primary/5 to-transparent' : 'from-white/[0.02] to-transparent'}`} />
                  {card.accent === "critical" && (
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-primary/80 to-transparent" />
                  )}
                  <div className="flex items-center justify-between mb-4">
                    <p className={`text-sm font-medium ${card.accent === "critical" ? "text-red-400" : "text-muted-foreground"}`}>
                      {card.label}
                    </p>
                    <div className={`w-9 h-9 rounded-xl ${card.iconBg} border ${card.iconBorder} flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${card.iconColor}`} />
                    </div>
                  </div>
                  <div className={`text-4xl font-bold tracking-tight ${card.accent === "critical" ? "text-primary" : "text-white"}`}>
                    <AnimatedCount value={card.value} />
                  </div>
                  {card.accent === "critical" && card.value > 0 && (
                    <motion.div
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-1.5 mt-2"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-primary pulse-red" />
                      <span className="text-xs text-primary font-medium">Requires attention</span>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>

          <motion.div variants={stagger} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div variants={cardVariants} className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden flex flex-col shadow-xl">
              <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                <h2 className="font-semibold text-white flex items-center gap-2.5 text-sm uppercase tracking-wider">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Target className="w-4 h-4 text-primary" />
                  </div>
                  Recent Scans
                </h2>
                <Link href="/scans" className="text-[11px] font-bold text-muted-foreground hover:text-primary flex items-center gap-1 transition-all group uppercase tracking-widest">
                  View all
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
              <div className="flex-1 divide-y divide-border/60">
                {stats.recentScans.length === 0 ? (
                  <div className="p-8 text-center">
                    <Target className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No scans yet.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/10">
                    {stats.recentScans.slice(0, 5).map((scan) => (
                      <Link
                        key={scan.id}
                        href={`/scans/${scan.id}`}
                        className="flex items-center justify-between px-5 py-3.5 hover:bg-white/3 transition-colors group"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-white truncate group-hover:text-primary transition-colors">{scan.projectName}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{formatDate(scan.createdAt)}</div>
                        </div>
                        <div className="flex items-center gap-3 ml-3 shrink-0">
                          {scan.criticalCount > 0 && (
                            <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                              {scan.criticalCount} Critical
                            </span>
                          )}
                          <StatusBadge status={scan.status} />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div variants={cardVariants} className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden flex flex-col shadow-xl">
              <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                <h2 className="font-semibold text-white flex items-center gap-2.5 text-sm uppercase tracking-wider">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <Bug className="w-4 h-4 text-amber-400" />
                  </div>
                  Latest Findings
                </h2>
                <Link href="/findings" className="text-[11px] font-bold text-muted-foreground hover:text-primary flex items-center gap-1 transition-all group uppercase tracking-widest">
                  View all
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
              <div className="flex-1 divide-y divide-border/60">
                {stats.recentFindings.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bug className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No findings yet.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/10">
                    {stats.recentFindings.slice(0, 5).map((finding) => (
                      <Link
                        key={finding.id}
                        href={`/findings/${finding.id}`}
                        className="flex items-center justify-between px-5 py-3.5 hover:bg-white/3 transition-colors group"
                      >
                        <div className="overflow-hidden pr-3">
                          <div className="text-sm font-medium text-white truncate group-hover:text-primary transition-colors">{finding.title}</div>
                          <div className="text-xs text-muted-foreground truncate mt-0.5">{finding.projectName} · {finding.endpoint}</div>
                        </div>
                        <div className="shrink-0">
                          <SeverityBadge severity={finding.severity} />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </LazyMotion>
  );
}
