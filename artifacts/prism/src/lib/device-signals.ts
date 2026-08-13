// Collects real, live signals from the visitor's browser.
// Every value here is read from actual browser APIs at call time —
// nothing is fabricated. Unavailable APIs are reported as null.

export interface CollectedSignals {
  userAgent: string;
  uaBrands?: string;
  uaFullVersion?: string;
  uaPlatform?: string;
  uaPlatformVersion?: string;
  uaArchitecture?: string;
  uaModel?: string;
  platform?: string;
  vendor?: string;
  languages?: string[];
  timezone?: string;
  screenWidth?: number;
  screenHeight?: number;
  colorDepth?: number;
  pixelRatio?: number;
  hardwareConcurrency?: number | null;
  deviceMemory?: number | null;
  touchPoints?: number;
  cookiesEnabled?: boolean;
  doNotTrack?: string | null;
  online?: boolean;
  connectionType?: string | null;
  downlink?: number | null;
  rtt?: number | null;
  batteryLevel?: number | null;
  batteryCharging?: boolean | null;
  webglRenderer?: string | null;
  webglVendor?: string | null;
  canvasHash?: string | null;
  localStorageEnabled?: boolean;
  pdfViewerEnabled?: boolean;
  permissions?: { name: string; state: string }[];
}

/** A step-by-step collection so the UI can animate progress honestly. */
export interface CollectionStep {
  label: string;
  run: (out: CollectedSignals) => Promise<void> | void;
}

function getWebGl(out: CollectedSignals) {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (!gl) {
      out.webglRenderer = null;
      out.webglVendor = null;
      return;
    }
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    out.webglRenderer = ext
      ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));
    out.webglVendor = ext
      ? String(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL))
      : String(gl.getParameter(gl.VENDOR));
  } catch {
    out.webglRenderer = null;
    out.webglVendor = null;
  }
}

async function getCanvasHash(out: CollectedSignals) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      out.canvasHash = null;
      return;
    }
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(120, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("PRISM device scan \u{1F50D}", 2, 15);
    ctx.strokeStyle = "rgba(102, 204, 0, 0.7)";
    ctx.arc(50, 40, 15, 0, Math.PI * 1.5);
    ctx.stroke();
    const data = canvas.toDataURL();
    const buf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(data),
    );
    out.canvasHash = Array.from(new Uint8Array(buf).slice(0, 8))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    out.canvasHash = null;
  }
}

async function getBattery(out: CollectedSignals) {
  try {
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<{ level: number; charging: boolean }>;
    };
    if (!nav.getBattery) {
      out.batteryLevel = null;
      out.batteryCharging = null;
      return;
    }
    const battery = await nav.getBattery();
    out.batteryLevel = battery.level;
    out.batteryCharging = battery.charging;
  } catch {
    out.batteryLevel = null;
    out.batteryCharging = null;
  }
}

async function getPermissions(out: CollectedSignals) {
  const names = [
    "geolocation",
    "camera",
    "microphone",
    "notifications",
    "clipboard-read",
  ];
  const results: { name: string; state: string }[] = [];
  for (const name of names) {
    try {
      const status = await navigator.permissions.query({
        name: name as PermissionName,
      });
      results.push({ name, state: status.state });
    } catch {
      // Permission name unsupported in this browser — skip honestly.
    }
  }
  out.permissions = results;
}

async function getUaHints(out: CollectedSignals) {
  const nav = navigator as Navigator & {
    userAgentData?: {
      brands: { brand: string; version: string }[];
      platform: string;
      getHighEntropyValues?: (
        hints: string[],
      ) => Promise<
        Record<string, string> & {
          fullVersionList?: { brand: string; version: string }[];
        }
      >;
    };
  };
  const uad = nav.userAgentData;
  if (!uad) return;
  out.uaBrands = uad.brands
    .map((b) => `${b.brand} ${b.version}`)
    .join(", ");
  out.uaPlatform = uad.platform;
  try {
    const high = await uad.getHighEntropyValues?.([
      "platformVersion",
      "architecture",
      "model",
      "fullVersionList",
    ]);
    if (high) {
      out.uaPlatformVersion = high.platformVersion;
      out.uaArchitecture = high.architecture;
      out.uaModel = high.model;
      const list = high.fullVersionList ?? [];
      const real = list.find(
        (b) => !/not.?a.?brand/i.test(b.brand),
      );
      const preferred =
        list.find((b) => /Edge|Opera/i.test(b.brand)) ??
        list.find((b) => /Chrome|Chromium/i.test(b.brand)) ??
        real;
      if (preferred?.version) out.uaFullVersion = preferred.version;
    }
  } catch {
    // High-entropy hints denied — fine.
  }
}

export function buildCollectionSteps(): CollectionStep[] {
  return [
    {
      label: "Reading browser identity",
      run: async (out) => {
        out.userAgent = navigator.userAgent;
        out.platform = navigator.platform;
        out.vendor = navigator.vendor;
        await getUaHints(out);
      },
    },
    {
      label: "Measuring display & hardware surface",
      run: (out) => {
        out.screenWidth = screen.width;
        out.screenHeight = screen.height;
        out.colorDepth = screen.colorDepth;
        out.pixelRatio = window.devicePixelRatio;
        out.hardwareConcurrency = navigator.hardwareConcurrency ?? null;
        out.deviceMemory =
          (navigator as Navigator & { deviceMemory?: number }).deviceMemory ??
          null;
        out.touchPoints = navigator.maxTouchPoints;
      },
    },
    {
      label: "Probing graphics fingerprint",
      run: async (out) => {
        getWebGl(out);
        await getCanvasHash(out);
      },
    },
    {
      label: "Checking locale & privacy posture",
      run: (out) => {
        out.languages = [...navigator.languages];
        out.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        out.cookiesEnabled = navigator.cookieEnabled;
        out.doNotTrack = navigator.doNotTrack ?? null;
        try {
          localStorage.setItem("__prism_probe", "1");
          localStorage.removeItem("__prism_probe");
          out.localStorageEnabled = true;
        } catch {
          out.localStorageEnabled = false;
        }
        out.pdfViewerEnabled = navigator.pdfViewerEnabled ?? false;
      },
    },
    {
      label: "Sampling network & power",
      run: async (out) => {
        out.online = navigator.onLine;
        const conn = (
          navigator as Navigator & {
            connection?: {
              effectiveType?: string;
              downlink?: number;
              rtt?: number;
            };
          }
        ).connection;
        out.connectionType = conn?.effectiveType ?? null;
        out.downlink = conn?.downlink ?? null;
        out.rtt = conn?.rtt ?? null;
        await getBattery(out);
      },
    },
    {
      label: "Auditing site permissions",
      run: getPermissions,
    },
  ];
}
