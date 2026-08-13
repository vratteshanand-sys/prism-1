import { useParams } from "wouter";
import { useGetShare, getGetShareQueryKey } from "@workspace/api-client-react";
import type { Finding } from "@workspace/api-client-react";
import { Shield, AlertTriangle, CheckCircle, Info, Loader2, Printer, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoreRing } from "@/components/score-ring";

function severityIcon(severity: string) {
  if (severity === "critical" || severity === "high")
    return <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />;
  if (severity === "medium")
    return <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />;
  return <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />;
}

function severityBadge(severity: string) {
  const map: Record<string, string> = {
    critical: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    high: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    low: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  };
  return map[severity] ?? map.low;
}

function trustColor(score: number) {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export default function SharePage() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";

  const { data, isLoading, isError } = useGetShare(token, {
    query: { queryKey: getGetShareQueryKey(token), enabled: token.length > 0 },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 px-4">
        <Shield className="w-16 h-16 text-muted-foreground/40" />
        <h1 className="text-2xl font-bold">Summary not found</h1>
        <p className="text-muted-foreground text-center max-w-sm">
          This link has expired or does not exist. Scan summaries are valid for
          90 days.
        </p>
        <a href="/" className="text-blue-600 hover:underline text-sm">
          Go to PRISM
        </a>
      </div>
    );
  }

  const hasScore = data.trustScore != null;
  const findings = (data.findings ?? []) as Finding[];
  const critical = findings.filter((f) => f.severity === "critical" || f.severity === "high");
  const moderate = findings.filter((f) => f.severity === "medium");
  const fine = findings.filter((f) => f.severity === "low");

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b bg-card px-6 py-4 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-orange-500 to-purple-600 flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight">PRISM</div>
            <div className="text-xs text-muted-foreground">Know it like you know you</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-muted-foreground">
            Shared scan summary · {new Date(data.createdAt).toLocaleDateString()}
          </div>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="w-3.5 h-3.5 mr-1.5" /> Print / Save as PDF
          </Button>
        </div>
      </header>

      {/* Print-only letterhead */}
      <div className="hidden print:block px-4 pt-8 pb-2">
        <div className="text-lg font-bold tracking-tight">PRISM Compliance Audit Report</div>
        <div className="text-xs text-muted-foreground">Generated {new Date(data.createdAt).toLocaleString()} · Automated screen, not legal advice</div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        {/* Title + module */}
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
            {data.module}
          </div>
          <h1 className="text-2xl font-bold leading-tight">{data.title}</h1>
        </div>

        {/* Score */}
        {hasScore ? (
          <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center p-5 rounded-xl border bg-card">
            <ScoreRing score={data.trustScore!} size={100} strokeWidth={10} />
            <div>
              <div className={`text-3xl font-bold ${trustColor(data.trustScore!)}`}>
                {data.trustScore!}/100
              </div>
              <div className="text-sm font-medium mt-0.5">Trust Score</div>
              <div className="text-sm text-muted-foreground mt-1">
                Risk score: {data.riskScore}/100
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-5 rounded-xl border bg-card">
            <div className="text-3xl font-bold">Risk {data.riskScore}/100</div>
          </div>
        )}

        {/* AI Summary */}
        {data.aiSummary && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Plain-language summary
            </h2>
            <p className="text-base leading-relaxed bg-muted/50 rounded-lg px-4 py-3 border">
              {data.aiSummary}
            </p>
          </section>
        )}

        {/* Findings */}
        {findings.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Findings ({findings.length})
            </h2>
            <div className="space-y-2">
              {[...critical, ...moderate, ...fine].map((f, i) => (
                <div
                  key={i}
                  className="flex gap-3 p-3 rounded-lg border bg-card"
                >
                  {severityIcon(f.severity)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{f.title}</span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${severityBadge(f.severity)}`}
                      >
                        {f.severity}
                      </span>
                      {f.regulation && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full uppercase bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300">
                          <Scale className="w-2.5 h-2.5" /> {f.regulation}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 leading-snug">
                      {f.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {findings.length === 0 && (
          <div className="flex items-center gap-3 p-4 rounded-lg border bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">No issues detected in this scan.</span>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center pt-4 border-t text-xs text-muted-foreground space-y-1">
          <div>Generated by PRISM. This is a point-in-time snapshot.</div>
          <div>
            <a href="/" className="text-blue-600 hover:underline">
              Run your own scan at PRISM
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
