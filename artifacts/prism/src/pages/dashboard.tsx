import { useGetDashboardSummary, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getRiskBadgeVariant } from "@/lib/risk-utils";
import { Activity, ArrowUpRight, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { MODULES, themeForLabel } from "@/lib/modules";
import { ScoreRing } from "@/components/score-ring";
import { Explainer, GuidedTour } from "@/components/teachy";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/use-count-up";

function StatValue({ value }: { value: number }) {
  return <>{useCountUp(value)}</>;
}

export default function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });

  if (isLoading) {
    return (
      <div className="p-8 space-y-6 animate-pulse">
        <div className="h-7 w-48 bg-muted rounded" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-muted rounded" />)}
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const modules = [
    { theme: MODULES.supplychain, value: summary.supplyChainScans, desc: "Dependency scans" },
    { theme: MODULES.sentinel,    value: summary.sentinelAnalyses,  desc: "AI text analyses" },
    { theme: MODULES.trustlens,   value: summary.trustlensScans,    desc: "URL & policy checks" },
    { theme: MODULES.finguard,    value: summary.finguardAnalyses,  desc: "Transaction histories" },
    { theme: MODULES.devicescan,  value: summary.deviceScans,       desc: "Browser scans" },
    { theme: MODULES.guard,       value: summary.guardScans,        desc: "Hardware agent scans" },
    { theme: { ...MODULES.devicescan, name: "Deep Scan", href: "/devicescan" },
      value: summary.deepScans, desc: "MacBook posture scans" },
  ];

  const riskLevel =
    summary.avgRiskScore >= 80 ? { label: "Critical", color: "text-red-600 dark:text-red-400" } :
    summary.avgRiskScore >= 40 ? { label: "Elevated", color: "text-amber-600 dark:text-amber-400" } :
                                 { label: "Nominal",  color: "text-emerald-600 dark:text-emerald-400" };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">

        <GuidedTour />

        {/* ── Header strip ── */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              Security Overview
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Command Center</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              All modules · live session
            </p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right">
              <div className={cn("text-2xl font-mono font-bold tabular-nums", riskLevel.color)}>
                <StatValue value={summary.avgRiskScore} />
                <span className="text-sm font-normal text-muted-foreground">/100</span>
              </div>
              <div className="text-xs text-muted-foreground">
                avg risk · <span className={riskLevel.color}>{riskLevel.label}</span>
              </div>
            </div>
            <ScoreRing score={summary.avgRiskScore} size={80} strokeWidth={7} />
          </div>
        </div>

        <Explainer label="What is a risk score?">
          Every scan in PRISM produces a score from 0 to 100.{" "}
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">Green (0–39)</span> is all clear,{" "}
          <span className="font-semibold text-amber-600 dark:text-amber-400">amber (40–79)</span> is worth a look,{" "}
          <span className="font-semibold text-red-600 dark:text-red-400">red (80–100)</span> means act now.
          This ring averages the risk of everything scanned so far.
        </Explainer>

        {/* ── Module scorecard grid ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {modules.map((m, i) => {
            const Icon = m.theme.icon;
            return (
              <Link key={m.theme.name} href={m.theme.href} className="block group">
                <div
                  className="relative overflow-hidden rounded-xl border bg-card p-4 hover-lift press-scale rise-in cursor-pointer"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  {/* Tinted radial wash — module identity without a slapped-on border stripe */}
                  <div
                    className="pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-[0.12] blur-xl transition-opacity duration-300 group-hover:opacity-25"
                    style={{ background: m.theme.hsl }}
                  />
                  <div className="relative flex items-center justify-between mb-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                      style={{ background: `color-mix(in srgb, ${m.theme.hsl} 14%, transparent)` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: m.theme.hsl }} />
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                  </div>
                  <div className="relative text-2xl font-mono font-bold tabular-nums">
                    <StatValue value={m.value} />
                  </div>
                  <div className="relative text-sm font-medium mt-0.5" style={{ color: m.theme.hsl }}>
                    {m.theme.name}
                  </div>
                  <div className="relative text-xs text-muted-foreground mt-0.5">{m.desc}</div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* ── Bottom row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Recent Activity */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
              </div>
              <CardDescription className="text-xs">Latest scans across all modules</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {summary.recentActivity.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm font-medium">Nothing scanned yet.</p>
                    <p className="text-xs mt-1">Pick any module and run your first scan.</p>
                  </div>
                ) : (
                  summary.recentActivity.map((act, i) => {
                    const theme = themeForLabel(act.module);
                    const Icon = theme.icon;
                    return (
                      <div
                        key={`${act.module}-${act.id}-${act.createdAt}-${act.title}`}
                        className="flex items-center justify-between px-3 py-2.5 rounded-lg border bg-background/50 transition-all duration-200 hover:bg-background hover:border-current hover:translate-x-0.5 rise-in"
                        style={{ animationDelay: `${i * 40}ms` }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                            style={{ background: `color-mix(in srgb, ${theme.hsl} 14%, transparent)` }}
                          >
                            <Icon className="w-3.5 h-3.5" style={{ color: theme.hsl }} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate max-w-[18rem]" title={act.title}>
                              {act.title}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {theme.name} · {new Date(act.createdAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <Badge variant={getRiskBadgeVariant(act.riskScore)} className="font-mono text-xs shrink-0 ml-3">
                          {act.riskScore}
                        </Badge>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* Critical Attention */}
          <Card className={cn(
            "relative overflow-hidden transition-colors duration-300",
            summary.highRiskCount > 0 ? "border-red-200/60 dark:border-red-900/40" : "border-emerald-200/60 dark:border-emerald-900/40",
          )}>
            {summary.highRiskCount > 0 && (
              <div className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full bg-red-500/10 blur-2xl" />
            )}
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <CardTitle className="text-sm font-semibold">Critical Attention</CardTitle>
              </div>
              <CardDescription className="text-xs">High-risk findings needing review</CardDescription>
            </CardHeader>
            <CardContent className="relative flex flex-col items-center justify-center py-6 gap-3">
              <div
                className={cn(
                  "text-6xl font-mono font-bold tabular-nums",
                  summary.highRiskCount > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400",
                )}
              >
                <StatValue value={summary.highRiskCount} />
              </div>
              <p className="text-xs text-muted-foreground text-center leading-relaxed max-w-[160px]">
                {summary.highRiskCount === 0
                  ? "No high-risk findings right now."
                  : "findings scoring 80+ need your attention."}
              </p>
              <Link href="/reports">
                <div className="text-xs font-medium text-primary hover:underline underline-offset-4 transition-colors">
                  View in Reports →
                </div>
              </Link>
              <Explainer label="What counts as high risk?">
                Anything scoring 80 or more — the red zone. PRISM counts them here so
                the most urgent findings are never buried in a list.
              </Explainer>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
