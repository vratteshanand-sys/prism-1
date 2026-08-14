import { useState } from "react";
import { useGetDashboardSummary, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { getRiskBadgeVariant } from "@/lib/risk-utils";
import { Activity, ArrowUpRight, AlertTriangle, Info, Lightbulb } from "lucide-react";
import { Link } from "wouter";
import { MODULES, themeForLabel, type ModuleTheme } from "@/lib/modules";
import { ScoreRing } from "@/components/score-ring";
import { Explainer, GuidedTour } from "@/components/teachy";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/use-count-up";

function StatValue({ value }: { value: number }) {
  return <>{useCountUp(value)}</>;
}

export default function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const [detail, setDetail] = useState<ModuleTheme | null>(null);

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-7 w-48 skeleton-shimmer rounded" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 skeleton-shimmer rounded-xl" />)}
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
    { theme: { ...MODULES.devicescan, name: "Deep Scan", href: "/devicescan",
        does: "Pairs with a terminal script on your Mac to check FileVault, firewall, SIP, and Gatekeeper status." },
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

        {/* ── Explore PRISM: module picker, first thing a new user sees ── */}
        <div className="rise-in">
          <div className="relative overflow-hidden">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              Explore PRISM
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Where do you want to start?
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Tap a card to open it, or the <Info className="w-3 h-3 inline -mt-0.5" /> icon for what it does, with an example.
            </p>
            {/* One-time light sweep on first paint — decorative, purely additive */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
              <div
                className="spotlight-sweep absolute top-0 left-0 h-full w-16 opacity-40"
                style={{ background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.5), transparent)" }}
              />
            </div>
          </div>
        </div>

        {/* Compact by design: icon + name only. Full explanation lives one click away in
            the dialog, so 7 destinations don't compete for attention all at once. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {modules.map((m, i) => {
            const Icon = m.theme.icon;
            return (
              <div key={m.theme.name} className="relative group">
                <Link href={m.theme.href} className="block">
                  <div
                    className="relative overflow-hidden rounded-xl border bg-card px-4 py-3.5 h-full hover-lift press-scale rise-in cursor-pointer flex items-center gap-3"
                    style={{ animationDelay: `${120 + i * 50}ms` }}
                  >
                    <div
                      className="pointer-events-none absolute -top-8 -right-8 w-20 h-20 rounded-full opacity-[0.12] blur-xl transition-opacity duration-300 group-hover:opacity-25"
                      style={{ background: m.theme.hsl }}
                    />
                    <div
                      className="icon-pop-in relative w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `color-mix(in srgb, ${m.theme.hsl} 14%, transparent)`, animationDelay: `${200 + i * 50}ms` }}
                    >
                      <Icon className="icon-wiggle w-4 h-4" style={{ color: m.theme.hsl }} />
                    </div>
                    <div className="relative min-w-0 flex-1">
                      <div className="text-sm font-bold truncate" style={{ color: m.theme.hsl }}>
                        {m.theme.name}
                      </div>
                      <div className="text-[0.7rem] text-muted-foreground/70 font-mono tabular-nums">
                        <StatValue value={m.value} /> {m.value === 1 ? "scan" : "scans"}
                      </div>
                    </div>
                    <ArrowUpRight className="relative w-3.5 h-3.5 text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 shrink-0" />
                  </div>
                </Link>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDetail(m.theme); }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-background border flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:text-foreground hover:border-current z-10"
                  aria-label={`What does ${m.theme.name} do?`}
                >
                  <Info className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
          <DialogContent className="sm:max-w-lg">
            {detail && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3 mb-1">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `color-mix(in srgb, ${detail.hsl} 14%, transparent)` }}
                    >
                      <detail.icon className="w-5 h-5" style={{ color: detail.hsl }} />
                    </div>
                    <DialogTitle style={{ color: detail.hsl }}>{detail.name}</DialogTitle>
                  </div>
                  <DialogDescription className="text-sm text-foreground/80 leading-relaxed">
                    {detail.does}
                  </DialogDescription>
                </DialogHeader>
                {detail.example && (
                  <div className="flex gap-2.5 p-3.5 rounded-lg border bg-muted/40 text-sm leading-relaxed">
                    <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">Example</div>
                      {detail.example}
                    </div>
                  </div>
                )}
                <DialogFooter className="sm:justify-between items-center gap-3">
                  <p className="text-xs text-muted-foreground">{detail.protects}</p>
                  <Link href={detail.href} onClick={() => setDetail(null)}>
                    <Button className="press-scale shrink-0">Open {detail.name}</Button>
                  </Link>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* ── Header strip ── */}
        <div className="flex items-start justify-between gap-6 rise-in" style={{ animationDelay: "500ms" }}>
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              Security Overview
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Command Center</h2>
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
