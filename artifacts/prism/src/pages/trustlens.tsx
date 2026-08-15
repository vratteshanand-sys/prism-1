import { useState } from "react";
import { 
  useCreateUrlInspection, useListUrlInspections, getListUrlInspectionsQueryKey,
  useCreatePolicyAnalysis, useListPolicyAnalyses, getListPolicyAnalysesQueryKey,
  useCreateCookieAnalysis, useListCookieAnalyses, getListCookieAnalysesQueryKey,
  useListThreatIntel, getListThreatIntelQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getRiskColor } from "@/lib/risk-utils";
import { Search, Link as LinkIcon, FileText, Cookie, AlertTriangle, AlertCircle, ClipboardList, Scale, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MODULES } from "@/lib/modules";
import { ModuleBanner, Explainer } from "@/components/teachy";
import { ShareButton } from "@/components/share-button";
import { useCountUp } from "@/hooks/use-count-up";

function StatValue({ value }: { value: number }) {
  return <>{useCountUp(value)}</>;
}

/** Regulation citation chip — shown on findings that map to a specific compliance clause */
function RegulationTag({ regulation }: { regulation?: string | null }) {
  if (!regulation) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full uppercase bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300">
      <Scale className="w-2.5 h-2.5" /> {regulation}
    </span>
  );
}

