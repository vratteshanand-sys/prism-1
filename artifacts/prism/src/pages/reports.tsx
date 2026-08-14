import { useState } from "react";
import { 
  useListSupplyChainScans, getListSupplyChainScansQueryKey,
  useListSentinelAnalyses, getListSentinelAnalysesQueryKey,
  useListUrlInspections, getListUrlInspectionsQueryKey,
  useListPolicyAnalyses, getListPolicyAnalysesQueryKey,
  useListCookieAnalyses, getListCookieAnalysesQueryKey,
  useListFinguardAnalyses, getListFinguardAnalysesQueryKey,
  useListDeviceScans, getListDeviceScansQueryKey,
  useListGuardScans, getListGuardScansQueryKey,
  useListDeepScans, getListDeepScansQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRiskColor, getRiskBadgeVariant } from "@/lib/risk-utils";
import { Search, ShieldAlert, Fingerprint, ShieldCheck, Link as LinkIcon, FileText, Cookie, Activity, MonitorSmartphone, HardDrive, Terminal } from "lucide-react";

import { useLocation } from "wouter";
import { themeForLabel, MODULES } from "@/lib/modules";
import { ModuleBanner, Explainer } from "@/components/teachy";
import { cn } from "@/lib/utils";

type UnifiedReport = {
  id: string;
  module: string;
  icon: any;
  title: string;
  detail: string;
  riskScore: number;
  date: string;
  href: string;
};

