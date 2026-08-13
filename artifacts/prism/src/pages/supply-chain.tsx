import { useState } from "react";
import { 
  useCreateSupplyChainScan, 
  useListSupplyChainScans, getListSupplyChainScansQueryKey,
  useGetSupplyChainScan, getGetSupplyChainScanQueryKey,
  useDeleteSupplyChainScan 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRiskColor } from "@/lib/risk-utils";
import { ShieldAlert, Trash2, Search, ChevronLeft, Package, FileCode, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MODULES } from "@/lib/modules";
import { ModuleBanner, Explainer, WhyWhatTo, severityAdvice } from "@/components/teachy";
import { ScoreRing } from "@/components/score-ring";

export default function SupplyChain() {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  if (selectedId) {
    return <ScanDetail id={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return <ScanCreator onSelect={setSelectedId} />;
}

function ScanCreator({ onSelect }: { onSelect: (id: number) => void }) {
  const [filename, setFilename] = useState("");
  const [content, setContent] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createScan = useCreateSupplyChainScan();
  const { data: history, isLoading } = useListSupplyChainScans({ query: { queryKey: getListSupplyChainScansQueryKey() } });
  const deleteScan = useDeleteSupplyChainScan();

  const handleScan = () => {
    if (!filename || !content) return;
    createScan.mutate(
      { data: { filename, content } },
      {
        onSuccess: (res) => {
          queryClient.invalidateQueries({ queryKey: getListSupplyChainScansQueryKey() });
          onSelect(res.id);
        },
        onError: () => {
          toast({ title: "Scan Failed", description: "Could not analyze the file.", variant: "destructive" });
        }
      }
    );
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteScan.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListSupplyChainScansQueryKey() })
    });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-noise">
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-amber-600 dark:text-amber-400">Supply Chain DNA</h1>
          <p className="text-muted-foreground mt-2">Upload or paste dependency manifests (package.json, requirements.txt) to analyze vulnerability exposure.</p>
        </div>

        <ModuleBanner theme={MODULES.supplychain} />
        <Explainer label="What is a dependency manifest?">
          Modern software is built like a recipe: your app is the dish, and it pulls in
          dozens of ready-made ingredients (packages) listed in a file like{" "}
          <span className="font-mono">package.json</span>. If one ingredient is spoiled — has a
          known security hole — your whole app inherits the problem. This scan checks every
          ingredient against a live database of known vulnerabilities.
        </Explainer>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="glass-panel border-amber-500/30 shadow-lg shadow-amber-500/5 border-t-4 border-t-amber-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                New Scan
              </CardTitle>
              <CardDescription>Paste your manifest file content here.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Filename</label>
                <Input 
                  placeholder="e.g. package.json" 
                  value={filename} 
                  onChange={e => setFilename(e.target.value)} 
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">File Content</label>
                <Textarea 
                  placeholder='{\n  "dependencies": {\n    "express": "^4.17.1"\n  }\n}' 
                  className="font-mono text-xs min-h-[200px]"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                />
              </div>
              <Button 
                className="w-full font-bold tracking-wide" 
                size="lg"
                disabled={!filename || !content || createScan.isPending}
                onClick={handleScan}
              >
                {createScan.isPending ? "Analyzing DNA..." : "Scan Manifest"}
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-panel flex flex-col h-[500px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                Scan History
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0">
              {isLoading ? (
                <div className="p-6 text-center text-muted-foreground animate-pulse">Loading history...</div>
              ) : history?.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                  <Package className="w-12 h-12 mb-4 opacity-20" />
                  No previous scans found.
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0">
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Ecosystem</TableHead>
                      <TableHead className="text-right">Risk</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history?.map((scan) => (
                      <TableRow 
                        key={scan.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => onSelect(scan.id)}
                      >
                        <TableCell className="font-medium truncate max-w-[150px]">{scan.filename}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[0.65rem]">{scan.ecosystem}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className={`font-mono font-bold ${getRiskColor(scan.riskScore)}`}>
                            {scan.riskScore}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={(e) => handleDelete(scan.id, e)}>
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

function ScanDetail({ id, onBack }: { id: number, onBack: () => void }) {
  const { data: scan, isLoading } = useGetSupplyChainScan(id, { query: { queryKey: getGetSupplyChainScanQueryKey(id), enabled: !!id } });

  if (isLoading) return <div className="p-12 text-center animate-pulse">Loading report...</div>;
  if (!scan) return <div className="p-12 text-center">Scan not found.</div>;

  return (
    <div className="flex-1 overflow-y-auto bg-noise">
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <Button variant="ghost" className="mb-4 -ml-4 text-muted-foreground" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-2" /> Back to History
        </Button>
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="outline">{scan.ecosystem}</Badge>
              <div className="text-sm text-muted-foreground">{new Date(scan.createdAt).toLocaleString()}</div>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{scan.filename}</h1>
          </div>
          <div className="flex flex-col items-end">
            <ScoreRing score={scan.riskScore} size={110} label="Risk Score" />
            <Explainer className="mt-2" label="How is this scored?">
              Each vulnerable package adds to the score based on how severe its known
              flaw is. 0 means every ingredient checked out clean; 100 means critical
              holes that attackers already know how to exploit.
            </Explainer>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="glass-panel">
            <CardHeader className="pb-2">
              <CardDescription>Total Dependencies</CardDescription>
              <CardTitle className="text-4xl font-mono">{scan.totalDependencies}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="glass-panel border-destructive/20">
            <CardHeader className="pb-2">
              <CardDescription>Vulnerable Packages</CardDescription>
              <CardTitle className="text-4xl font-mono text-destructive">{scan.vulnerableCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="glass-panel md:col-span-3 bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle className="text-primary-foreground flex items-center gap-2">
                <Search className="w-5 h-5" /> AI Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-primary-foreground/90 leading-relaxed text-lg">{scan.aiSummary}</p>
            </CardContent>
          </Card>
        </div>

        <h2 className="text-xl font-bold mt-8 mb-4">Vulnerability Report</h2>
        {scan.vulnerabilities.length === 0 ? (
          <Card className="bg-emerald-500/10 border-emerald-500/20">
            <CardContent className="flex flex-col items-center justify-center py-12 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-12 h-12 mb-4" />
              <div className="text-xl font-bold">Clean Bill of Health</div>
              <p>No known vulnerabilities detected in your dependencies.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {scan.vulnerabilities.map((v, i) => (
              <Card key={i} className="glass-panel overflow-hidden border-l-4" style={{ borderLeftColor: v.severity === 'critical' || v.severity === 'high' ? 'hsl(var(--destructive))' : 'hsl(var(--primary))' }}>
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono font-bold text-lg">{v.packageName}</span>
                        <Badge variant="outline" className="font-mono">{v.version}</Badge>
                        <Badge variant={v.severity === 'critical' || v.severity === 'high' ? 'critical' : 'warning'} className="uppercase">
                          {v.severity}
                        </Badge>
                      </div>
                      <p className="text-sm font-mono text-muted-foreground mb-4">{v.vulnId}</p>
                      <p className="text-sm leading-relaxed max-w-3xl">{v.summary}</p>
                      <WhyWhatTo
                        why={severityAdvice(v.severity).why}
                        whatToDo={
                          v.fixedVersion
                            ? `Update ${v.packageName} to version ${v.fixedVersion} or newer — the fix already exists.`
                            : severityAdvice(v.severity).whatToDo
                        }
                      />
                    </div>
                    {v.fixedVersion && (
                      <div className="shrink-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-4 py-3 rounded-lg border border-emerald-500/20 text-center">
                        <div className="text-xs uppercase tracking-wider font-bold mb-1">Fixed In</div>
                        <div className="font-mono font-bold text-lg">{v.fixedVersion}</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