export default function TrustLens() {
  return (
    <div className="flex-1 overflow-y-auto bg-noise">
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div className="rise-in">
          <h1 className="text-3xl font-bold tracking-tight text-cyan-600 dark:text-cyan-400">TrustLens Compliance Audit</h1>
          <p className="text-muted-foreground mt-2">Automated GDPR, CCPA, and dark-pattern compliance screening for URLs, privacy policies, and cookie consent flows — with regulation citations and exportable audit reports.</p>
        </div>

        <div className="rise-in" style={{ animationDelay: "60ms" }}>
          <ModuleBanner theme={MODULES.trustlens} />
        </div>
        <Explainer label="What does a compliance screen check?">
          TrustLens screens URLs, privacy policies, and cookie consent banners against
          patterns regulators flag under GDPR, CCPA, and the EU's dark-pattern rules —
          things like consent bundling, hidden reject options, and vague retention
          language. Each finding cites the specific regulation it may implicate where
          applicable. This is an automated first-pass screen, not legal advice — use it
          to triage what a human reviewer should look at next.
        </Explainer>

        <Card className="rise-in glass-panel relative overflow-hidden border-cyan-500/25" style={{ animationDelay: "100ms" }}>
          <div className="pointer-events-none absolute -top-12 -right-12 w-48 h-48 rounded-full bg-cyan-500/10 blur-3xl" />
          <CardContent className="relative p-6 grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 items-center">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400 mb-2">Why use this</div>
              <p className="text-sm leading-relaxed">
                Dark patterns and shaky privacy terms aren't always obvious from reading —
                they're designed to slip past you. TrustLens screens the exact link, policy,
                or banner text against patterns regulators already recognize, and names the
                specific law it may violate, so you're not guessing whether something's actually a problem.
              </p>
            </div>
            <ArrowRight className="hidden lg:block w-5 h-5 text-muted-foreground shrink-0" />
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">See it in action</div>
                <Badge variant="outline" className="text-[0.6rem] uppercase tracking-wide">Example</Badge>
              </div>
              <div className="rounded-lg border border-dashed p-3.5 bg-background/60 space-y-3">
                <div>
                  <div className="text-[0.7rem] font-mono text-muted-foreground mb-1">A checkout link like:</div>
                  <code className="block text-[0.7rem] font-mono bg-muted/60 rounded px-2 py-1 mb-1 truncate">shop.example.com/cart?utm=urgent-offer</code>
                  <div className="flex items-center gap-1.5"><RegulationTag regulation="EU DSA Art. 25" /> <span className="text-xs text-muted-foreground">dark-pattern signal</span></div>
                </div>
                <div>
                  <div className="text-[0.7rem] font-mono text-muted-foreground mb-1">A cookie banner where "Accept All" is huge and "Reject" is tiny gray text:</div>
                  <div className="flex items-center gap-1.5"><RegulationTag regulation="GDPR Art. 7(3)" /> <span className="text-xs text-muted-foreground">consent imbalance flagged</span></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="url" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto md:h-14 bg-muted/50 p-1 rounded-xl gap-1">
            <TabsTrigger value="url" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm font-medium h-full gap-2 transition-all duration-200">
              <LinkIcon className="w-4 h-4" /> URL Screen
            </TabsTrigger>
            <TabsTrigger value="policy" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm font-medium h-full gap-2 transition-all duration-200">
              <FileText className="w-4 h-4" /> Policy Review
            </TabsTrigger>
            <TabsTrigger value="cookie" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm font-medium h-full gap-2 transition-all duration-200">
              <Cookie className="w-4 h-4" /> Consent Check
            </TabsTrigger>
            <TabsTrigger value="trail" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm font-medium h-full gap-2 transition-all duration-200">
              <ClipboardList className="w-4 h-4" /> Audit Trail
            </TabsTrigger>
            <TabsTrigger value="threat" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm font-medium h-full gap-2 transition-all duration-200">
              <AlertTriangle className="w-4 h-4" /> Threat Intel
            </TabsTrigger>
          </TabsList>

          <div className="mt-8">
            <TabsContent value="url" className="tab-fade-in">
              <UrlInspector />
            </TabsContent>
            <TabsContent value="policy" className="tab-fade-in">
              <PolicyAnalyzer />
            </TabsContent>
            <TabsContent value="cookie" className="tab-fade-in">
              <CookieDecoder />
            </TabsContent>
            <TabsContent value="trail" className="tab-fade-in">
              <AuditTrail />
            </TabsContent>
            <TabsContent value="threat" className="tab-fade-in">
              <ThreatIntel />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

function UrlInspector() {
  const [url, setUrl] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createReq = useCreateUrlInspection();
  const { data: history, isLoading } = useListUrlInspections({ query: { queryKey: getListUrlInspectionsQueryKey() } });

  const handleRun = () => {
    if (!url) return;
    createReq.mutate({ data: { url } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListUrlInspectionsQueryKey() }),
      onError: () => toast({ title: "Error", description: "Failed to inspect URL.", variant: "destructive" })
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>URL Compliance Screen</CardTitle>
          <CardDescription>Check a link for phishing, deception, and dark-pattern signals, with regulation citations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="https://example.com" value={url} onChange={e => setUrl(e.target.value)} />
          <Button className="w-full" disabled={!url || createReq.isPending} onClick={handleRun}>
            {createReq.isPending ? "Screening..." : "Run Compliance Screen"}
          </Button>

          {createReq.data && (
            <div className="mt-8 p-6 bg-muted/30 rounded-lg border border-border/50 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between mb-4">
                <Badge variant={createReq.data.verdict === 'safe' ? 'safe' : createReq.data.verdict === 'suspicious' ? 'warning' : 'critical'} className="uppercase px-3 py-1">
                  {createReq.data.verdict}
                </Badge>
                <div className={`font-mono font-bold text-2xl ${getRiskColor(createReq.data.riskScore)}`}>
                  {createReq.data.riskScore}/100
                </div>
              </div>
              <p className="text-sm font-medium mb-4">{createReq.data.aiSummary}</p>

              <div className="space-y-3 mt-4">
                {createReq.data.findings.map((f, i) => (
                  <div key={i} className="flex gap-3 text-sm p-3 bg-background rounded border">
                    <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${f.severity === 'high' || f.severity === 'critical' ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}`} />
                    <div className="space-y-1">
                      <div className="font-bold">{f.title}</div>
                      <div className="text-muted-foreground">{f.detail}</div>
                      <RegulationTag regulation={f.regulation} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 pt-4 border-t flex justify-end">
                <ShareButton
                  module="TrustLens · URL Compliance Screen"
                  title={url}
                  riskScore={createReq.data.riskScore}
                  aiSummary={createReq.data.aiSummary}
                  findings={createReq.data.findings}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-panel h-[600px] flex flex-col">
        <CardHeader>
          <CardTitle>Recent URL Scans</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-0">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0">
              <TableRow>
                <TableHead>URL</TableHead>
                <TableHead>Verdict</TableHead>
                <TableHead className="text-right">Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs truncate max-w-[200px]">{item.url}</TableCell>
                  <TableCell>
                    <Badge variant={item.verdict === 'safe' ? 'safe' : item.verdict === 'suspicious' ? 'warning' : 'critical'} className="text-[0.65rem] uppercase">
                      {item.verdict}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-right font-mono font-bold ${getRiskColor(item.riskScore)}`}>
                    {item.riskScore}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function PolicyAnalyzer() {
  const [text, setText] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createReq = useCreatePolicyAnalysis();
  const { data: history, isLoading } = useListPolicyAnalyses({ query: { queryKey: getListPolicyAnalysesQueryKey() } });

  const handleRun = () => {
    if (!text) return;
    createReq.mutate({ data: { text } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListPolicyAnalysesQueryKey() }),
      onError: () => toast({ title: "Error", description: "Failed to analyze policy.", variant: "destructive" })
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>Privacy Policy Compliance Review</CardTitle>
          <CardDescription>Extract regulation-mapped red flags and user rights from a privacy policy.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea placeholder="Paste privacy policy text..." className="min-h-[200px]" value={text} onChange={e => setText(e.target.value)} />
          <Button className="w-full" disabled={!text || createReq.isPending} onClick={handleRun}>
            {createReq.isPending ? "Reviewing Policy..." : "Run Compliance Review"}
          </Button>

          {createReq.data && (
            <div className="mt-8 p-6 bg-muted/30 rounded-lg border border-border/50 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Compliance Review Result</div>
                <div className={`font-mono font-bold text-2xl ${getRiskColor(createReq.data.riskScore)}`}>
                  {createReq.data.riskScore}/100 Risk
                </div>
              </div>
              <p className="text-sm font-medium mb-6">{createReq.data.aiSummary}</p>

              <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                <div className="p-3 bg-background rounded border">
                  <div className="font-bold text-muted-foreground mb-1 text-xs uppercase">Data Retention</div>
                  {createReq.data.retention}
                </div>
                <div className="p-3 bg-background rounded border">
                  <div className="font-bold text-muted-foreground mb-1 text-xs uppercase">User Rights</div>
                  <ul className="list-disc pl-4 space-y-1 text-xs">
                    {createReq.data.userRights.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              </div>

              <div className="space-y-3">
                <div className="font-bold text-sm">Red Flags</div>
                {createReq.data.redFlags.map((f, i) => (
                  <div key={i} className="flex gap-3 text-sm p-3 bg-background rounded border border-red-500/20">
                    <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 text-red-500`} />
                    <div className="space-y-1">
                      <div className="font-bold text-red-700 dark:text-red-400">{f.title}</div>
                      <div className="text-muted-foreground text-xs mt-1">{f.detail}</div>
                      <RegulationTag regulation={f.regulation} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 pt-4 border-t flex justify-end">
                <ShareButton
                  module="TrustLens · Privacy Policy Compliance Review"
                  title={text.slice(0, 80)}
                  riskScore={createReq.data.riskScore}
                  aiSummary={createReq.data.aiSummary}
                  findings={createReq.data.redFlags}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-panel h-[600px] flex flex-col">
        <CardHeader>
          <CardTitle>Recent Policy Scans</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-0">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0">
              <TableRow>
                <TableHead>Excerpt</TableHead>
                <TableHead>Retention</TableHead>
                <TableHead className="text-right">Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-xs italic text-muted-foreground truncate max-w-[150px]">"{item.excerpt}..."</TableCell>
                  <TableCell className="text-xs">{item.retention}</TableCell>
                  <TableCell className={`text-right font-mono font-bold ${getRiskColor(item.riskScore)}`}>
                    {item.riskScore}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function CookieDecoder() {
  const [text, setText] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createReq = useCreateCookieAnalysis();
  const { data: history, isLoading } = useListCookieAnalyses({ query: { queryKey: getListCookieAnalysesQueryKey() } });

  const handleRun = () => {
    if (!text) return;
    createReq.mutate({ data: { text } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListCookieAnalysesQueryKey() }),
      onError: () => toast({ title: "Error", description: "Failed to decode cookies.", variant: "destructive" })
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>Cookie Consent Compliance Check</CardTitle>
          <CardDescription>Analyze cookie consent banners for manipulation, dark patterns, and consent defects.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea placeholder="Paste cookie banner text..." className="min-h-[200px]" value={text} onChange={e => setText(e.target.value)} />
          <Button className="w-full" disabled={!text || createReq.isPending} onClick={handleRun}>
            {createReq.isPending ? "Checking Consent Flow..." : "Run Consent Check"}
          </Button>

          {createReq.data && (
            <div className="mt-8 p-6 bg-muted/30 rounded-lg border border-border/50 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between mb-4">
                <Badge variant={createReq.data.verdict === 'fair' ? 'safe' : createReq.data.verdict === 'questionable' ? 'warning' : 'critical'} className="uppercase px-3 py-1">
                  {createReq.data.verdict}
                </Badge>
                <div className={`font-mono font-bold text-2xl ${getRiskColor(createReq.data.manipulationScore)}`}>
                  {createReq.data.manipulationScore}/100 Manipulation
                </div>
              </div>
              <p className="text-sm font-medium mb-4">{createReq.data.aiSummary}</p>

              <div className="space-y-3 mt-4">
                <div className="font-bold text-sm">Detected Tactics</div>
                {createReq.data.tactics.map((f, i) => (
                  <div key={i} className="flex gap-3 text-sm p-3 bg-background rounded border">
                    <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${f.severity === 'high' || f.severity === 'critical' ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}`} />
                    <div className="space-y-1">
                      <div className="font-bold">{f.title}</div>
                      <div className="text-muted-foreground text-xs mt-1">{f.detail}</div>
                      <RegulationTag regulation={f.regulation} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 pt-4 border-t flex justify-end">
                <ShareButton
                  module="TrustLens · Cookie Consent Compliance Check"
                  title={text.slice(0, 80)}
                  riskScore={createReq.data.manipulationScore}
                  aiSummary={createReq.data.aiSummary}
                  findings={createReq.data.tactics}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-panel h-[600px] flex flex-col">
        <CardHeader>
          <CardTitle>Recent Cookie Scans</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-0">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0">
              <TableRow>
                <TableHead>Excerpt</TableHead>
                <TableHead>Verdict</TableHead>
                <TableHead className="text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-xs italic text-muted-foreground truncate max-w-[150px]">"{item.excerpt}..."</TableCell>
                  <TableCell>
                    <Badge variant={item.verdict === 'fair' ? 'safe' : item.verdict === 'questionable' ? 'warning' : 'critical'} className="text-[0.65rem] uppercase">
                      {item.verdict}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-right font-mono font-bold ${getRiskColor(item.manipulationScore)}`}>
                    {item.manipulationScore}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

type AuditRow = {
  id: number;
  type: "URL Screen" | "Policy Review" | "Consent Check";
  label: string;
  score: number;
  regulationCount: number;
  createdAt: string;
};

function AuditTrail() {
  const { data: urls } = useListUrlInspections({ query: { queryKey: getListUrlInspectionsQueryKey() } });
  const { data: policies } = useListPolicyAnalyses({ query: { queryKey: getListPolicyAnalysesQueryKey() } });
  const { data: cookies } = useListCookieAnalyses({ query: { queryKey: getListCookieAnalysesQueryKey() } });

  const rows: AuditRow[] = [
    ...(urls ?? []).map((r): AuditRow => ({
      id: r.id, type: "URL Screen", label: r.url, score: r.riskScore,
      regulationCount: r.findings.filter(f => f.regulation).length, createdAt: r.createdAt,
    })),
    ...(policies ?? []).map((r): AuditRow => ({
      id: r.id, type: "Policy Review", label: r.excerpt, score: r.riskScore,
      regulationCount: r.redFlags.filter(f => f.regulation).length, createdAt: r.createdAt,
    })),
    ...(cookies ?? []).map((r): AuditRow => ({
      id: r.id, type: "Consent Check", label: r.excerpt, score: r.manipulationScore,
      regulationCount: r.tactics.filter(f => f.regulation).length, createdAt: r.createdAt,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalRegulationCitations = rows.reduce((sum, r) => sum + r.regulationCount, 0);
  const isLoading = !urls || !policies || !cookies;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Screens", value: rows.length, hsl: MODULES.trustlens.hsl },
          { label: "Regulation Citations", value: totalRegulationCitations, hsl: "hsl(189 70% 40%)" },
          { label: "URL Screens", value: urls?.length ?? 0, hsl: MODULES.supplychain.hsl },
          { label: "Policy + Consent Reviews", value: (policies?.length ?? 0) + (cookies?.length ?? 0), hsl: MODULES.finguard.hsl },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className="relative overflow-hidden rounded-xl border bg-card p-4 hover-lift rise-in"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div
              className="pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-[0.1] blur-xl"
              style={{ background: stat.hsl }}
            />
            <div className="relative text-xs uppercase text-muted-foreground font-bold tracking-wide">{stat.label}</div>
            <div className="relative text-2xl font-mono font-bold mt-1 tabular-nums" style={{ color: stat.hsl }}>
              <StatValue value={stat.value} />
            </div>
          </div>
        ))}
      </div>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>Unified Audit Trail</CardTitle>
          <CardDescription>Every compliance screen run across TrustLens, in one chronological log.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center animate-pulse text-sm text-muted-foreground">Loading audit trail...</div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">No compliance screens run yet.</div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0">
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Regulations Cited</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={`${r.type}-${r.id}`}>
                    <TableCell><Badge variant="outline" className="text-[0.65rem] uppercase">{r.type}</Badge></TableCell>
                    <TableCell className="font-mono text-xs truncate max-w-[280px]">{r.label}</TableCell>
                    <TableCell className="text-xs">{r.regulationCount > 0 ? r.regulationCount : "—"}</TableCell>
                    <TableCell className={`text-right font-mono font-bold ${getRiskColor(r.score)}`}>{r.score}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ThreatIntel() {
  const [search, setSearch] = useState("");
  const { data: intel, isLoading } = useListThreatIntel({ query: { queryKey: getListThreatIntelQueryKey() } });

  const filtered = intel?.filter(i => 
    i.name.toLowerCase().includes(search.toLowerCase()) || 
    i.category.toLowerCase().includes(search.toLowerCase()) ||
    i.description.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <Card className="glass-panel">
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle>Threat Intelligence Database</CardTitle>
            <CardDescription>Search known dark patterns and manipulative tactics.</CardDescription>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input 
              className="pl-9" 
              placeholder="Search tactics..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="p-12 text-center animate-pulse">Loading database...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filtered.map(entry => (
              <Card key={entry.id} className="bg-background/50 border-border hover:border-primary/50 transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <Badge variant="outline" className="text-[0.65rem] uppercase tracking-wider">{entry.category}</Badge>
                    <Badge variant={entry.severity === 'critical' || entry.severity === 'high' ? 'critical' : 'warning'} className="uppercase text-[0.65rem]">
                      {entry.severity}
                    </Badge>
                  </div>
                  <h3 className="font-bold text-lg mb-2">{entry.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-3 leading-relaxed">{entry.description}</p>
                  <div className="flex items-center justify-between text-xs pt-3 border-t">
                    <span className="font-mono bg-muted px-2 py-0.5 rounded">{entry.prevalence}</span>
                    <span className="text-muted-foreground truncate ml-4" title={entry.platforms.join(", ")}>
                      {entry.platforms.join(", ")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
