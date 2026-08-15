import { useState } from "react";
import { 
  useCreateSentinelAnalysis, 
  useListSentinelAnalyses, getListSentinelAnalysesQueryKey,
  useGetSentinelAnalysis, getGetSentinelAnalysisQueryKey,
  useDeleteSentinelAnalysis 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRiskColor, getRiskBadgeVariant } from "@/lib/risk-utils";
import { Fingerprint, Trash2, Search, ChevronLeft, Bot, AlertTriangle, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { MODULES } from "@/lib/modules";
import { ModuleBanner, Explainer, WhyWhatTo, severityAdvice } from "@/components/teachy";
import { ScoreRing } from "@/components/score-ring";

export default function Sentinel() {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  if (selectedId) {
    return <AnalysisDetail id={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return <AnalysisCreator onSelect={setSelectedId} />;
}

function AnalysisCreator({ onSelect }: { onSelect: (id: number) => void }) {
  const [text, setText] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createAnalysis = useCreateSentinelAnalysis();
  const { data: history, isLoading } = useListSentinelAnalyses({ query: { queryKey: getListSentinelAnalysesQueryKey() } });
  const deleteAnalysis = useDeleteSentinelAnalysis();

  const handleAnalyze = () => {
    if (!text) return;
    createAnalysis.mutate(
      { data: { text } },
      {
        onSuccess: (res) => {
          queryClient.invalidateQueries({ queryKey: getListSentinelAnalysesQueryKey() });
          onSelect(res.id);
        },
        onError: () => {
          toast({ title: "Analysis Failed", description: "Could not process text.", variant: "destructive" });
        }
      }
    );
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteAnalysis.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListSentinelAnalysesQueryKey() })
    });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-noise">
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        <div className="rise-in">
          <h1 className="text-3xl font-bold tracking-tight text-violet-600 dark:text-violet-400">Sentinel AI</h1>
          <p className="text-muted-foreground mt-2">Analyze AI-generated content across 6 dimensions of safety, bias, and factuality.</p>
        </div>

        <div className="rise-in" style={{ animationDelay: "60ms" }}>
          <ModuleBanner theme={MODULES.sentinel} />
        </div>
        <Explainer label="Why analyze AI text at all?">
          AI writing tools sound confident even when they are wrong, biased, or unsafe.
          Sentinel reads the text like a skeptical editor: it grades six separate
          dimensions (safety, factuality, toxicity, bias, coherence, and hallucination
          risk) and points at the exact sentences that triggered concern.
        </Explainer>

        <Card className="rise-in glass-panel relative overflow-hidden border-violet-500/25" style={{ animationDelay: "100ms" }}>
          <div className="pointer-events-none absolute -top-12 -right-12 w-48 h-48 rounded-full bg-violet-500/10 blur-3xl" />
          <CardContent className="relative p-6 grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 items-center">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400 mb-2">Why use this</div>
              <p className="text-sm leading-relaxed">
                AI-written content sounds confident whether or not it's true. If you publish,
                send, or act on AI output without checking it, a single fabricated statistic
                or unsafe claim can slip straight through. Sentinel reads it first and tells
                you exactly which sentence to double-check, and why.
              </p>
            </div>
            <ArrowRight className="hidden lg:block w-5 h-5 text-muted-foreground shrink-0" />
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">See it in action</div>
                <Badge variant="outline" className="text-[0.6rem] uppercase tracking-wide">Example</Badge>
              </div>
              <div className="rounded-lg border border-dashed p-3.5 bg-background/60">
                <div className="text-[0.7rem] font-mono text-muted-foreground mb-2">You paste an AI-written paragraph claiming:</div>
                <div className="text-xs italic bg-muted/60 rounded px-2.5 py-1.5 mb-3">
                  "...a 2019 study showing 73% of users prefer this approach..."
                </div>
                <div className="text-[0.7rem] font-mono text-muted-foreground mb-2">Sentinel flags:</div>
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <Badge variant="outline" className="uppercase text-[0.6rem] font-mono">hallucination risk</Badge>
                  <Badge variant="critical" className="uppercase text-[0.6rem]">high</Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  That specific, uncited statistic is a classic fabrication pattern — sounds
                  precise, cites nothing checkable. You'd see this exact sentence highlighted
                  with the reason, before you ever repeat it as fact.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="glass-panel relative overflow-hidden hover-lift">
            <div className="pointer-events-none absolute -top-10 -right-10 w-32 h-32 rounded-full bg-violet-500/10 blur-2xl" />
            <CardHeader className="relative">
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                New Analysis
              </CardTitle>
              <CardDescription>Paste LLM output or generated text here.</CardDescription>
            </CardHeader>
            <CardContent className="relative space-y-4">
              <Textarea
                placeholder="Paste generated text to analyze..."
                className="min-h-[300px] text-base leading-relaxed"
                value={text}
                onChange={e => setText(e.target.value)}
              />
              <Button
                className="w-full font-bold tracking-wide press-scale"
                size="lg"
                disabled={!text || createAnalysis.isPending}
                onClick={handleAnalyze}
              >
                {createAnalysis.isPending ? "Analyzing Dimensions..." : "Inspect Content"}
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-panel flex flex-col h-[600px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Fingerprint className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                Analysis History
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0">
              {isLoading ? (
                <div className="p-6 text-center text-muted-foreground animate-pulse">Loading history...</div>
              ) : history?.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                  <Bot className="w-12 h-12 mb-4 opacity-20" />
                  No previous analyses found.
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0">
                    <TableRow>
                      <TableHead>Excerpt</TableHead>
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
                        <TableCell className="font-medium text-sm truncate max-w-[200px] italic text-muted-foreground">
                          "{item.textExcerpt}..."
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={getRiskBadgeVariant(item.overallRisk)} className="font-mono">
                            {item.overallRisk}
                          </Badge>
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
  const { data: analysis, isLoading } = useGetSentinelAnalysis(id, { query: { queryKey: getGetSentinelAnalysisQueryKey(id), enabled: !!id } });

  if (isLoading) return <div className="p-12 text-center animate-pulse">Loading report...</div>;
  if (!analysis) return <div className="p-12 text-center">Analysis not found.</div>;

  const radarData = [
    { subject: 'Safety', A: analysis.scores.safety, fullMark: 100 },
    { subject: 'Factuality', A: analysis.scores.factuality, fullMark: 100 },
    { subject: 'Toxicity', A: analysis.scores.toxicity, fullMark: 100 },
    { subject: 'Bias', A: analysis.scores.bias, fullMark: 100 },
    { subject: 'Coherence', A: analysis.scores.coherence, fullMark: 100 },
    { subject: 'Hallucination', A: analysis.scores.hallucinationRisk, fullMark: 100 },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-noise">
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <Button variant="ghost" className="mb-4 -ml-4 text-muted-foreground" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-2" /> Back to History
        </Button>
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="text-sm text-muted-foreground mb-2">{new Date(analysis.createdAt).toLocaleString()}</div>
            <h1 className="text-3xl font-bold tracking-tight">Sentinel Report</h1>
            <Badge variant={getRiskBadgeVariant(analysis.overallRisk)} className="mt-2 text-sm px-3 py-1 uppercase tracking-wider">
              {analysis.riskLevel} Risk
            </Badge>
          </div>
          <div className="flex flex-col items-end">
            <ScoreRing score={analysis.overallRisk} size={110} label="Overall Risk" />
            <Explainer className="mt-2" label="What does this score mean?">
              This blends all six dimensions into one number. Low (green) means the
              text reads as safe and grounded; high (red) means it contains claims or
              language you should not trust without checking.
            </Explainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="glass-panel lg:col-span-2">
            <CardHeader>
              <CardTitle>AI Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg leading-relaxed text-foreground/80">{analysis.aiSummary}</p>
              
              <div className="mt-6 p-4 bg-muted/30 rounded-lg border border-border/50 italic text-sm text-muted-foreground">
                "{analysis.textExcerpt}..."
              </div>
            </CardContent>
          </Card>
          
          <Card className="glass-panel flex flex-col items-center justify-center p-6">
            <div className="w-full h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "hsl(var(--foreground))", fontSize: 12, fontWeight: 600 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar
                    name="Risk"
                    dataKey="A"
                    stroke="hsl(262 83% 58%)"
                    fill="hsl(262 83% 58%)"
                    fillOpacity={0.3}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-xs text-muted-foreground text-center mt-2">Higher score = Higher risk in dimension</div>
          </Card>
        </div>

        <h2 className="text-xl font-bold mt-8 mb-4">Flagged Sentences</h2>
        {analysis.flags.length === 0 ? (
          <div className="p-8 text-center border rounded-lg bg-emerald-500/5 border-emerald-500/20 text-emerald-600">
            No specific sentences were flagged for risk.
          </div>
        ) : (
          <div className="space-y-4">
            {analysis.flags.map((flag, i) => (
              <div
                key={i}
                className="flex flex-col md:flex-row gap-4 p-5 rounded-lg border bg-background/50 glass-panel hover-lift rise-in"
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              >
                <div className="md:w-1/4 shrink-0 space-y-2">
                  <Badge variant="outline" className="uppercase font-mono text-[0.65rem] tracking-wider">{flag.dimension}</Badge>
                  <div>
                    <Badge variant={flag.severity === 'critical' || flag.severity === 'high' ? 'critical' : 'warning'} className="uppercase">
                      {flag.severity}
                    </Badge>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="font-serif italic text-lg mb-3 pb-3 border-b text-foreground/90">
                    "{flag.sentence}"
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${getRiskColor(flag.severity === 'critical' ? 90 : flag.severity === 'high' ? 70 : 40)}`} />
                    <span className="text-muted-foreground">{flag.explanation}</span>
                  </div>
                  <WhyWhatTo
                    why={severityAdvice(flag.severity).why}
                    whatToDo="Verify this sentence against a trusted source before repeating or publishing it."
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
