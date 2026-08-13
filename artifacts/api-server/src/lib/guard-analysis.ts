/**
 * Hardware & Network Guard — server-side parsing and risk grading of raw,
 * read-only command output collected by the Terminal agent. The agent sends
 * base64-encoded raw text; everything meaningful is derived here so the
 * script stays tiny and auditable.
 */
import type { Finding } from "./device-analysis";

export interface GuardSystem {
  cpuBrand: string | null;
  cpuCores: number | null;
  loadAvg1: number | null;
  cpuUsagePercent: number | null;
  memTotalGb: number | null;
  memUsedGb: number | null;
  memPressurePercent: number | null; // free percentage (higher = healthier)
  gpuName: string | null;
  thermalPressure: string | null;
  batteryHealth: string | null;
  batteryCycleCount: number | null;
  uptime: string | null;
}

export interface GuardDevice {
  name: string;
  vendor: string | null;
  kind: "usb" | "thunderbolt" | "storage";
  removable: boolean | null;
  encrypted: boolean | null;
  capacityGb: number | null;
  riskGrade: "low" | "medium" | "high" | "critical";
  isNew: boolean;
  note: string | null;
}

export interface GuardNetwork {
  interfaceType: string | null;
  interfaceName: string | null;
  ssid: string | null;
  security: string | null;
  openNetwork: boolean | null;
  localDeviceCount: number | null;
}

export interface RawBlobs {
  hostname?: string;
  sysctl?: string;
  top?: string;
  memoryPressure?: string;
  thermal?: string;
  spusb?: string;
  spthunderbolt?: string;
  spstorage?: string;
  spdisplays?: string;
  sppower?: string;
  spairport?: string;
  netif?: string;
  arp?: string;
  uptime?: string;
}

/** Per-field decoded cap; real system_profiler output stays well under this. */
const MAX_DECODED_FIELD_BYTES = 2 * 1024 * 1024;
const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

export function decodeBlobs(raw: Record<string, string | undefined>): RawBlobs {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v !== "string" || !v) continue;
    // Node's base64 decoder is permissive; enforce canonical base64 so
    // garbage input is treated as absent rather than silently mangled.
    if (!BASE64_RE.test(v) || v.length % 4 !== 0) continue;
    const buf = Buffer.from(v, "base64");
    if (buf.length === 0 || buf.length > MAX_DECODED_FIELD_BYTES) continue;
    out[k] = buf.toString("utf8");
  }
  return out as RawBlobs;
}

/**
 * A submission must carry at least the core readings the agent always
 * produces; otherwise a garbage POST would be graded as a pristine machine.
 */
export function hasMinimumTelemetry(raw: RawBlobs): boolean {
  return Boolean(raw.hostname && raw.sysctl && (raw.spusb || raw.spstorage));
}

function json(text: string | undefined): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function num(re: RegExp, text: string | undefined): number | null {
  const m = text?.match(re);
  if (!m) return null;
  const v = parseFloat(m[1]);
  return Number.isFinite(v) ? v : null;
}

function str(re: RegExp, text: string | undefined): string | null {
  const m = text?.match(re);
  return m ? m[1].trim() : null;
}

// ---------- System readings ----------

