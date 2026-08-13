import type { CreateDeviceScanBody } from "@workspace/api-zod";

export type DeviceSignalsInput = ReturnType<
  (typeof CreateDeviceScanBody)["parse"]
>;

export interface Finding {
  title: string;
  detail: string;
  severity: "low" | "medium" | "high" | "critical";
}

export interface SignalReading {
  label: string;
  value: string;
  category: string;
}

// ---------- Browser / OS identification ----------

export interface BrowserId {
  browserName: string;
  browserVersion: string;
  osName: string;
}

export function identifyBrowser(input: DeviceSignalsInput): BrowserId {
  const ua = input.userAgent;
  const brands = input.uaBrands ?? "";

  let browserName = "Unknown browser";
  let browserVersion = "";

  const pick = (re: RegExp) => ua.match(re)?.[1] ?? "";

  if (/EdgA\//.test(ua)) {
    browserName = "Edge";
    browserVersion = pick(/EdgA\/([\d.]+)/);
  } else if (/EdgiOS\//.test(ua)) {
    browserName = "Edge";
    browserVersion = pick(/EdgiOS\/([\d.]+)/);
  } else if (/Edg\//.test(ua) || /Microsoft Edge/.test(brands)) {
    browserName = "Edge";
    browserVersion = pick(/Edg\/([\d.]+)/);
  } else if (/FxiOS\//.test(ua)) {
    browserName = "Firefox";
    browserVersion = pick(/FxiOS\/([\d.]+)/);
  } else if (/CriOS\//.test(ua)) {
    browserName = "Chrome";
    browserVersion = pick(/CriOS\/([\d.]+)/);
  } else if (/OPR\//.test(ua)) {
    browserName = "Opera";
    browserVersion = pick(/OPR\/([\d.]+)/);
  } else if (/Firefox\//.test(ua)) {
    browserName = "Firefox";
    browserVersion = pick(/Firefox\/([\d.]+)/);
  } else if (/Chrome\//.test(ua) || /Chromium|Google Chrome/.test(brands)) {
    browserName = "Chrome";
    browserVersion = pick(/Chrome\/([\d.]+)/);
  } else if (/Safari\//.test(ua) && /Version\//.test(ua)) {
    browserName = "Safari";
    browserVersion = pick(/Version\/([\d.]+)/);
  }

  // Chromium browsers send a reduced UA (patch zeroed, e.g. 136.0.0.0).
  // The full-version client hint, when granted, restores the exact build.
  if (
    input.uaFullVersion &&
    browserVersion &&
    input.uaFullVersion.split(".")[0] === browserVersion.split(".")[0]
  ) {
    browserVersion = input.uaFullVersion;
  }

  const platform = (input.uaPlatform || input.platform || "").toLowerCase();
  let osName = "Unknown OS";
  if (/iPhone|iPad|iPod/.test(ua)) {
    osName = "iOS";
  } else if (/Android/.test(ua) || platform.includes("android")) {
    osName = "Android";
  } else if (platform.includes("mac") || /Macintosh|Mac OS X/.test(ua)) {
    osName = "macOS";
  } else if (platform.includes("win") || /Windows/.test(ua)) {
    osName = "Windows";
  } else if (platform.includes("linux") || /Linux/.test(ua)) {
    osName = "Linux";
  }
  return { browserName, browserVersion, osName };
}

// ---------- Live latest-version lookup (real data, no key) ----------

const versionCache = new Map<string, { value: string | null; at: number }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

function chromePlatformSlug(osName: string): string | null {
  switch (osName) {
    case "macOS":
      return "mac";
    case "Windows":
      return "win64";
    case "Android":
      return "android";
    case "iOS":
      return "ios";
    case "Linux":
      return "linux";
    default:
      return null; // Unknown OS → do not guess a platform feed
  }
}

