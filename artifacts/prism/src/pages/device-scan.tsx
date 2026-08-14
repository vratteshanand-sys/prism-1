import { useEffect, useRef, useState } from "react";
import {
  useCreateDeviceScan,
  useListDeviceScans,
  getListDeviceScansQueryKey,
  useDeleteDeviceScan,
  useCreateDeepScan,
  useListDeepScans,
  getListDeepScansQueryKey,
  useGetDeepScan,
  getGetDeepScanQueryKey,
  useDeleteDeepScan,
  useGetPendingDeepScan,
  getGetPendingDeepScanQueryKey,
} from "@workspace/api-client-react";
import type { DeviceScan, DeepScan } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getRiskColor, getRiskBadgeVariant } from "@/lib/risk-utils";
import {
  MonitorSmartphone,
  Trash2,
  ScanLine,
  CheckCircle2,
  AlertTriangle,
  Info,
  Loader2,
  Terminal,
  Copy,
  Check,
  XCircle,
  MinusCircle,
  ShieldQuestion,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  buildCollectionSteps,
  type CollectedSignals,
} from "@/lib/device-signals";
import { MODULES } from "@/lib/modules";
import { ModuleBanner, Explainer, WhyWhatTo, severityAdvice } from "@/components/teachy";
import { ScoreRing } from "@/components/score-ring";