export function parseSystem(raw: RawBlobs): GuardSystem {
  const cpuBrand = str(/machdep\.cpu\.brand_string:\s*(.+)/, raw.sysctl);
  const cpuCores = num(/hw\.ncpu:\s*(\d+)/, raw.sysctl);
  const memBytes = num(/hw\.memsize:\s*(\d+)/, raw.sysctl);
  const loadAvg1 = num(/vm\.loadavg:\s*\{\s*([\d.]+)/, raw.sysctl);

  // top -l 1: "CPU usage: 7.89% user, 12.5% sys, 79.6% idle"
  const idle = num(/CPU usage:.*?([\d.]+)%\s*idle/, raw.top);
  const cpuUsagePercent = idle == null ? null : Math.round((100 - idle) * 10) / 10;
  // top: "PhysMem: 11G used (2115M wired, ...), 4523M unused."
  const usedRaw = str(/PhysMem:\s*([\d.]+[GM])\s*used/i, raw.top);
  let memUsedGb: number | null = null;
  if (usedRaw) {
    const v = parseFloat(usedRaw);
    memUsedGb = usedRaw.toUpperCase().endsWith("M")
      ? Math.round((v / 1024) * 10) / 10
      : v;
  }

  const memPressurePercent = num(
    /free percentage:\s*([\d.]+)%/,
    raw.memoryPressure,
  );

  // pmset -g therm: "CPU_Speed_Limit     = 100"
  const speedLimit = num(/CPU_Speed_Limit\s*=\s*(\d+)/, raw.thermal);
  const thermalPressure =
    speedLimit == null
      ? null
      : speedLimit >= 100
        ? "Nominal"
        : `Throttled (CPU limited to ${speedLimit}%)`;

  // GPU from system_profiler SPDisplaysDataType -json
  let gpuName: string | null = null;
  const disp = json(raw.spdisplays) as
    | { SPDisplaysDataType?: { sppci_model?: string; _name?: string }[] }
    | null;
  if (disp?.SPDisplaysDataType?.length) {
    gpuName =
      disp.SPDisplaysDataType[0].sppci_model ??
      disp.SPDisplaysDataType[0]._name ??
      null;
  }

  // Battery from SPPowerDataType -json
  let batteryHealth: string | null = null;
  let batteryCycleCount: number | null = null;
  const power = json(raw.sppower) as
    | {
        SPPowerDataType?: {
          sppower_battery_health_info?: {
            sppower_battery_health?: string;
            sppower_battery_cycle_count?: number;
          };
        }[];
      }
    | null;
  for (const item of power?.SPPowerDataType ?? []) {
    const h = item.sppower_battery_health_info;
    if (h) {
      batteryHealth = h.sppower_battery_health ?? null;
      batteryCycleCount =
        typeof h.sppower_battery_cycle_count === "number"
          ? h.sppower_battery_cycle_count
          : null;
    }
  }

  const uptime = str(/up\s+([^,]+(?:,\s*[\d:]+)?)/, raw.uptime);

  return {
    cpuBrand,
    cpuCores,
    loadAvg1,
    cpuUsagePercent,
    memTotalGb: memBytes ? Math.round(memBytes / 1024 ** 3) : null,
    memUsedGb,
    memPressurePercent,
    gpuName,
    thermalPressure,
    batteryHealth,
    batteryCycleCount,
    uptime,
  };
}

// ---------- Device inventory ----------

interface UsbNode {
  _name?: string;
  manufacturer?: string;
  vendor_id?: string;
  _items?: UsbNode[];
}

function walkUsb(nodes: UsbNode[] | undefined, out: GuardDevice[]): void {
  for (const n of nodes ?? []) {
    // Buses/hubs themselves carry _items; leaf entries are actual devices.
    const isBus = /bus/i.test(n._name ?? "");
    if (n._name && !isBus) {
      out.push({
        name: n._name,
        vendor: n.manufacturer ?? n.vendor_id ?? null,
        kind: "usb",
        removable: null,
        encrypted: null,
        capacityGb: null,
        riskGrade: "low",
        isNew: false,
        note: null,
      });
    }
    walkUsb(n._items, out);
  }
}

interface StorageItem {
  _name?: string;
  size_in_bytes?: number;
  mount_point?: string;
  file_system?: string;
  physical_drive?: {
    is_internal_disk?: string;
    device_name?: string;
    medium_type?: string;
  };
  // APFS encryption flags vary by macOS release; accept the known spellings.
  encrypted?: string;
  lv_encrypted?: string;
  lvf_encrypted?: string;
}

export function parseDevices(raw: RawBlobs): GuardDevice[] {
  const devices: GuardDevice[] = [];

  const usb = json(raw.spusb) as { SPUSBDataType?: UsbNode[] } | null;
  walkUsb(usb?.SPUSBDataType, devices);

  interface TbNode {
    _name?: string;
    device_name_key?: string;
    vendor_name_key?: string;
    _items?: TbNode[];
  }
  const walkTb = (nodes: TbNode[] | undefined): void => {
    for (const item of nodes ?? []) {
      const name = item.device_name_key ?? item._name;
      // The Mac's own root Thunderbolt/USB4 bus entries are not peripherals,
      // but attached devices nest under them in _items.
      if (name && !/^(thunderbolt|usb4)/i.test(name.trim())) {
        devices.push({
          name,
          vendor: item.vendor_name_key ?? null,
          kind: "thunderbolt",
          removable: null,
          encrypted: null,
          capacityGb: null,
          riskGrade: "low",
          isNew: false,
          note: null,
        });
      }
      walkTb(item._items);
    }
  };
  const tb = json(raw.spthunderbolt) as
    | { SPThunderboltDataType?: TbNode[] }
    | null;
  walkTb(tb?.SPThunderboltDataType);

  const storage = json(raw.spstorage) as
    | { SPStorageDataType?: StorageItem[] }
    | null;
  for (const item of storage?.SPStorageDataType ?? []) {
    const internal =
      (item.physical_drive?.is_internal_disk ?? "").toLowerCase() === "yes";
    if (internal) continue; // only externally attached drives are inventory
    const encRaw = (
      item.encrypted ??
      item.lv_encrypted ??
      item.lvf_encrypted ??
      ""
    ).toLowerCase();
    devices.push({
      name: item._name ?? item.physical_drive?.device_name ?? "External volume",
      vendor: item.physical_drive?.device_name ?? null,
      kind: "storage",
      removable: true,
      encrypted: encRaw ? encRaw === "yes" : null,
      capacityGb: item.size_in_bytes
        ? Math.round((item.size_in_bytes / 1024 ** 3) * 10) / 10
        : null,
      riskGrade: "low",
      isNew: false,
      note: null,
    });
  }

  return devices;
}

// ---------- Network posture ----------

export function parseNetwork(raw: RawBlobs): GuardNetwork {
  const interfaceName = str(/interface:\s*(\S+)/, raw.netif);

  // Map the default-route device to its hardware port (Wi-Fi / Ethernet).
  let interfaceType: string | null = null;
  if (interfaceName && raw.netif) {
    const port = str(
      new RegExp(
        `Hardware Port:\\s*([^\\n]+)\\n[^\\n]*Device:\\s*${interfaceName}\\b`,
      ),
      raw.netif,
    );
    interfaceType = port;
  }

  // SPAirPortDataType -json → current network info
  let ssid: string | null = null;
  let security: string | null = null;
  const air = json(raw.spairport) as
    | {
        SPAirPortDataType?: {
          spairport_airport_interfaces?: {
            _name?: string;
            spairport_current_network_information?: {
              _name?: string;
              spairport_security_mode?: string;
            };
          }[];
        }[];
      }
    | null;
  for (const entry of air?.SPAirPortDataType ?? []) {
    for (const iface of entry.spairport_airport_interfaces ?? []) {
      const cur = iface.spairport_current_network_information;
      if (cur?._name) {
        ssid = cur._name;
        security = cur.spairport_security_mode ?? null;
      }
    }
  }
  const secLabel = security
    ? security
        .replace(/^spairport_security_mode_/, "")
        .replace(/_/g, " ")
        .toUpperCase()
    : null;
  const openNetwork =
    secLabel == null ? null : /NONE|OPEN/.test(secLabel);

  // arp -a → one line per neighbor; ignore incomplete entries
  const localDeviceCount = raw.arp
    ? raw.arp
        .split("\n")
        .filter((l) => l.includes(" at ") && !l.includes("incomplete")).length
    : null;

  if (!interfaceType && ssid) interfaceType = "Wi-Fi";

  return {
    interfaceType,
    interfaceName,
    ssid,
    security: secLabel,
    openNetwork,
    localDeviceCount,
  };
}

// ---------- Grading ----------

export interface GuardAnalysis {
  system: GuardSystem;
  devices: GuardDevice[];
  network: GuardNetwork;
  findings: Finding[];
  trustScore: number;
  riskScore: number;
}

const TRUSTED_VENDORS = /apple|logitech|keychron|dell|lg|samsung|anker|belkin|sandisk|western digital|seagate|kingston|corsair|razer|hp|lenovo|microsoft/i;

export function gradeGuardScan(
  raw: RawBlobs,
  previouslySeenDeviceKeys: Set<string>,
): GuardAnalysis {
  const system = parseSystem(raw);
  const devices = parseDevices(raw);
  const network = parseNetwork(raw);
  const findings: Finding[] = [];

  // --- Devices ---
  for (const d of devices) {
    const key = deviceKey(d);
    d.isNew =
      previouslySeenDeviceKeys.size > 0 && !previouslySeenDeviceKeys.has(key);

    if (d.kind === "storage" && d.encrypted === false) {
      d.riskGrade = "high";
      d.note = "Unencrypted external drive — anyone who takes it reads it.";
      findings.push({
        title: `External drive "${d.name}" is not encrypted`,
        detail:
          "Everything on this drive is readable by anyone who plugs it into any computer. If it holds anything personal, turn on encryption (right-click the drive in Finder → Encrypt) or keep it physically secure.",
        severity: "high",
      });
    } else if (d.kind === "storage" && d.encrypted === null) {
      d.riskGrade = "medium";
      d.note = "Encryption state could not be confirmed.";
    }

    if (d.kind === "usb" && (!d.vendor || d.vendor.trim() === "")) {
      if (d.riskGrade === "low") d.riskGrade = "medium";
      d.note = d.note ?? "No manufacturer reported — identity unverified.";
      findings.push({
        title: `USB device "${d.name}" reports no manufacturer`,
        detail:
          "Legitimate accessories almost always identify their maker. A device that hides its identity deserves scrutiny — if you do not recognize it, unplug it.",
        severity: "medium",
      });
    } else if (
      d.kind === "usb" &&
      d.vendor &&
      !TRUSTED_VENDORS.test(d.vendor)
    ) {
      if (d.riskGrade === "low") d.riskGrade = "medium";
      d.note = d.note ?? `Vendor "${d.vendor}" is not on the common-vendor list.`;
    }

    if (d.isNew) {
      if (d.riskGrade === "low") d.riskGrade = "medium";
      findings.push({
        title: `New device detected: "${d.name}"`,
        detail: `This ${d.kind === "storage" ? "drive" : "device"} was not present in any earlier Guard scan on this browser session. If you did not plug it in yourself, unplug it now and find out where it came from.`,
        severity: "medium",
      });
    }
  }

  if (devices.length === 0) {
    findings.push({
      title: "No external hardware detected",
      detail:
        "Nothing beyond the Mac's built-in hardware is currently attached — the physical attack surface is as small as it gets.",
      severity: "low",
    });
  }

  // --- Network ---
  if (network.openNetwork === true) {
    findings.push({
      title: `Open Wi-Fi network${network.ssid ? ` ("${network.ssid}")` : ""}`,
      detail:
        "This network has no encryption. Anyone nearby can read unprotected traffic and impersonate the network. Avoid logging into anything sensitive, or use a VPN until you are back on a protected network.",
      severity: "high",
    });
  } else if (network.security && /WEP/.test(network.security)) {
    findings.push({
      title: "Wi-Fi uses obsolete WEP encryption",
      detail:
        "WEP has been broken for nearly two decades and can be cracked in minutes. Treat this network as open — and if it is yours, switch the router to WPA2 or WPA3.",
      severity: "high",
    });
  } else if (network.security) {
    findings.push({
      title: `Wi-Fi is protected (${network.security})`,
      detail: "Traffic between this Mac and the router is encrypted.",
      severity: "low",
    });
  }

  if (network.localDeviceCount != null && network.localDeviceCount > 30) {
    findings.push({
      title: `${network.localDeviceCount} devices visible on this network`,
      detail:
        "This looks like a busy shared network (office, café, hotel). Every one of those devices can see this Mac exists. Keep file sharing off and prefer HTTPS/VPN here.",
      severity: "medium",
    });
  }

  // --- System health ---
  if (
    system.loadAvg1 != null &&
    system.cpuCores != null &&
    system.cpuCores > 0 &&
    system.loadAvg1 / system.cpuCores > 1.5
  ) {
    findings.push({
      title: "CPU is under unusually heavy load",
      detail: `Load average ${system.loadAvg1} across ${system.cpuCores} cores. If you are not running heavy work right now, check Activity Monitor — sustained unexplained load can indicate unwanted background processes such as cryptominers.`,
      severity: "medium",
    });
  }
  if (system.memPressurePercent != null && system.memPressurePercent < 10) {
    findings.push({
      title: "Memory is nearly exhausted",
      detail: `Only ${system.memPressurePercent}% of system memory is free. The Mac will slow down and swap heavily; close unused apps and check Activity Monitor for memory hogs.`,
      severity: "medium",
    });
  }
  if (system.thermalPressure && system.thermalPressure !== "Nominal") {
    findings.push({
      title: "CPU is being thermally throttled",
      detail: `${system.thermalPressure}. The machine is slowing itself down to stay cool — check ventilation and what is driving the heat.`,
      severity: "medium",
    });
  }

  // --- Score ---
  let score = 100;
  for (const f of findings) {
    if (f.severity === "critical") score -= 30;
    else if (f.severity === "high") score -= 18;
    else if (f.severity === "medium") score -= 8;
  }
  const trustScore = Math.max(0, Math.min(100, score));

  return {
    system,
    devices,
    network,
    findings,
    trustScore,
    riskScore: 100 - trustScore,
  };
}

export function deviceKey(d: Pick<GuardDevice, "name" | "vendor" | "kind">): string {
  return `${d.kind}:${(d.vendor ?? "").toLowerCase()}:${d.name.toLowerCase()}`;
}