function edgePlatformName(osName: string): string | null {
  switch (osName) {
    case "macOS":
      return "MacOS";
    case "Windows":
      return "Windows";
    case "Android":
      return "Android";
    case "iOS":
      return "iOS";
    case "Linux":
      return "Linux";
    default:
      return null; // Unknown OS → do not guess a platform feed
  }
}

/**
 * Latest stable version for the browser on the visitor's platform,
 * fetched live from the vendor's own release feed (null if unknown).
 */
export async function latestStableVersion(
  browserName: string,
  osName: string,
): Promise<string | null> {
  const cacheKey = `${browserName}:${osName}`;
  const cached = versionCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  let value: string | null = null;
  try {
    if (browserName === "Chrome") {
      const slug = chromePlatformSlug(osName);
      if (slug) {
        const data = (await fetchJson(
          `https://versionhistory.googleapis.com/v1/chrome/platforms/${slug}/channels/stable/versions?pageSize=1`,
        )) as { versions?: { version?: string }[] };
        value = data.versions?.[0]?.version ?? null;
      }
    } else if (browserName === "Edge") {
      const data = (await fetchJson(
        "https://edgeupdates.microsoft.com/api/products",
      )) as {
        Product?: string;
        Releases?: { Platform?: string; ProductVersion?: string }[];
      }[];
      const stable = Array.isArray(data)
        ? data.find((p) => p.Product === "Stable")
        : undefined;
      const platform = edgePlatformName(osName);
      // Exact platform match only — never compare a phone against a
      // desktop release. Unknown platform → unverified.
      const release = platform
        ? stable?.Releases?.find((r) => r.Platform === platform)
        : undefined;
      value = release?.ProductVersion ?? null;
    } else if (browserName === "Firefox") {
      if (osName === "Android" || osName === "iOS") {
        // Mobile Firefox is released and versioned independently.
        const data = (await fetchJson(
          "https://product-details.mozilla.org/1.0/mobile_versions.json",
        )) as { version?: string; ios_version?: string };
        value =
          (osName === "Android" ? data.version : data.ios_version) ?? null;
      } else if (
        osName === "Windows" ||
        osName === "macOS" ||
        osName === "Linux"
      ) {
        const data = (await fetchJson(
          "https://product-details.mozilla.org/1.0/firefox_versions.json",
        )) as { LATEST_FIREFOX_VERSION?: string };
        value = data.LATEST_FIREFOX_VERSION ?? null;
      }
      // Unknown platform → unverified.
    }
    // Safari/Opera: no free live endpoint; report unknown rather than fake it.
  } catch {
    value = null;
  }
  // Reject malformed feed values — every segment must be numeric.
  if (value && !isValidVersion(value)) value = null;
  versionCache.set(cacheKey, { value, at: Date.now() });
  return value;
}

/** True when every dot-separated segment is a plain non-negative integer. */
export function isValidVersion(v: string): boolean {
  return /^\d+(\.\d+)*$/.test(v);
}

