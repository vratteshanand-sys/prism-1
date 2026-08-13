/**
 * MacBook Deep Scan — server-side parsing and grading of raw, read-only
 * macOS security-posture command output collected by the Terminal agent.
 * The agent sends base64-encoded raw text; all interpretation happens here
 * so the script stays tiny and auditable.
 */
import type { Finding } from "./device-analysis";
import { decodeBlobs } from "./guard-analysis";

export interface DeepRawBlobs {
  hostname?: string;
  swVers?: string;
  fdesetup?: string;
  firewall?: string;
  firewallStealth?: string;
  spctl?: string;
  csrutil?: string;
  softwareupdate?: string;
  df?: string;
  uptime?: string;
}

export interface DeepScanPosture {
  macosVersion: string | null;
  macosBuild: string | null;
  latestMacos: string | null;
  macosUpToDate: boolean | null;
  fileVault: boolean | null;
  firewall: boolean | null;
  firewallStealth: boolean | null;
  sip: boolean | null;
  gatekeeper: boolean | null;
  pendingUpdates: string[];
  diskUsedPercent: number | null;
  diskAvailable: string | null;
  uptime: string | null;
}

export function decodeDeepBlobs(
  raw: Record<string, string | undefined>,
): DeepRawBlobs {
  return decodeBlobs(raw) as DeepRawBlobs;
}

/** Core readings the agent always produces; reject junk submissions. */
export function hasMinimumDeepTelemetry(raw: DeepRawBlobs): boolean {
  return Boolean(raw.hostname && raw.swVers);
}

// ---------- Live macOS release lookup (real data, no key) ----------

export interface MacosRelease {
  /** Major version cycle, e.g. "15" */
  cycle: string;
  /** Latest patch release in that cycle, e.g. "15.6.1" */
  latest: string;
}

let macosCache: { value: MacosRelease[] | null; at: number } | null = null;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const VERSION_RE = /^\d+(\.\d+)*$/;

/**
 * Apple's actual macOS release history from the endoflife.date dataset.
 * Returns every cycle with its latest patch release so grading can compare
 * a Mac against ITS OWN major version (a fully patched Sonoma Mac is not
 * "outdated" just because a newer major exists). Null when unavailable —
 * we report "unverified" rather than guessing.
 */