export default function Reports() {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("all");

  const [_, setLocation] = useLocation();

  const { data: supplyChain } = useListSupplyChainScans({ query: { queryKey: getListSupplyChainScansQueryKey() } });
  const { data: sentinel } = useListSentinelAnalyses({ query: { queryKey: getListSentinelAnalysesQueryKey() } });
  const { data: urls } = useListUrlInspections({ query: { queryKey: getListUrlInspectionsQueryKey() } });
  const { data: policies } = useListPolicyAnalyses({ query: { queryKey: getListPolicyAnalysesQueryKey() } });
  const { data: cookies } = useListCookieAnalyses({ query: { queryKey: getListCookieAnalysesQueryKey() } });
  const { data: finguard } = useListFinguardAnalyses({ query: { queryKey: getListFinguardAnalysesQueryKey() } });
  const { data: deviceScans } = useListDeviceScans({ query: { queryKey: getListDeviceScansQueryKey() } });
  const { data: guardScans } = useListGuardScans({ query: { queryKey: getListGuardScansQueryKey() } });
  const { data: deepScans } = useListDeepScans({ query: { queryKey: getListDeepScansQueryKey() } });

  const reports: UnifiedReport[] = [];

  if (supplyChain) {
    reports.push(...supplyChain.map(s => ({
      id: `sc-${s.id}`,
      module: "Supply Chain",
      icon: ShieldAlert,
      title: s.filename,
      detail: `${s.totalDependencies} dependencies, ${s.vulnerableCount} vulnerable`,
      riskScore: s.riskScore,
      date: s.createdAt,
      href: `/supplychain`,
    })));
  }

  if (sentinel) {
    reports.push(...sentinel.map(s => ({
      id: `sent-${s.id}`,
      module: "Sentinel AI",
      icon: Fingerprint,
      title: "Text Analysis",
      detail: `"${s.textExcerpt}..."`,
      riskScore: s.overallRisk,
      date: s.createdAt,
      href: `/sentinel`,
    })));
  }

  if (urls) {
    reports.push(...urls.map(s => ({
      id: `url-${s.id}`,
      module: "URL Inspector",
      icon: LinkIcon,
      title: s.url,
      detail: s.aiSummary,
      riskScore: s.riskScore,
      date: s.createdAt,
      href: `/trustlens`,
    })));
  }

  if (policies) {
    reports.push(...policies.map(s => ({
      id: `pol-${s.id}`,
      module: "Policy Analyzer",
      icon: FileText,
      title: "Privacy Policy",
      detail: `"${s.excerpt}..."`,
      riskScore: s.riskScore,
      date: s.createdAt,
      href: `/trustlens`,
    })));
  }

  if (cookies) {
    reports.push(...cookies.map(s => ({
      id: `cookie-${s.id}`,
      module: "Cookie Decoder",
      icon: Cookie,
      title: "Cookie Banner",
      detail: `"${s.excerpt}..."`,
      riskScore: s.manipulationScore, // Note: manipulation score acts as risk here
      date: s.createdAt,
      href: `/trustlens`,
    })));
  }

  if (finguard) {
    reports.push(...finguard.map(s => ({
      id: `fg-${s.id}`,
      module: "FinGuard",
      icon: ShieldCheck,
      title: "Ledger Scan",
      detail: `${s.transactionCount} transactions, ${s.flaggedCount} flagged`,
      riskScore: s.riskScore,
      date: s.createdAt,
      href: `/finguard`,
    })));
  }

  if (deviceScans) {
    reports.push(...deviceScans.map(s => ({
      id: `dev-${s.id}`,
      module: "Device Scan",
      icon: MonitorSmartphone,
      title: s.deviceLabel,
      detail: `Trust ${s.trustScore}/100, fingerprint exposure ${s.fingerprintExposure}/100`,
      riskScore: s.riskScore,
      date: s.createdAt,
      href: `/devicescan`,
    })));
  }

  if (guardScans) {
    reports.push(...guardScans
      .filter(s => s.status === "complete")
      .map(s => ({
        id: `guard-${s.id}`,
        module: "Guard",
        icon: HardDrive,
        title: s.machineLabel ?? "Mac",
        detail: `${s.devices.length} connected devices, ${s.findings.length} findings`,
        riskScore: s.riskScore ?? 0,
        date: s.completedAt ?? s.createdAt,
        href: `/guard`,
      })));
  }

  if (deepScans) {
    reports.push(...deepScans
      .filter(s => s.status === "complete")
      .map(s => ({
        id: `deep-${s.id}`,
        module: "Deep Scan",
        icon: Terminal,
        title: s.machineLabel ?? "Mac",
        detail: `Trust ${s.trustScore ?? "—"}/100 · ${s.findings.filter(f => f.severity === "critical" || f.severity === "high").length} critical/high findings`,
        riskScore: s.riskScore ?? 0,
        date: s.completedAt ?? s.createdAt,
        href: `/devicescan`,
      })));
  }

  // Sort by date desc
  reports.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Filter
  const filtered = reports.filter(r => {
    const matchSearch = r.title.toLowerCase().includes(search.toLowerCase()) || r.detail.toLowerCase().includes(search.toLowerCase());
    const matchModule = moduleFilter === "all" || r.module === moduleFilter;
    
    let matchRisk = true;
    if (riskFilter === "critical") matchRisk = r.riskScore >= 80;
    if (riskFilter === "warning") matchRisk = r.riskScore >= 40 && r.riskScore < 80;
    if (riskFilter === "safe") matchRisk = r.riskScore < 40;

    return matchSearch && matchModule && matchRisk;
  });

  // Calculate stats
  const total = filtered.length;
  const avgRisk = total > 0 ? Math.round(filtered.reduce((acc, r) => acc + r.riskScore, 0) / total) : 0;
  const criticalCount = filtered.filter(r => r.riskScore >= 80).length;

  return (
    <div className="flex-1 overflow-y-auto bg-noise">
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div className="rise-in">
          <h1 className="text-3xl font-bold tracking-tight text-rose-600 dark:text-rose-400">Unified Reports</h1>
          <p className="text-muted-foreground mt-2">Comprehensive history across all security modules.</p>
        </div>

        <div className="rise-in" style={{ animationDelay: "60ms" }}>
          <ModuleBanner theme={MODULES.reports} />
        </div>
        <Explainer label="How do I read this page?">
          Every scan you have ever run — from any module — lands here as one row.
          Use the filters to slice by module or by risk band. The color chip on each
          row tells you which module produced it, and the score badge follows the
          usual rule: green is fine, amber deserves a look, red needs action.
        </Explainer>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 rise-in">
          <Card className="glass-panel relative overflow-hidden hover-lift">
            <div className="pointer-events-none absolute -top-8 -right-8 w-28 h-28 rounded-full bg-rose-500/10 blur-2xl" />
            <CardHeader className="relative pb-2">
              <CardDescription>Filtered Results</CardDescription>
              <CardTitle className="text-4xl font-mono">{total}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="glass-panel relative overflow-hidden hover-lift">
            <div className="pointer-events-none absolute -top-8 -right-8 w-28 h-28 rounded-full bg-amber-500/10 blur-2xl" />
            <CardHeader className="relative pb-2">
              <CardDescription>Average Risk</CardDescription>
              <CardTitle className={`text-4xl font-mono ${getRiskColor(avgRisk)}`}>{avgRisk}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="glass-panel relative overflow-hidden hover-lift border-destructive/20">
            <div className="pointer-events-none absolute -top-8 -right-8 w-28 h-28 rounded-full bg-destructive/10 blur-2xl" />
            <CardHeader className="relative pb-2">
              <CardDescription>Critical Assets</CardDescription>
              <CardTitle className="text-4xl font-mono text-destructive">{criticalCount}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card className="glass-panel shadow-xl">
          <CardHeader className="border-b bg-muted/20">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-2 text-primary font-bold">
                <Activity className="w-5 h-5" /> Activity Log
              </div>
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  <Input 
                    className="pl-9 bg-background" 
                    placeholder="Search reports..." 
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                
                <Select value={moduleFilter} onValueChange={setModuleFilter}>
                  <SelectTrigger className="w-full md:w-[160px] bg-background">
                    <SelectValue placeholder="All Modules" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modules</SelectItem>
                    <SelectItem value="Supply Chain">Supply Chain</SelectItem>
                    <SelectItem value="Sentinel AI">Sentinel AI</SelectItem>
                    <SelectItem value="URL Inspector">URL Inspector</SelectItem>
                    <SelectItem value="Policy Analyzer">Policy Analyzer</SelectItem>
                    <SelectItem value="Cookie Decoder">Cookie Decoder</SelectItem>
                    <SelectItem value="FinGuard">FinGuard</SelectItem>
                    <SelectItem value="Device Scan">Device Scan</SelectItem>
                    <SelectItem value="Guard">Guard</SelectItem>
                    <SelectItem value="Deep Scan">Deep Scan</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={riskFilter} onValueChange={setRiskFilter}>
                  <SelectTrigger className="w-full md:w-[140px] bg-background">
                    <SelectValue placeholder="All Risks" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Risks</SelectItem>
                    <SelectItem value="safe">Safe (0-39)</SelectItem>
                    <SelectItem value="warning">Warning (40-79)</SelectItem>
                    <SelectItem value="critical">Critical (80+)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {reports.length === 0 ? (
              <div className="p-12 text-center animate-pulse text-muted-foreground">Gathering intelligence...</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">No reports match your filters.</div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Module</TableHead>
                    <TableHead>Asset</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Risk Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(r => (
                    <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50 transition-colors duration-200" onClick={() => setLocation(r.href)}>
                      <TableCell>
                        {(() => {
                          const theme = themeForLabel(r.module);
                          return (
                            <div className="flex items-center gap-2">
                              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white", theme.solid)}>
                                <r.icon className="w-4 h-4" />
                              </div>
                              <span className={cn("font-medium text-sm", theme.text)}>{r.module}</span>
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-sm truncate max-w-[300px]">{r.title}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[400px]">{r.detail}</div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(r.date).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={getRiskBadgeVariant(r.riskScore)} className="font-mono">
                          {r.riskScore}
                        </Badge>
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
  );
}
