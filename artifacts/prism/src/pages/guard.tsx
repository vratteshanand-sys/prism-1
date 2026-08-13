import { useEffect, useState } from "react";
import {
  useCreateGuardScan,
  useGetGuardScan,
  useListGuardScans,
  getListGuardScansQueryKey,
  getGetGuardScanQueryKey,
  useDeleteGuardScan,
  useAddTrustedDevice,
  useListTrustedDevices,
  useRemoveTrustedDevice,
  getListTrustedDevicesQueryKey,
} from "@workspace/api-client-react";
import type { GuardScan, GuardDevice, TrustedDevice } from "@workspace/api-client-react";
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
import { getRiskBadgeVariant } from "@/lib/risk-utils";
import {
  HardDrive,
  Trash2,
  Copy,
  Check,
  Loader2,
  Cpu,
  MemoryStick,
  Wifi,
  Usb,
  Terminal,
  ShieldQuestion,
  Info,
  ShieldCheck,
  ShieldOff,
  Monitor,
} from "lucide-react";
import { ShareButton } from "@/components/share-button";
import { useToast } from "@/hooks/use-toast";
import { MODULES } from "@/lib/modules";
import {
  ModuleBanner,
  Explainer,
  WhyWhatTo,
  severityAdvice,
} from "@/components/teachy";
import { ScoreRing } from "@/components/score-ring";
import { cn } from "@/lib/utils";

type OsType = "macos" | "linux" | "windows";

function detectOs(): OsType {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win")) return "windows";
  if (ua.includes("linux") && !ua.includes("android")) return "linux";
  return "macos";
}

function buildOsCommand(os: OsType, baseCommand: string): string {
  const codeMatch = baseCommand.match(/code=([A-Z0-9]+)/i);
  const baseMatch = baseCommand.match(/curl -fsSL "([^"]+)\/guard\/agent\.sh/);
  if (!codeMatch || !baseMatch) return baseCommand;
  const code = codeMatch[1];
  const apiBase = baseMatch[1];
  if (os === "linux") return `curl -fsSL "${apiBase}/guard/agent-linux.sh?code=${code}" | bash`;
  if (os === "windows") return `iex (iwr -useb "${apiBase}/guard/agent-windows.ps1?code=${code}").Content`;
  return baseCommand;
}

