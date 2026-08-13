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
import { Search, Link as LinkIcon, FileText, Cookie, AlertTriangle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MODULES } from "@/lib/modules";
import { ModuleBanner, Explainer } from "@/components/teachy";

export default function TrustLens() {
  return (
    <div className="flex-1 overflow-y-auto bg-noise">
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-cyan-600 dark:text-cyan-400">TrustLens</h1>
          <p className="text-muted-foreground mt-2">Comprehensive suite for analyzing URLs, privacy policies, dark patterns, and threat intel.</p>
        </div>

        <ModuleBanner theme={MODULES.trustlens} />
        <Explainer label="What are dark patterns?">
          Dark patterns are design tricks that push you into choices you would not
          make on your own — like a giant "Accept all" button next to a hidden
          "Reject" link, or guilt-trip wording. TrustLens spots those tricks in links,
          privacy policies, and cookie banners so you can see the manipulation before
          it works on you.
        </Explainer>

        <Tabs defaultValue="url" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto md:h-14 bg-muted/50 p-1 rounded-xl gap-1">
            <TabsTrigger value="url" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm font-medium h-full gap-2">
              <LinkIcon className="w-4 h-4" /> URL Inspector
            </TabsTrigger>
            <TabsTrigger value="policy" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm font-medium h-full gap-2">
              <FileText className="w-4 h-4" /> Policy Analyzer
            </TabsTrigger>
            <TabsTrigger value="cookie" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm font-medium h-full gap-2">
              <Cookie className="w-4 h-4" /> Cookie Decoder
            </TabsTrigger>
            <TabsTrigger value="threat" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm font-medium h-full gap-2">
              <AlertTriangle className="w-4 h-4" /> Threat Intel
            </TabsTrigger>
          </TabsList>

          <div className="mt-8">
            <TabsContent value="url">
              <UrlInspector />
            </TabsContent>
            <TabsContent value="policy">
              <PolicyAnalyzer />
            </TabsContent>
            <TabsContent value="cookie">
              <CookieDecoder />
            </TabsContent>
            <TabsContent value="threat">
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
          <CardTitle>Inspect URL</CardTitle>
          <CardDescription>Check a link for phishing and deception signals.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="https://example.com" value={url} onChange={e => setUrl(e.target.value)} />
          <Button className="w-full" disabled={!url || createReq.isPending} onClick={handleRun}>
            {createReq.isPending ? "Inspecting..." : "Scan URL"}
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
                    <div>
                      <div className="font-bold">{f.title}</div>
                      <div className="text-muted-foreground">{f.detail}</div>
                    </div>
                  </div>
                ))}
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
          <CardTitle>Privacy Policy Analyzer</CardTitle>
          <CardDescription>Extract red flags and user rights from privacy policies.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea placeholder="Paste privacy policy text..." className="min-h-[200px]" value={text} onChange={e => setText(e.target.value)} />
          <Button className="w-full" disabled={!text || createReq.isPending} onClick={handleRun}>
            {createReq.isPending ? "Analyzing Policy..." : "Analyze Policy"}
          </Button>

          {createReq.data && (
            <div className="mt-8 p-6 bg-muted/30 rounded-lg border border-border/50 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Analysis Result</div>
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
                    <div>
                      <div className="font-bold text-red-700 dark:text-red-400">{f.title}</div>
                      <div className="text-muted-foreground text-xs mt-1">{f.detail}</div>
                    </div>
                  </div>
                ))}
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
          <CardTitle>Cookie Decoder</CardTitle>
          <CardDescription>Analyze cookie consent banners for manipulation and dark patterns.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea placeholder="Paste cookie banner text..." className="min-h-[200px]" value={text} onChange={e => setText(e.target.value)} />
          <Button className="w-full" disabled={!text || createReq.isPending} onClick={handleRun}>
            {createReq.isPending ? "Decoding..." : "Decode Banner"}
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
                    <div>
                      <div className="font-bold">{f.title}</div>
                      <div className="text-muted-foreground text-xs mt-1">{f.detail}</div>
                    </div>
                  </div>
                ))}
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