/** Segment-wise numeric version comparison: -1, 0 or 1. */
export function compareVersions(a: string, b: string): number {
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

/** True if this looks like a reduced/truncated version (patch info zeroed or missing). */
export function isReducedVersion(v: string): boolean {
  const parts = v.split(".");
  if (parts.length < 3) return true;
  return parts.slice(1).every((p) => p === "0");
}

/**
 * Freshness verdict:
 * - true  → full version verified >= current stable
 * - false → verifiably behind current stable (older major, or same major
 *           with an older full version)
 * - null  → cannot verify (no feed, malformed versions, or only a reduced
 *           version is available and its major matches stable)
 */
export function isUpToDate(
  current: string,
  latest: string | null,
): boolean | null {
  if (!latest || !current) return null;
  if (!isValidVersion(current) || !isValidVersion(latest)) return null;
  const curMajor = parseInt(current.split(".")[0], 10);
  const latestMajor = parseInt(latest.split(".")[0], 10);
  if (Number.isNaN(curMajor) || Number.isNaN(latestMajor)) return null;
  if (curMajor < latestMajor) return false;
  if (curMajor > latestMajor) return true;
  // Same major: only claim "up to date" when we have the full version.
  if (isReducedVersion(current)) return null;
  return compareVersions(current, latest) >= 0;
}

// ---------- Fingerprint exposure + findings ----------

export interface DeviceAnalysis {
  fingerprintExposure: number;
  findings: Finding[];
  signals: SignalReading[];
}

export function analyzeSignals(
  input: DeviceSignalsInput,
  id: BrowserId,
  latest: string | null,
  upToDate: boolean | null,
): DeviceAnalysis {
  const findings: Finding[] = [];
  const signals: SignalReading[] = [];
  let exposure = 0;

  const add = (label: string, value: string, category: string) => {
    signals.push({ label, value, category });
  };

  // Identity
  add("User agent", input.userAgent, "Identity");
  if (input.uaBrands) add("Browser brands", input.uaBrands, "Identity");
  add(
    "Platform",
    input.uaPlatform || input.platform || "Not exposed",
    "Identity",
  );
  if (input.uaArchitecture) {
    add("CPU architecture", input.uaArchitecture, "Identity");
    exposure += 5;
  }

  // Browser freshness
  if (upToDate === false) {
    findings.push({
      title: `${id.browserName} is out of date`,
      detail: `You are running ${id.browserName} ${id.browserVersion}, while the current stable release is ${latest}. Outdated browsers miss recent security patches and are the single most common infection path on personal devices.`,
      severity: "high",
    });
  } else if (upToDate === true) {
    findings.push({
      title: `${id.browserName} is up to date`,
      detail: `Version ${id.browserVersion} matches the current stable major release (${latest}) for ${id.osName}. Checked live against the vendor's release feed.`,
      severity: "low",
    });
  } else if (latest) {
    findings.push({
      title: "Browser patch level could not be fully verified",
      detail: `${id.browserName} reports major version ${id.browserVersion.split(".")[0]}, which matches the current stable major (${latest} on ${id.osName}), but the exact patch build could not be confirmed from the version your browser exposes. Keep automatic updates enabled.`,
      severity: "low",
    });
  } else {
    findings.push({
      title: "Browser version could not be verified",
      detail: `No live release feed is available for ${id.browserName}, so freshness could not be confirmed. Keep automatic updates enabled.`,
      severity: "low",
    });
  }

  // Screen & hardware
  if (input.screenWidth && input.screenHeight) {
    add(
      "Screen",
      `${input.screenWidth}x${input.screenHeight} @ ${input.pixelRatio ?? 1}x, ${input.colorDepth ?? "?"}-bit`,
      "Hardware",
    );
    exposure += 8;
  }
  if (input.hardwareConcurrency != null) {
    add("CPU cores", String(input.hardwareConcurrency), "Hardware");
    exposure += 6;
  } else {
    add("CPU cores", "Not exposed", "Hardware");
  }
  if (input.deviceMemory != null) {
    add("Device memory", `${input.deviceMemory} GB (approx.)`, "Hardware");
    exposure += 6;
  } else {
    add("Device memory", "Not exposed", "Hardware");
  }
  if (input.webglRenderer) {
    add("GPU (WebGL renderer)", input.webglRenderer, "Hardware");
    exposure += 14;
    findings.push({
      title: "Graphics card model is exposed",
      detail: `Any website can read your GPU model ("${input.webglRenderer.slice(0, 80)}") through WebGL. Combined with other signals, this makes your device significantly more identifiable across sites.`,
      severity: "medium",
    });
  } else {
    add("GPU (WebGL renderer)", "Not exposed", "Hardware");
  }
  if (input.canvasHash) {
    add("Canvas fingerprint", input.canvasHash, "Hardware");
    exposure += 14;
    findings.push({
      title: "Canvas fingerprinting is possible",
      detail:
        "Your browser renders graphics in a measurably unique way. Trackers hash this output to re-identify your device even without cookies. Browsers like Firefox/Safari (or extensions) can add noise to block this.",
      severity: "medium",
    });
  }

  // Locale & time
  if (input.timezone) {
    add("Timezone", input.timezone, "Locale");
    exposure += 5;
  }
  if (input.languages?.length) {
    add("Languages", input.languages.join(", "), "Locale");
    exposure += input.languages.length > 1 ? 6 : 3;
  }

  // Network
  add("Online", input.online === false ? "No" : "Yes", "Network");
  if (input.connectionType) {
    add("Connection type", input.connectionType, "Network");
    exposure += 4;
  }
  if (input.downlink != null) {
    add("Downlink estimate", `${input.downlink} Mbps`, "Network");
  }
  if (input.rtt != null) add("Latency estimate", `${input.rtt} ms`, "Network");

  // Battery
  if (input.batteryLevel != null) {
    add(
      "Battery",
      `${Math.round(input.batteryLevel * 100)}%${input.batteryCharging ? " (charging)" : ""}`,
      "Hardware",
    );
    exposure += 5;
    findings.push({
      title: "Battery status is readable",
      detail:
        "Websites can read your battery level and charging state. Research has shown this can be abused for short-term tracking and even dynamic pricing pressure on low-battery users.",
      severity: "low",
    });
  } else {
    add("Battery", "Not exposed", "Hardware");
  }

  // Privacy posture
  add(
    "Cookies enabled",
    input.cookiesEnabled === false ? "No" : "Yes",
    "Privacy",
  );
  const dnt = input.doNotTrack;
  add("Do Not Track", dnt === "1" ? "Enabled" : dnt ? dnt : "Not set", "Privacy");
  if (dnt !== "1") {
    findings.push({
      title: "No tracking-refusal signal",
      detail:
        "Your browser is not sending a Do-Not-Track / privacy preference signal. Most sites ignore it anyway, but privacy-hardened browsers set it and reduce fingerprinting surface at the same time.",
      severity: "low",
    });
  }
  if (input.touchPoints != null) {
    add("Touch support", input.touchPoints > 0 ? `${input.touchPoints} points` : "None", "Hardware");
  }

  // Permissions
  for (const p of input.permissions ?? []) {
    add(`Permission: ${p.name}`, p.state, "Permissions");
    if (p.state === "granted" && ["camera", "microphone", "geolocation"].includes(p.name)) {
      findings.push({
        title: `${p.name[0].toUpperCase()}${p.name.slice(1)} permission is granted to this site`,
        detail: `This origin currently holds a standing grant for your ${p.name}. Review site permissions periodically and revoke grants you no longer use.`,
        severity: "medium",
      });
    }
  }

  const exposureScore = Math.max(0, Math.min(100, Math.round(exposure * 1.4)));
  if (exposureScore >= 60) {
    findings.push({
      title: "High fingerprinting exposure",
      detail: `Your browser exposes enough hardware and locale detail (${exposureScore}/100) that trackers can likely re-identify this device across websites without any cookies.`,
      severity: "high",
    });
  } else if (exposureScore >= 30) {
    findings.push({
      title: "Moderate fingerprinting exposure",
      detail: `A meaningful set of identifying surfaces (${exposureScore}/100) is readable by any site you visit. A privacy-focused browser or extension can reduce this.`,
      severity: "medium",
    });
  }

  return { fingerprintExposure: exposureScore, findings, signals };
}

export function computeTrustScore(
  upToDate: boolean | null,
  exposure: number,
  findings: Finding[],
): number {
  let score = 100;
  if (upToDate === false) score -= 35;
  score -= Math.round(exposure * 0.4);
  for (const f of findings) {
    if (f.severity === "critical") score -= 15;
    else if (f.severity === "high" && !f.title.includes("fingerprinting")) score -= 5;
  }
  return Math.max(0, Math.min(100, score));
}