export default function GuardPage() {
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [result, setResult] = useState<GuardScan | null>(null);
  const [os, setOs] = useState<OsType>(detectOs);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createScan = useCreateGuardScan();
  const { data: history } = useListGuardScans({
    query: { queryKey: getListGuardScansQueryKey() },
  });
  const deleteScan = useDeleteGuardScan();

  // Poll the pending scan until the Terminal agent reports back.
  const { data: polled } = useGetGuardScan(pendingId ?? 0, {
    query: {
      queryKey: getGetGuardScanQueryKey(pendingId ?? 0),
      enabled: pendingId != null,
      refetchInterval: 2500,
    },
  });

  useEffect(() => {
    if (!polled || pendingId == null) return;
    if (polled.status === "complete") {
      setResult(polled);
      setPendingId(null);
      queryClient.invalidateQueries({ queryKey: getListGuardScansQueryKey() });
    } else if (polled.status === "expired") {
      setPendingId(null);
      toast({
        title: "Pairing code expired",
        description: "Start a new scan to get a fresh command.",
        variant: "destructive",
      });
    }
  }, [polled, pendingId, queryClient, toast]);

  const startScan = () => {
    setResult(null);
    createScan.mutate(undefined, {
      onSuccess: (scan) => setPendingId(scan.id),
      onError: () =>
        toast({
          title: "Could not start scan",
          description: "Please retry.",
          variant: "destructive",
        }),
    });
  };

  const pending =
    pendingId != null && polled?.status !== "complete" ? polled : null;

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteScan.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListGuardScansQueryKey() });
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
            <h1 className="text-3xl font-bold tracking-tight text-orange-600 dark:text-orange-400">
              Hardware & Network Guard
            </h1>
            <p className="text-muted-foreground mt-2">
              A live snapshot of your Mac's hardware, everything plugged into
              it, and the network it trusts — read by a tiny script you run
              yourself.
            </p>
          </div>
          <Button
            onClick={startScan}
            disabled={createScan.isPending || pendingId != null}
          >
            <Terminal className="w-4 h-4 mr-2" />
            {history?.length ? "New Guard scan" : "Start Guard scan"}
          </Button>
        </div>

        <ModuleBanner theme={MODULES.guard} />

        <div className="flex items-start gap-3 p-4 rounded-lg border border-orange-500/20 bg-orange-500/5 text-sm">
          <ShieldQuestion className="w-4 h-4 mt-0.5 text-orange-600 dark:text-orange-400 shrink-0" />
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">
              Honest limits:
            </span>{" "}
            no software — PRISM included — can physically block electrical
            damage from a malicious high-voltage device. What Guard does is
            what real enterprise endpoint products do: inventory every
            connected device, flag unknown hardware and risky networks the
            moment they appear, and tell you what to unplug or distrust before
            harm spreads.
          </p>
        </div>

        {pending && (
          <Card className="glass-panel border-orange-500/30 border-t-4 border-t-orange-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                Run this command
              </CardTitle>
              <CardDescription>
                Open a terminal on your machine, paste this command, press Return.
                Results appear here automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* OS selector */}
              <div className="flex items-center gap-1 text-xs">
                <span className="text-muted-foreground mr-1">Platform:</span>
                {(["macos", "linux", "windows"] as OsType[]).map((o) => (
                  <button
                    key={o}
                    onClick={() => setOs(o)}
                    className={cn(
                      "px-2.5 py-1 rounded-full border font-medium capitalize transition-colors",
                      os === o
                        ? "bg-orange-500 text-white border-orange-500"
                        : "border-input text-muted-foreground hover:border-orange-400 hover:text-orange-600",
                    )}
                  >
                    {o === "macos" ? "macOS" : o.charAt(0).toUpperCase() + o.slice(1)}
                  </button>
                ))}
              </div>

              <CommandBox command={buildOsCommand(os, pending.command)} />

              {os === "windows" && (
                <p className="text-xs text-muted-foreground">
                  Open PowerShell (search "PowerShell" in the Start menu) and paste the command above.
                  PowerShell 5+ is built into Windows 10 and later.
                </p>
              )}
              {os === "linux" && (
                <p className="text-xs text-muted-foreground">
                  Open a terminal and paste the command above. Requires curl and bash (standard on most distros).
                </p>
              )}
              {os === "macos" && (
                <p className="text-xs text-muted-foreground">
                  Open Terminal (Cmd+Space → "Terminal") and paste the command above.
                </p>
              )}

              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-orange-600 dark:text-orange-400" />
                Waiting for your machine… pairing code{" "}
                <span className="font-mono font-semibold text-foreground">
                  {pending.pairingCode}
                </span>{" "}
                (valid 15 minutes)
              </div>
              <Explainer label="Why does this need a terminal command?">
                Browsers deliberately cannot see what is plugged into your
                computer — that is a good thing. This one-shot script runs with
                your own permissions, executes only standard read-only system
                reporting commands (you can read the script first — open the
                URL in the command), sends the readings to PRISM, and exits.
                Nothing is installed and no files are read or uploaded.
              </Explainer>
            </CardContent>
          </Card>
        )}

        {result && result.status === "complete" && <GuardResult scan={result} />}

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              Guard History
            </CardTitle>
            <CardDescription>
              Previous hardware scans on this browser session.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {!history?.length && (
              <div className="text-sm text-muted-foreground py-4">
                No Guard scans yet — start one above.
              </div>
            )}
            {history?.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3 rounded-md border bg-background/50 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setResult(s)}
              >
                <div>
                  <div className="font-medium text-sm">{s.machineLabel ?? "Mac"}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(s.completedAt ?? s.createdAt).toLocaleString()} ·{" "}
                    {s.devices.length} devices
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