export async function fetchMacosReleases(): Promise<MacosRelease[] | null> {
  if (macosCache && Date.now() - macosCache.at < CACHE_TTL_MS)
    return macosCache.value;
  let value: MacosRelease[] | null = null;
  try {
    const res = await fetch("https://endoflife.date/api/macos.json", {
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const data = (await res.json()) as { cycle?: unknown; latest?: unknown }[];
      if (Array.isArray(data)) {
        const releases = data
          .filter(
            (d): d is { cycle: string; latest: string } =>
              typeof d.cycle === "string" &&
              typeof d.latest === "string" &&
              VERSION_RE.test(d.cycle) &&
              VERSION_RE.test(d.latest),
          )
          .map((d) => ({ cycle: d.cycle, latest: d.latest }));
        if (releases.length > 0) value = releases;
      }
    }
  } catch {
    value = null;
  }
  macosCache = { value, at: Date.now() };
  return value;
}

/** Newest release across all cycles (validated by version, not array order). */
export function newestMacos(releases: MacosRelease[]): string | null {
  let best: string | null = null;
  for (const r of releases) {
    if (!best || compareVersions(r.latest, best) > 0) best = r.latest;
  }
  return best;
}

/** Latest patch release within the Mac's own major-version cycle. */
export function latestInCycle(
  releases: MacosRelease[],
  version: string,
): string | null {
  const major = version.split(".")[0];
  return releases.find((r) => r.cycle === major)?.latest ?? null;
}

function compareVersions(a: string, b: string): number {
  const as = a.split(".").map((s) => parseInt(s, 10));
  const bs = b.split(".").map((s) => parseInt(s, 10));
  for (let i = 0; i < Math.max(as.length, bs.length); i++) {
    const x = as[i] ?? 0;
    const y = bs[i] ?? 0;
    if (Number.isNaN(x) || Number.isNaN(y)) return 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

// ---------- Parsing ----------

function bool(
  text: string | undefined,
  onRe: RegExp,
  offRe: RegExp,
): boolean | null {
  if (!text) return null;
  if (onRe.test(text)) return true;
  if (offRe.test(text)) return false;
  return null;
}

export function parsePosture(
  raw: DeepRawBlobs,
  releases: MacosRelease[] | null,
): DeepScanPosture {
  const macosVersion =
    raw.swVers?.match(/ProductVersion:\s*([\d.]+)/)?.[1] ?? null;
  const macosBuild = raw.swVers?.match(/BuildVersion:\s*(\S+)/)?.[1] ?? null;

  // Patch freshness is judged within the Mac's OWN major cycle — a fully
  // patched older-but-supported macOS is not "outdated". If the cycle is
  // unknown to the feed (very old macOS), compare against the newest release.
  let latestMacos: string | null = null;
  let macosUpToDate: boolean | null = null;
  if (macosVersion && releases) {
    latestMacos = latestInCycle(releases, macosVersion) ?? newestMacos(releases);
    macosUpToDate = latestMacos
      ? compareVersions(macosVersion, latestMacos) >= 0
      : null;
  }

  // fdesetup status → "FileVault is On." / "FileVault is Off."
  const fileVault = bool(raw.fdesetup, /FileVault is On/i, /FileVault is Off/i);

  // socketfilterfw --getglobalstate → "Firewall is enabled. (State = 1)" / "disabled"
  const firewall = bool(
    raw.firewall,
    /enabled|State\s*=\s*[12]/i,
    /disabled|State\s*=\s*0/i,
  );
  // Output varies by release: "Stealth mode enabled" / "Firewall stealth mode is on".
  const firewallStealth = bool(
    raw.firewallStealth,
    /stealth mode.*\b(enabled|on)\b/i,
    /stealth mode.*\b(disabled|off)\b/i,
  );

  // csrutil status → "System Integrity Protection status: enabled."
  const sip = bool(
    raw.csrutil,
    /status:\s*enabled/i,
    /status:\s*disabled/i,
  );

  // spctl --status → "assessments enabled" / "assessments disabled"
  const gatekeeper = bool(
    raw.spctl,
    /assessments enabled/i,
    /assessments disabled/i,
  );

  // softwareupdate -l → "* Label: macOS Sonoma 14.6.1-..." lines, or
  // "No new software available."
  const pendingUpdates: string[] = [];
  if (raw.softwareupdate && !/No new software available/i.test(raw.softwareupdate)) {
    for (const m of raw.softwareupdate.matchAll(/\*\s*Label:\s*(.+)/g)) {
      pendingUpdates.push(m[1].trim());
    }
  }

  // df -h / → "…  Size  Used  Avail Capacity …" — take the data-volume line.
  let diskUsedPercent: number | null = null;
  let diskAvailable: string | null = null;
  const dfLine = raw.df
    ?.split("\n")
    .find((l) => /\d+%/.test(l) && /^\/dev\//.test(l.trim()));
  if (dfLine) {
    const cols = dfLine.trim().split(/\s+/);
    const pct = cols.find((c) => /^\d+%$/.test(c));
    if (pct) diskUsedPercent = parseInt(pct, 10);
    // Avail is the column right before Capacity(%) in df -h output.
    const pctIdx = cols.findIndex((c) => /^\d+%$/.test(c));
    if (pctIdx > 0) diskAvailable = cols[pctIdx - 1];
  }

  const uptime = raw.uptime?.match(/up\s+([^,]+(?:,\s*[\d:]+)?)/)?.[1] ?? null;

  return {
    macosVersion,
    macosBuild,
    latestMacos,
    macosUpToDate,
    fileVault,
    firewall,
    firewallStealth,
    sip,
    gatekeeper,
    pendingUpdates,
    diskUsedPercent,
    diskAvailable,
    uptime,
  };
}

// ---------- Grading ----------

export interface DeepAnalysis {
  posture: DeepScanPosture;
  findings: Finding[];
  trustScore: number;
  riskScore: number;
}

export function gradeDeepScan(
  raw: DeepRawBlobs,
  releases: MacosRelease[] | null,
): DeepAnalysis {
  const posture = parsePosture(raw, releases);
  const findings: Finding[] = [];

  // Fail closed: a security scan must never mistake missing readings for a
  // healthy Mac. Each unreadable core protection is flagged, penalized, and
  // caps the score.
  const coreReadings: { key: string; state: boolean | null }[] = [
    { key: "FileVault disk encryption", state: posture.fileVault },
    { key: "macOS firewall", state: posture.firewall },
    { key: "System Integrity Protection", state: posture.sip },
    { key: "Gatekeeper app screening", state: posture.gatekeeper },
  ];
  const unreadable = coreReadings.filter((r) => r.state === null);
  if (unreadable.length > 0) {
    findings.push({
      title: `Incomplete scan — ${unreadable.length} core protection${unreadable.length > 1 ? "s" : ""} could not be read`,
      detail: `Could not verify: ${unreadable.map((r) => r.key).join(", ")}. PRISM does not assume unknown settings are safe. Re-run the Terminal command; if this repeats, the readings may require running the command from an administrator account.`,
      severity: unreadable.length >= 3 ? "high" : "medium",
    });
  }

  // macOS freshness (within the Mac's own release cycle)
  if (posture.macosUpToDate === false) {
    findings.push({
      title: `macOS ${posture.macosVersion} is behind the current release (${posture.latestMacos})`,
      detail:
        "Apple ships security fixes in every release, and attackers reverse-engineer them within days. Open System Settings → General → Software Update and install the update.",
      severity: "high",
    });
  } else if (posture.macosUpToDate === true) {
    const newest = releases ? newestMacos(releases) : null;
    const newerMajor =
      newest &&
      posture.macosVersion &&
      compareVersions(newest, posture.macosVersion) > 0
        ? newest
        : null;
    findings.push({
      title: `macOS ${posture.macosVersion} is fully patched for its release line`,
      detail: newerMajor
        ? `Checked live against Apple's actual release history. A newer major version (macOS ${newerMajor}) is available — older lines keep getting security fixes for a while, but plan the upgrade.`
        : `Checked live against Apple's actual release history (${posture.latestMacos}).`,
      severity: "low",
    });
  } else if (posture.macosVersion) {
    findings.push({
      title: "macOS freshness could not be verified",
      detail: `This Mac reports macOS ${posture.macosVersion}, but the live release feed was unavailable, so freshness could not be confirmed. Keep automatic updates on.`,
      severity: "low",
    });
  }

  // FileVault
  if (posture.fileVault === false) {
    findings.push({
      title: "FileVault disk encryption is OFF",
      detail:
        "If this Mac is lost or stolen, everything on the disk is readable by pulling the drive or booting recovery tools. Turn it on: System Settings → Privacy & Security → FileVault. It runs in the background with no noticeable slowdown on modern Macs.",
      severity: "critical",
    });
  } else if (posture.fileVault === true) {
    findings.push({
      title: "FileVault disk encryption is on",
      detail: "The disk is unreadable without your login password — the single most important laptop protection.",
      severity: "low",
    });
  }

  // Firewall
  if (posture.firewall === false) {
    findings.push({
      title: "macOS firewall is OFF",
      detail:
        "Other devices on the same network can reach services running on this Mac. Turn it on: System Settings → Network → Firewall. Especially important on shared Wi-Fi.",
      severity: "high",
    });
  } else if (posture.firewall === true && posture.firewallStealth === false) {
    findings.push({
      title: "Firewall is on, but stealth mode is off",
      detail:
        "The Mac still answers network probes (pings), announcing its presence. Enabling stealth mode in the firewall options makes it invisible to casual scans.",
      severity: "low",
    });
  }

  // SIP
  if (posture.sip === false) {
    findings.push({
      title: "System Integrity Protection is DISABLED",
      detail:
        "SIP stops even administrator-level malware from modifying core system files. It is only ever disabled deliberately (often for development tools) — if you did not do this yourself, treat it as a serious red flag. Re-enable it from macOS Recovery (csrutil enable).",
      severity: "critical",
    });
  } else if (posture.sip === true) {
    findings.push({
      title: "System Integrity Protection is enabled",
      detail: "Core system files are protected even from admin-level processes.",
      severity: "low",
    });
  }

  // Gatekeeper
  if (posture.gatekeeper === false) {
    findings.push({
      title: "Gatekeeper app screening is DISABLED",
      detail:
        "Gatekeeper blocks unsigned and known-malicious apps from launching. With it off, any downloaded program can run silently. Re-enable it: run 'sudo spctl --master-enable' in Terminal.",
      severity: "high",
    });
  } else if (posture.gatekeeper === true) {
    findings.push({
      title: "Gatekeeper app screening is on",
      detail: "Downloaded apps are checked for known malware and valid signatures before launching.",
      severity: "low",
    });
  }

  // Pending updates
  if (posture.pendingUpdates.length > 0) {
    findings.push({
      title: `${posture.pendingUpdates.length} software update${posture.pendingUpdates.length > 1 ? "s" : ""} waiting to be installed`,
      detail: `Pending: ${posture.pendingUpdates.slice(0, 3).join("; ")}${posture.pendingUpdates.length > 3 ? "…" : ""}. Updates often contain security fixes — install them soon.`,
      severity: "medium",
    });
  }

  // Disk
  if (posture.diskUsedPercent != null && posture.diskUsedPercent >= 95) {
    findings.push({
      title: `Startup disk is ${posture.diskUsedPercent}% full`,
      detail:
        "A nearly full disk slows the Mac down and can block macOS updates from installing — which becomes a security problem. Free up space soon.",
      severity: "medium",
    });
  }

  // Score: FileVault and SIP dominate — that mirrors real-world impact.
  let score = 100;
  for (const f of findings) {
    if (f.severity === "critical") score -= 30;
    else if (f.severity === "high") score -= 18;
    else if (f.severity === "medium") score -= 8;
  }
  // A scan with unverified core protections can never look pristine.
  const cap = unreadable.length > 0 ? 100 - 15 * unreadable.length : 100;
  const trustScore = Math.max(0, Math.min(cap, score));
  return { posture, findings, trustScore, riskScore: 100 - trustScore };
}
