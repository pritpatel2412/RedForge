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

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="h-7 w-44 skeleton rounded-lg" />
          <div className="h-9 w-32 skeleton rounded-xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[0,1,2,3].map(i => (
            <div key={i} className="h-32 skeleton rounded-2xl" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 skeleton rounded-2xl" />
          <div className="h-72 skeleton rounded-2xl" style={{ animationDelay: "80ms" }} />
        </div>
      </div>
    );
  }

  if (!stats) return null;

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

  return (
    <LazyMotion features={domAnimation}>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="space-y-8"
      >
      {/* Header */}
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

      {/* Stats Grid */}
      <motion.div variants={stagger} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card) => (
          <motion.div
            key={card.label}
            variants={cardVariants}
            whileHover={{ y: -3, transition: { duration: 0.15 } }}
            className={`relative bg-card rounded-2xl p-6 overflow-hidden cursor-default ${
              card.accent === "critical"
                ? "border border-primary/25 shadow-[0_0_20px_hsl(348_83%_50%_/_0.08)]"
                : "border border-border"
            }`}
          >
            {card.accent === "critical" && (
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-primary/80 to-transparent" />
            )}
            <div className="flex items-center justify-between mb-4">
              <p className={`text-sm font-medium ${card.accent === "critical" ? "text-red-400" : "text-muted-foreground"}`}>
                {card.label}
              </p>
              <div className={`w-9 h-9 rounded-xl ${card.iconBg} border ${card.iconBorder} flex items-center justify-center`}>
                <card.icon className={`w-4 h-4 ${card.iconColor}`} />
              </div>
            </div>
            <div className={`text-4xl font-bold tracking-tight ${card.accent === "critical" ? "text-primary" : "text-white"}`}>
              <AnimatedCount value={card.value} />
            </div>
            {card.accent === "critical" && card.value > 0 && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="flex items-center gap-1.5 mt-2"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-primary pulse-red" />
                <span className="text-xs text-primary font-medium">Requires attention</span>
              </motion.div>
            )}
          </motion.div>
        ))}
      </motion.div>

      {/* Tables */}
      <motion.div variants={stagger} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Scans */}
        <motion.div variants={cardVariants} className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-white flex items-center gap-2.5 text-sm">
              <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Target className="w-3.5 h-3.5 text-primary" />
              </div>
              Recent Scans
            </h2>
            <Link href="/scans" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors group">
              View all
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
          <div className="flex-1 divide-y divide-border/60">
            {stats.recentScans.length === 0 ? (
              <div className="p-8 text-center">
                <Target className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No scans yet. Start your first scan.</p>
              </div>
            ) : (
              <motion.div variants={stagger} initial="hidden" animate="visible">
                {stats.recentScans.slice(0, 5).map((scan, i) => (
                  <motion.div key={scan.id} variants={rowVariants} transition={{ delay: i * 0.05 }}>
                    <Link
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
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Recent Findings */}
        <motion.div variants={cardVariants} className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-white flex items-center gap-2.5 text-sm">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Bug className="w-3.5 h-3.5 text-amber-400" />
              </div>
              Latest Findings
            </h2>
            <Link href="/findings" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors group">
              View all
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
          <div className="flex-1 divide-y divide-border/60">
            {stats.recentFindings.length === 0 ? (
              <div className="p-8 text-center">
                <Bug className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No findings yet. Run a scan to see results.</p>
              </div>
            ) : (
              <motion.div variants={stagger} initial="hidden" animate="visible">
                {stats.recentFindings.slice(0, 5).map((finding, i) => (
                  <motion.div key={finding.id} variants={rowVariants} transition={{ delay: i * 0.05 }}>
                    <Link
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
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
    </LazyMotion>
  );
}