function CommandBox({ command }: { command: string }) {
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
        {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
      </Button>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  sub?: string | null;
}) {
  return (
    <Card className="glass-panel border-t-4 border-t-orange-500">
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          {label}
        </CardDescription>
        <CardTitle className="text-2xl font-mono">{value}</CardTitle>
      </CardHeader>
      {sub && (
        <CardContent className="text-xs text-muted-foreground pt-0">{sub}</CardContent>
      )}
    </Card>
  );
}

function deviceKindLabel(d: GuardDevice): string {
  if (d.kind === "storage") return "External drive";
  if (d.kind === "thunderbolt") return "Thunderbolt";
  return "USB";
}

function GuardResult({ scan }: { scan: GuardScan }) {
  const sys = scan.system;
  const net = scan.network;
  const queryClient = useQueryClient();
  const { data: trustedDevices } = useListTrustedDevices({
    query: { queryKey: getListTrustedDevicesQueryKey() },
  });
  const addTrust = useAddTrustedDevice();
  const removeTrust = useRemoveTrustedDevice();
  const { toast } = useToast();

  const trustedSet = new Set((trustedDevices ?? []).map((t: TrustedDevice) => t.deviceKey));

  function toggleTrust(d: GuardDevice) {
    const key = `${d.kind}:${(d.vendor ?? "").toLowerCase()}:${d.name.toLowerCase()}`;
    if (trustedSet.has(key)) {
      removeTrust.mutate({ deviceKey: key }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTrustedDevicesQueryKey() }),
      });
    } else {
      addTrust.mutate({ data: { deviceKey: key, label: d.name } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTrustedDevicesQueryKey() });
          toast({ title: `"${d.name}" added to trust list`, description: "It will not be flagged as new in future scans." });
        },
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="glass-panel border-t-4 border-t-orange-500">
          <CardHeader className="pb-2 items-center">
            <CardDescription>Hardware Trust Score</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-2">
            <ScoreRing score={scan.trustScore ?? 0} invert size={110} />
            <div className="text-sm text-muted-foreground text-center">
              {scan.machineLabel ?? "Mac"}
            </div>
            <ShareButton
              module="Guard"
              title={`Guard scan — ${scan.machineLabel ?? "Mac"}`}
              trustScore={scan.trustScore}
              riskScore={scan.riskScore ?? 0}
              aiSummary={scan.aiSummary}
              findings={scan.findings}
              variant="outline"
              size="sm"
            />
            <Explainer label="What does this mean?">
              Higher is better. Every risky device, risky network condition,
              and stressed system reading pulls the score down. A clean Mac on
              a protected network sits in the 90s.
            </Explainer>
          </CardContent>
        </Card>
        <StatCard
          icon={Cpu}
          label="CPU"
          value={
            sys?.cpuUsagePercent != null ? `${sys.cpuUsagePercent}%` : "—"
          }
          sub={[sys?.cpuBrand, sys?.cpuCores ? `${sys.cpuCores} cores` : null, sys?.loadAvg1 != null ? `load ${sys.loadAvg1}` : null]
            .filter(Boolean)
            .join(" · ") || null}
        />
        <StatCard
          icon={MemoryStick}
          label="Memory"
          value={
            sys?.memUsedGb != null && sys?.memTotalGb != null
              ? `${sys.memUsedGb} / ${sys.memTotalGb} GB`
              : "—"
          }
          sub={
            sys?.memPressurePercent != null
              ? `${sys.memPressurePercent}% free · ${sys.thermalPressure ?? ""}`
              : sys?.thermalPressure ?? null
          }
        />
        <StatCard
          icon={Wifi}
          label="Network"
          value={net?.interfaceType ?? "—"}
          sub={[
            net?.ssid ? `"${net.ssid}"` : null,
            net?.security ?? null,
            net?.localDeviceCount != null
              ? `${net.localDeviceCount} devices visible nearby`
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || null}
        />
      </div>

      {(sys?.gpuName || sys?.batteryHealth || sys?.uptime) && (
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {sys.gpuName && (
            <span className="px-2.5 py-1 rounded-full border bg-background/50">
              GPU: {sys.gpuName}
            </span>
          )}
          {sys.batteryHealth && (
            <span className="px-2.5 py-1 rounded-full border bg-background/50">
              Battery: {sys.batteryHealth}
              {sys.batteryCycleCount != null ? ` · ${sys.batteryCycleCount} cycles` : ""}
            </span>
          )}
          {sys.uptime && (
            <span className="px-2.5 py-1 rounded-full border bg-background/50">
              Up {sys.uptime}
            </span>
          )}
        </div>
      )}

      {scan.aiSummary && (
        <Card className="glass-panel border-orange-500/20">
          <CardHeader>
            <CardTitle>AI Guard Report</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed">
            {scan.aiSummary}
          </CardContent>
        </Card>
      )}

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Usb className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            Connected Hardware
          </CardTitle>
          <CardDescription>
            Everything physically attached to this Mac right now.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {!scan.devices.length && (
            <div className="text-sm text-muted-foreground py-2">
              Nothing external is plugged in — smallest possible attack
              surface.
            </div>
          )}
          {scan.devices.map((d, i) => {
            const key = `${d.kind}:${(d.vendor ?? "").toLowerCase()}:${d.name.toLowerCase()}`;
            const isTrusted = trustedSet.has(key);
            return (
              <div
                key={i}
                className={cn(
                  "flex items-start justify-between gap-4 p-3 rounded-md border bg-background/50",
                  d.isNew && !isTrusted && "border-orange-500/50",
                  isTrusted && "border-green-500/40",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm flex items-center gap-2 flex-wrap">
                    {d.name}
                    {d.isNew && !isTrusted && (
                      <Badge className="bg-orange-500 text-white text-[0.6rem] uppercase">
                        New
                      </Badge>
                    )}
                    {isTrusted && (
                      <Badge className="bg-green-600 text-white text-[0.6rem] uppercase">
                        Trusted
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {deviceKindLabel(d)}
                    {d.vendor ? ` · ${d.vendor}` : " · vendor unknown"}
                    {d.capacityGb != null ? ` · ${d.capacityGb} GB` : ""}
                    {d.encrypted === false ? " · not encrypted" : d.encrypted === true ? " · encrypted" : ""}
                  </div>
                  {d.note && (
                    <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                      {d.note}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant={
                      d.riskGrade === "critical" || d.riskGrade === "high"
                        ? "destructive"
                        : d.riskGrade === "medium"
                          ? "default"
                          : "secondary"
                    }
                    className="uppercase text-[0.6rem]"
                  >
                    {d.riskGrade}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn("h-7 w-7", isTrusted ? "text-green-600 hover:text-destructive" : "text-muted-foreground hover:text-green-600")}
                    title={isTrusted ? "Remove from trust list" : "Mark as trusted (won't flag as new in future scans)"}
                    onClick={() => toggleTrust(d)}
                  >
                    {isTrusted ? <ShieldOff className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>Findings</CardTitle>
          <CardDescription>Graded observations from this scan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!scan.findings.length && (
            <div className="text-sm text-muted-foreground py-2">
              Nothing worth flagging.
            </div>
          )}
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
                {(f.severity === "high" || f.severity === "critical" || f.severity === "medium") && (
                  <WhyWhatTo
                    why={severityAdvice(f.severity).why}
                    whatToDo={severityAdvice(f.severity).whatToDo}
                  />
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 p-4 rounded-lg border text-sm bg-background/50">
        <Info className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
        <p className="text-muted-foreground text-xs leading-relaxed">
          Each Guard scan is a snapshot you trigger — nothing keeps running on
          your Mac afterwards. Re-run the scan any time for fresh numbers, for
          example right after plugging in hardware you do not recognize.
        </p>
      </div>
    </div>
  );
}