export default function DeviceScanPage() {
  const [phase, setPhase] = useState<"idle" | "collecting" | "analyzing" | "done">("idle");
  const [stepIndex, setStepIndex] = useState(0);
  const [stepLabels, setStepLabels] = useState<string[]>([]);
  const [result, setResult] = useState<DeviceScan | null>(null);
  const startedRef = useRef(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createScan = useCreateDeviceScan();
  const { data: history } = useListDeviceScans({
    query: { queryKey: getListDeviceScansQueryKey() },
  });
  const deleteScan = useDeleteDeviceScan();

  const runScan = async () => {
    setPhase("collecting");
    setResult(null);
    const steps = buildCollectionSteps();
    setStepLabels(steps.map((s) => s.label));
    const signals = {} as CollectedSignals;
    for (let i = 0; i < steps.length; i++) {
      setStepIndex(i);
      const started = Date.now();
      try {
        await steps[i].run(signals);
      } catch {
        // A failed probe just means the surface is not exposed.
      }
      // Give each step a visible beat without faking the work itself
      const elapsed = Date.now() - started;
      if (elapsed < 450) await new Promise((r) => setTimeout(r, 450 - elapsed));
    }
    setPhase("analyzing");
    createScan.mutate(
      { data: signals },
      {
        onSuccess: (res) => {
          queryClient.invalidateQueries({ queryKey: getListDeviceScansQueryKey() });
          setResult(res);
          setPhase("done");
        },
        onError: () => {
          setPhase("idle");
          toast({
            title: "Scan failed",
            description: "Could not analyze device signals. Please retry.",
            variant: "destructive",
          });
        },
      },
    );
  };

  // Auto-start the live scan on first visit to the page
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      runScan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteScan.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDeviceScansQueryKey() });
          if (result?.id === id) setResult(null);
        },
      },
    );
  };

  return (
    <div className="flex-1 overflow-y-auto bg-noise">
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-blue-600 dark:text-blue-400">Device Trust Scan</h1>
            <p className="text-muted-foreground mt-2">
              A live analysis of your device — every value below is read from
              your browser right now.
            </p>
          </div>
          <Button onClick={runScan} disabled={phase === "collecting" || phase === "analyzing"}>
            <ScanLine className="w-4 h-4 mr-2" />
            Rescan this device
          </Button>
        </div>

        <ModuleBanner theme={MODULES.devicescan} />

        <div className="flex items-start gap-3 p-4 rounded-lg border border-blue-500/20 bg-blue-500/5 text-sm">
          <Info className="w-4 h-4 mt-0.5 text-primary shrink-0" />
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">What this scan can and cannot see:</span>{" "}
            browsers deliberately sandbox websites away from your files, so this is
            not an antivirus scan. Instead, it shows your device exactly as any
            website sees it — which is the point: everything below is available to
            every site you visit.
          </p>
        </div>

        {(phase === "collecting" || phase === "analyzing") && (
          <Card className="glass-panel border-primary/20 shadow-lg">
            <CardContent className="p-8 space-y-4">
              {stepLabels.map((label, i) => {
                const state =
                  phase === "analyzing" || i < stepIndex
                    ? "done"
                    : i === stepIndex
                      ? "active"
                      : "pending";
                return (
                  <div key={label} className="flex items-center gap-3 text-sm">
                    {state === "done" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : state === "active" ? (
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-muted-foreground/30" />
                    )}
                    <span className={state === "pending" ? "text-muted-foreground/50" : ""}>
                      {label}
                    </span>
                  </div>
                );
              })}
              {phase === "analyzing" && (
                <div className="flex items-center gap-3 text-sm pt-2 border-t">
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  <span>Cross-checking against live release feeds and generating your report…</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {phase === "done" && result && <ScanResult scan={result} />}

        <DeepScanSection />

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MonitorSmartphone className="w-5 h-5 text-primary" />
              Scan History
            </CardTitle>
            <CardDescription>
              Previous browser scans on this workspace. Deep scans have their
              own history in the Deep Scan section above.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {!history?.length && (
              <div className="text-sm text-muted-foreground py-4">No scans yet.</div>
            )}
            {history?.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3 rounded-md border bg-background/50 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => {
                  setResult(s);
                  setPhase("done");
                }}
              >
                <div>
                  <div className="font-medium text-sm flex items-center gap-2">
                    {s.deviceLabel}
                    <Badge variant="outline" className="text-[0.6rem] uppercase">
                      Browser
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(s.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={getRiskBadgeVariant(s.riskScore)} className="font-mono">
                    Trust {s.trustScore}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => handleDelete(s.id, e)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DeepScanSection() {
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [deepResult, setDeepResult] = useState<DeepScan | null>(null);
  const adopted = useRef(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createDeep = useCreateDeepScan();
  const { data: deepHistory } = useListDeepScans({
    query: { queryKey: getListDeepScansQueryKey() },
  });
  const deleteDeep = useDeleteDeepScan();

  // On mount, check if the session already has a pending scan (e.g. after a
  // page refresh). If so, adopt it so the waiting card shows immediately.
  const { data: sessionPending } = useGetPendingDeepScan({
    query: {
      queryKey: getGetPendingDeepScanQueryKey(),
      staleTime: 0,
      gcTime: 0,
      retry: false,
    },
  });
  useEffect(() => {
    if (adopted.current) return;
    if (sessionPending && sessionPending.status === "pending" && pendingId == null) {
      adopted.current = true;
      setPendingId(sessionPending.id);
    }
  }, [sessionPending, pendingId]);

  // Poll the pending scan until the Terminal agent reports back.
  const { data: polled } = useGetDeepScan(pendingId ?? 0, {
    query: {
      queryKey: getGetDeepScanQueryKey(pendingId ?? 0),
      enabled: pendingId != null,
      refetchInterval: 2500,
    },
  });

  useEffect(() => {
    if (!polled || pendingId == null) return;
    if (polled.status === "complete") {
      setDeepResult(polled);
      setPendingId(null);
      queryClient.invalidateQueries({ queryKey: getListDeepScansQueryKey() });
    } else if (polled.status === "expired") {
      setPendingId(null);
      toast({
        title: "Pairing code expired",
        description: "Start a new deep scan to get a fresh command.",
        variant: "destructive",
      });
    }
  }, [polled, pendingId, queryClient, toast]);

  const startDeep = () => {
    setDeepResult(null);
    createDeep.mutate(undefined, {
      onSuccess: (scan) => setPendingId(scan.id),
      onError: () =>
        toast({
          title: "Could not start deep scan",
          description: "Please retry.",
          variant: "destructive",
        }),
    });
  };

  const pending =
    pendingId != null && polled?.status !== "complete" ? polled : null;

  const handleDeleteDeep = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteDeep.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDeepScansQueryKey() });
          if (deepResult?.id === id) setDeepResult(null);
        },
      },
    );
  };

  return (
    <Card className="glass-panel relative overflow-hidden border-blue-500/30">
      <div className="pointer-events-none absolute -top-10 -right-10 w-32 h-32 rounded-full bg-blue-500/10 blur-2xl" />
      <CardHeader className="relative">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              MacBook Deep Scan
            </CardTitle>
            <CardDescription className="mt-1.5 max-w-2xl">
              The browser scan above shows what websites see. This goes deeper:
              a tiny script you run in your Mac's Terminal reads the real
              security settings — FileVault, firewall, System Integrity
              Protection, Gatekeeper, and whether macOS itself is current.
            </CardDescription>
          </div>
          <Button
            onClick={startDeep}
            disabled={createDeep.isPending || pendingId != null}
          >
            <Terminal className="w-4 h-4 mr-2" />
            {deepHistory?.length ? "New deep scan" : "Start deep scan"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start gap-3 p-4 rounded-lg border border-blue-500/20 bg-blue-500/5 text-sm">
          <ShieldQuestion className="w-4 h-4 mt-0.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Why a Terminal command?</span>{" "}
            Browsers deliberately cannot read these settings — that is a
            security feature. The one-shot script runs with your own
            permissions, executes only standard read-only macOS status
            commands (you can read it first — open the URL in the command),
            sends the readings to PRISM, and exits. No files are read or
            uploaded, and nothing stays installed.
          </p>
        </div>

        {pending && (
          <div className="space-y-4 p-4 rounded-lg border border-blue-500/30 bg-background/50">
            <div className="font-medium text-sm">
              Open Terminal on your Mac (Cmd+Space, type "Terminal"), paste
              this command, press Return:
            </div>
            <DeepCommandBox command={pending.command} />
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
              Waiting for your Mac… pairing code{" "}
              <span className="font-mono font-semibold text-foreground">
                {pending.pairingCode}
              </span>{" "}
              (valid 15 minutes)
            </div>
          </div>
        )}

        {deepResult && deepResult.status === "complete" && (
          <DeepScanResult scan={deepResult} />
        )}

        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Deep scan history
          </div>
          {!deepHistory?.length && (
            <div className="text-sm text-muted-foreground py-2">
              No deep scans yet — start one above.
            </div>
          )}
          <div className="space-y-2">
            {deepHistory?.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3 rounded-md border bg-background/50 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setDeepResult(s)}
              >
                <div>
                  <div className="font-medium text-sm flex items-center gap-2">
                    {s.machineLabel ?? "Mac"}
                    <Badge variant="outline" className="text-[0.6rem] uppercase">
                      Deep
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(s.completedAt ?? s.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={getRiskBadgeVariant(s.riskScore ?? 0)}
                    className="font-mono"
                  >
                    Trust {s.trustScore ?? "—"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => handleDeleteDeep(s.id, e)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DeepCommandBox({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable; user can select the text manually.
    }
  };
  return (
    <div className="flex items-stretch gap-2">
      <code className="flex-1 p-3 rounded-md bg-muted font-mono text-xs break-all select-all">
        {command}
      </code>
      <Button variant="outline" size="icon" className="h-auto" onClick={copy}>
        {copied ? (
          <Check className="w-4 h-4 text-emerald-600" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </Button>
    </div>
  );
}

function PostureCheck({
  label,
  state,
  onText,
  offText,
  unknownText,
}: {
  label: string;
  state: boolean | null | undefined;
  onText: string;
  offText: string;
  unknownText?: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-md border bg-background/50">
      {state === true ? (
        <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
      ) : state === false ? (
        <XCircle className="w-4 h-4 mt-0.5 text-destructive shrink-0" />
      ) : (
        <MinusCircle className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
      )}
      <div>
        <div className="font-medium text-sm">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {state === true
            ? onText
            : state === false
              ? offText
              : (unknownText ?? "Could not be read on this Mac.")}
        </div>
      </div>
    </div>
  );
}

function DeepScanResult({ scan }: { scan: DeepScan }) {
  const p = scan.posture;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 rise-in">
        <Card className="glass-panel relative overflow-hidden hover-lift">
          <div className="pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full bg-blue-500/10 blur-2xl" />
          <CardHeader className="relative pb-2 items-center">
            <CardDescription>Deep Scan Trust Score</CardDescription>
          </CardHeader>
          <CardContent className="relative flex flex-col items-center gap-2">
            <ScoreRing score={scan.trustScore ?? 0} invert size={110} />
            <div className="text-sm text-muted-foreground text-center">
              {scan.machineLabel ?? "Mac"}
            </div>
            <Explainer label="What does this mean?">
              Higher is better. FileVault and System Integrity Protection
              weigh the most because they are the protections that matter
              most if the Mac is lost, stolen, or attacked.
            </Explainer>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardDescription>macOS Freshness</CardDescription>
            <CardTitle className="text-2xl">
              macOS {p?.macosVersion ?? "?"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {p?.macosUpToDate === true && (
              <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" /> Current release
                {p.latestMacos ? ` (${p.latestMacos})` : ""}
              </span>
            )}
            {p?.macosUpToDate === false && (
              <span className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-4 h-4" /> Behind — current is{" "}
                {p.latestMacos}
              </span>
            )}
            {p?.macosUpToDate == null && (
              <span className="text-muted-foreground">
                Freshness could not be verified against the live release feed.
              </span>
            )}
            {p?.macosBuild && (
              <p className="text-xs text-muted-foreground mt-2 font-mono">
                Build {p.macosBuild}
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardDescription>Updates & Disk</CardDescription>
            <CardTitle className="text-2xl">
              {p?.pendingUpdates.length
                ? `${p.pendingUpdates.length} pending`
                : "No updates waiting"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            {p?.pendingUpdates.slice(0, 3).map((u) => (
              <div key={u} className="text-xs font-mono truncate">
                {u}
              </div>
            ))}
            {p?.diskUsedPercent != null && (
              <div className="text-xs pt-1">
                Startup disk {p.diskUsedPercent}% full
                {p.diskAvailable ? ` · ${p.diskAvailable} free` : ""}
              </div>
            )}
            {p?.uptime && <div className="text-xs">Up {p.uptime}</div>}
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          Core protections
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <PostureCheck
            label="FileVault disk encryption"
            state={p?.fileVault}
            onText="The disk is unreadable without your password."
            offText="Anyone with physical access can read the disk."
          />
          <PostureCheck
            label="Firewall"
            state={p?.firewall}
            onText={
              p?.firewallStealth === true
                ? "On, with stealth mode — invisible to network probes."
                : "On — incoming connections are filtered."
            }
            offText="Other devices on the network can reach this Mac."
          />
          <PostureCheck
            label="System Integrity Protection"
            state={p?.sip}
            onText="Core system files are protected even from admin-level malware."
            offText="Disabled — a serious red flag unless you did it deliberately."
          />
          <PostureCheck
            label="Gatekeeper app screening"
            state={p?.gatekeeper}
            onText="Downloaded apps are checked before they can launch."
            offText="Any downloaded program can run without screening."
          />
        </div>
      </div>

      {scan.aiSummary && (
        <Card className="glass-panel border-primary/20">
          <CardHeader>
            <CardTitle>AI Deep Scan Report</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed">
            {scan.aiSummary}
          </CardContent>
        </Card>
      )}

      <div>
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          Findings
        </div>
        <div className="space-y-3">
          {scan.findings.map((f, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 rounded-md border bg-background/50"
            >
              <Badge
                variant={
                  f.severity === "critical" || f.severity === "high"
                    ? "destructive"
                    : f.severity === "medium"
                      ? "default"
                      : "secondary"
                }
                className="mt-0.5 shrink-0 uppercase text-[0.6rem]"
              >
                {f.severity}
              </Badge>
              <div className="flex-1">
                <div className="font-medium text-sm">{f.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{f.detail}</div>
                {(f.severity === "medium" ||
                  f.severity === "high" ||
                  f.severity === "critical") && (
                  <WhyWhatTo
                    why={severityAdvice(f.severity).why}
                    whatToDo={severityAdvice(f.severity).whatToDo}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScanResult({ scan }: { scan: DeviceScan }) {
  const categories = [...new Set(scan.signals.map((s) => s.category))];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 rise-in">
        <Card className="glass-panel relative overflow-hidden hover-lift">
          <div className="pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full bg-blue-500/10 blur-2xl" />
          <CardHeader className="relative pb-2 items-center">
            <CardDescription>Device Trust Score</CardDescription>
          </CardHeader>
          <CardContent className="relative flex flex-col items-center gap-2">
            <ScoreRing score={scan.trustScore} invert size={110} />
            <div className="text-sm text-muted-foreground text-center">{scan.deviceLabel}</div>
            <Explainer label="What does this mean?">
              Trust works the opposite way from risk: higher is better. It combines
              how current your browser is with how exposed this device looks to
              tracking and probing.
            </Explainer>
          </CardContent>
        </Card>
        <Card className="glass-panel relative overflow-hidden hover-lift">
          <div className="pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full bg-blue-500/10 blur-2xl" />
          <CardHeader className="relative pb-2">
            <CardDescription>Fingerprinting Exposure</CardDescription>
            <CardTitle className={`text-5xl font-mono ${getRiskColor(scan.fingerprintExposure)}`}>
              {scan.fingerprintExposure}
              <span className="text-lg text-muted-foreground">/100</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 transition-all duration-1000"
                style={{ width: `${scan.fingerprintExposure}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              How uniquely trackable this device is across websites.
            </p>
            <Explainer className="mt-2" label="What is fingerprinting?">
              Websites can quietly combine details your browser reveals — screen size,
              fonts, graphics chip, time zone — into a "fingerprint" that identifies
              you without cookies. The more distinctive your setup, the easier you are
              to follow around the web.
            </Explainer>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardDescription>Browser Freshness</CardDescription>
            <CardTitle className="text-2xl">
              {scan.browserName} {scan.browserVersion.split(".")[0]}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {scan.browserUpToDate === true && (
              <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" /> Up to date (stable: {scan.latestVersion})
              </span>
            )}
            {scan.browserUpToDate === false && (
              <span className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-4 h-4" /> Outdated — stable is {scan.latestVersion}
              </span>
            )}
            {scan.browserUpToDate == null && scan.latestVersion && (
              <span className="text-muted-foreground">
                Major matches stable ({scan.latestVersion}) — patch level unverified.
              </span>
            )}
            {scan.browserUpToDate == null && !scan.latestVersion && (
              <span className="text-muted-foreground">
                No live release feed for this browser.
              </span>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="glass-panel border-primary/20">
        <CardHeader>
          <CardTitle>AI Security Report</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed">{scan.aiSummary}</CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>Findings</CardTitle>
          <CardDescription>Graded observations from this scan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {scan.findings.map((f, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-md border bg-background/50">
              <Badge
                variant={
                  f.severity === "critical" || f.severity === "high"
                    ? "destructive"
                    : f.severity === "medium"
                      ? "default"
                      : "secondary"
                }
                className="mt-0.5 shrink-0 uppercase text-[0.6rem]"
              >
                {f.severity}
              </Badge>
              <div className="flex-1">
                <div className="font-medium text-sm">{f.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{f.detail}</div>
                <WhyWhatTo why={severityAdvice(f.severity).why} whatToDo={severityAdvice(f.severity).whatToDo} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>Raw Signals</CardTitle>
          <CardDescription>
            Everything your browser just revealed — live values, not samples.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {categories.map((cat) => (
            <div key={cat}>
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                {cat}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {scan.signals
                  .filter((s) => s.category === cat)
                  .map((s) => (
                    <div
                      key={s.label}
                      className="flex items-start justify-between gap-4 p-2.5 rounded border bg-background/50 text-sm"
                    >
                      <span className="text-muted-foreground shrink-0">{s.label}</span>
                      <span className="font-mono text-xs text-right break-all">{s.value}</span>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
