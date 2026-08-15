import { useState } from "react";
import { 
  useCreateFinguardAnalysis, 
  useListFinguardAnalyses, getListFinguardAnalysesQueryKey,
  useGetFinguardAnalysis, getGetFinguardAnalysisQueryKey,
  useDeleteFinguardAnalysis 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRiskColor } from "@/lib/risk-utils";
import { ShieldCheck, Trash2, ChevronLeft, FileSpreadsheet, CheckCircle2, AlertOctagon, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MODULES } from "@/lib/modules";
import { ModuleBanner, Explainer, WhyWhatTo, severityAdvice } from "@/components/teachy";
import { ScoreRing } from "@/components/score-ring";

export default function FinGuard() {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  if (selectedId) {
    return <AnalysisDetail id={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return <AnalysisCreator onSelect={setSelectedId} />;
}

function AnalysisCreator({ onSelect }: { onSelect: (id: number) => void }) {
  const [content, setContent] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createAnalysis = useCreateFinguardAnalysis();
  const { data: history, isLoading } = useListFinguardAnalyses({ query: { queryKey: getListFinguardAnalysesQueryKey() } });
  const deleteAnalysis = useDeleteFinguardAnalysis();

  const handleAnalyze = () => {
    if (!content) return;
    createAnalysis.mutate(
      { data: { content } },
      {
        onSuccess: (res) => {
          queryClient.invalidateQueries({ queryKey: getListFinguardAnalysesQueryKey() });
          onSelect(res.id);
        },
        onError: () => {
          toast({ title: "Analysis Failed", description: "Could not process transactions.", variant: "destructive" });
        }
      }
    );
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteAnalysis.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListFinguardAnalysesQueryKey() })
    });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-noise">
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        <div className="rise-in">
          <h1 className="text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">FinGuard</h1>
          <p className="text-muted-foreground mt-2">Analyze bank transfers and transaction histories for fraud patterns and risk indicators.</p>
        </div>

        <div className="rise-in" style={{ animationDelay: "60ms" }}>
          <ModuleBanner theme={MODULES.finguard} />
        </div>
        <Explainer label="What counts as a fraud pattern?">
          Fraud rarely announces itself. It shows up as patterns: many small
          withdrawals in a row (structuring), transfers to brand-new payees, odd
          hours, round numbers, or destinations known for scams. FinGuard reads your
          transaction list the way a bank fraud analyst would and flags the rows that
          fit those patterns.
        </Explainer>

        <Card className="rise-in glass-panel relative overflow-hidden border-emerald-500/25" style={{ animationDelay: "100ms" }}>
          <div className="pointer-events-none absolute -top-12 -right-12 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl" />
          <CardContent className="relative p-6 grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 items-center">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-2">Why use this</div>
              <p className="text-sm leading-relaxed">
                One suspicious wire transfer buried in a long statement is easy to miss when
                you're skimming. FinGuard doesn't skim — it checks every row against the
                patterns banks themselves use to catch fraud, and tells you exactly which
                transaction to worry about and why, instead of leaving you to eyeball a spreadsheet.
              </p>
            </div>
            <ArrowRight className="hidden lg:block w-5 h-5 text-muted-foreground shrink-0" />
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">See it in action</div>
                <Badge variant="outline" className="text-[0.6rem] uppercase tracking-wide">Example</Badge>
              </div>
              <div className="rounded-lg border border-dashed p-3.5 bg-background/60">
                <div className="text-[0.7rem] font-mono text-muted-foreground mb-2">You paste a row like:</div>
                <code className="block text-xs font-mono bg-muted/60 rounded px-2.5 py-1.5 mb-3">
                  2026-08-13, Wire Transfer, -$50,000, Offshore LLC, 3:14 AM
                </code>
                <div className="text-[0.7rem] font-mono text-muted-foreground mb-2">FinGuard flags:</div>
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <Badge variant="critical" className="uppercase text-[0.6rem]">high</Badge>
                  <span className="text-xs text-muted-foreground">3 signals stacked</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Large amount + brand-new payee + off-hours timing, all in one transaction —
                  with a plain-language reason and what to do next.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="glass-panel relative overflow-hidden hover-lift">
            <div className="pointer-events-none absolute -top-10 -right-10 w-32 h-32 rounded-full bg-emerald-500/10 blur-2xl" />
            <CardHeader className="relative">
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                New Ledger Scan
              </CardTitle>
              <CardDescription>Paste CSV data or plain text transaction records.</CardDescription>
            </CardHeader>
            <CardContent className="relative space-y-4">
              <Textarea
                placeholder="2023-10-01, Wire Transfer, -50000.00, Offshore LLC\n2023-10-02, ATM Withdrawal, -200.00, Local Branch\n..."
                className="font-mono text-xs min-h-[300px]"
                value={content}
                onChange={e => setContent(e.target.value)}
              />
              <Button
                className="w-full font-bold tracking-wide press-scale"
                size="lg"
                disabled={!content || createAnalysis.isPending}
                onClick={handleAnalyze}
              >
                {createAnalysis.isPending ? "Scanning Ledger..." : "Analyze Transactions"}
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-panel flex flex-col h-[600px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Ledger History
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0">
              {isLoading ? (
                <div className="p-6 text-center text-muted-foreground animate-pulse">Loading history...</div>
              ) : history?.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                  <FileSpreadsheet className="w-12 h-12 mb-4 opacity-20" />
                  No previous ledgers found.
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Txns</TableHead>
                      <TableHead className="text-right">Risk</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history?.map((item) => (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer transition-colors duration-200 hover:bg-muted/50"
                        onClick={() => onSelect(item.id)}
                      >
                        <TableCell className="font-medium text-sm whitespace-nowrap">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">{item.transactionCount}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className={`font-mono font-bold ${getRiskColor(item.riskScore)}`}>
                            {item.riskScore}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={(e) => handleDelete(item.id, e)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function AnalysisDetail({ id, onBack }: { id: number, onBack: () => void }) {
  const { data: analysis, isLoading } = useGetFinguardAnalysis(id, { query: { queryKey: getGetFinguardAnalysisQueryKey(id), enabled: !!id } });

  if (isLoading) return <div className="p-12 text-center animate-pulse">Loading report...</div>;
  if (!analysis) return <div className="p-12 text-center">Analysis not found.</div>;

  return (
    <div className="flex-1 overflow-y-auto bg-noise">
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <Button variant="ghost" className="mb-4 -ml-4 text-muted-foreground" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-2" /> Back to History
        </Button>
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="text-sm text-muted-foreground mb-2">{new Date(analysis.createdAt).toLocaleString()}</div>
            <h1 className="text-3xl font-bold tracking-tight">Ledger Analysis Report</h1>
          </div>
          <div className="flex flex-col items-end">
            <ScoreRing score={analysis.riskScore} size={110} label="Fraud Risk" />
            <Explainer className="mt-2" label="How is this scored?">
              Each flagged transaction raises the score based on how strongly it
              matches known fraud patterns. Green means the ledger reads normal; red
              means multiple rows fit patterns that banks treat as serious warnings.
            </Explainer>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 rise-in">
          <Card className="glass-panel relative overflow-hidden hover-lift">
            <div className="pointer-events-none absolute -top-8 -right-8 w-28 h-28 rounded-full bg-emerald-500/10 blur-2xl" />
            <CardHeader className="relative pb-2">
              <CardDescription>Total Transactions</CardDescription>
              <CardTitle className="text-4xl font-mono">{analysis.transactionCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="glass-panel relative overflow-hidden hover-lift border-destructive/20">
            <div className="pointer-events-none absolute -top-8 -right-8 w-28 h-28 rounded-full bg-destructive/10 blur-2xl" />
            <CardHeader className="relative pb-2">
              <CardDescription>Flagged Transactions</CardDescription>
              <CardTitle className="text-4xl font-mono text-destructive">{analysis.flaggedCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="glass-panel md:col-span-3 bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle className="text-primary-foreground flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" /> Executive Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-primary-foreground/90 leading-relaxed text-lg">{analysis.aiSummary}</p>
            </CardContent>
          </Card>
        </div>

        <h2 className="text-xl font-bold mt-8 mb-4">Suspicious Transactions</h2>
        {analysis.flags.length === 0 ? (
          <Card className="bg-emerald-500/10 border-emerald-500/20">
            <CardContent className="flex flex-col items-center justify-center py-12 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-12 h-12 mb-4" />
              <div className="text-xl font-bold">Clean Ledger</div>
              <p>No suspicious transactions or fraud indicators detected.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {analysis.flags.map((flag, i) => {
              const isSevere = flag.severity === 'critical' || flag.severity === 'high';
              return (
              <div
                key={i}
                className="relative flex flex-col md:flex-row gap-4 p-5 rounded-lg border bg-background/50 glass-panel overflow-hidden hover-lift rise-in"
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              >
                <div
                  className="pointer-events-none absolute top-0 left-0 w-1.5 h-full"
                  style={{ background: isSevere ? 'hsl(var(--destructive))' : 'hsl(var(--primary))', opacity: 0.5 }}
                />
                <div className="md:w-1/4 shrink-0 space-y-2">
                  <Badge variant={flag.severity === 'critical' || flag.severity === 'high' ? 'critical' : 'warning'} className="uppercase">
                    {flag.severity}
                  </Badge>
                </div>
                <div className="flex-1">
                  <div className="font-mono text-sm mb-3 pb-3 border-b text-foreground/80 bg-muted/50 p-2 rounded">
                    {flag.transaction}
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <AlertOctagon className={`w-4 h-4 mt-0.5 shrink-0 ${getRiskColor(flag.severity === 'critical' ? 90 : flag.severity === 'high' ? 70 : 40)}`} />
                    <span className="text-foreground leading-relaxed">{flag.reason}</span>
                  </div>
                  <WhyWhatTo
                    why={severityAdvice(flag.severity).why}
                    whatToDo="Confirm this transaction is one you recognize; if not, contact your bank and freeze the account."
                  />
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
