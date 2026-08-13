import { describe, it, expect } from "vitest";
import {
  decodeBlobs,
  hasMinimumTelemetry,
  parseSystem,
  parseDevices,
  parseNetwork,
  gradeGuardScan,
  deviceKey,
} from "./guard-analysis";

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

const SYSCTL = `machdep.cpu.brand_string: Apple M2 Pro
hw.ncpu: 10
hw.memsize: 17179869184
vm.loadavg: { 2.15 2.40 2.60 }`;

const TOP = `Processes: 500 total
CPU usage: 12.5% user, 6.25% sys, 81.25% idle
PhysMem: 11G used (2115M wired), 4523M unused.`;

const MEMP = `The system has 2147 pages free.
System-wide memory free percentage: 42%`;

const THERM_OK = `CPU_Speed_Limit     = 100`;
const THERM_HOT = `CPU_Speed_Limit     = 60`;

const SPUSB = JSON.stringify({
  SPUSBDataType: [
    {
      _name: "USB 3.1 Bus",
      _items: [
        { _name: "Magic Keyboard", manufacturer: "Apple Inc." },
        { _name: "Flash Drive", manufacturer: "" },
      ],
    },
  ],
});

const SPSTORAGE = JSON.stringify({
  SPStorageDataType: [
    {
      _name: "Macintosh HD",
      size_in_bytes: 494384795648,
      physical_drive: { is_internal_disk: "yes" },
    },
    {
      _name: "BACKUP",
      size_in_bytes: 2000398934016,
      physical_drive: { is_internal_disk: "no", device_name: "Seagate Expansion" },
      encrypted: "no",
    },
  ],
});

const SPAIR_OPEN = JSON.stringify({
  SPAirPortDataType: [
    {
      spairport_airport_interfaces: [
        {
          _name: "en0",
          spairport_current_network_information: {
            _name: "CoffeeShopFree",
            spairport_security_mode: "spairport_security_mode_none",
          },
        },
      ],
    },
  ],
});

const SPAIR_WPA = JSON.stringify({
  SPAirPortDataType: [
    {
      spairport_airport_interfaces: [
        {
          _name: "en0",
          spairport_current_network_information: {
            _name: "HomeNet",
            spairport_security_mode: "spairport_security_mode_wpa3_personal",
          },
        },
      ],
    },
  ],
});

const NETIF = `   route to: default
interface: en0
Hardware Port: Wi-Fi
Device: en0`;

const ARP = Array.from({ length: 35 })
  .map((_, i) => `? (192.168.1.${i + 2}) at aa:bb:cc:dd:ee:${String(i).padStart(2, "0")} on en0`)
  .join("\n");

function rawFixture(overrides: Record<string, string> = {}) {
  return decodeBlobs({
    hostname: b64("Test-MacBook.local"),
    sysctl: b64(SYSCTL),
    top: b64(TOP),
    memoryPressure: b64(MEMP),
    thermal: b64(THERM_OK),
    uptime: b64("14:02  up 3 days,  2:11, 2 users"),
    spusb: b64(SPUSB),
    spstorage: b64(SPSTORAGE),
    spairport: b64(SPAIR_WPA),
    netif: b64(NETIF),
    arp: b64("? (192.168.1.1) at aa:bb:cc:dd:ee:ff on en0"),
    ...Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, b64(v)])),
  });
}

describe("decodeBlobs / telemetry validation", () => {
  it("drops non-canonical base64 instead of mangling it", () => {
    const out = decodeBlobs({ hostname: "!!!not-base64!!!", sysctl: b64("x") });
    expect(out.hostname).toBeUndefined();
    expect(out.sysctl).toBe("x");
  });

  it("rejects payloads missing core readings", () => {
    expect(hasMinimumTelemetry(decodeBlobs({}))).toBe(false);
    expect(hasMinimumTelemetry(decodeBlobs({ hostname: b64("m") }))).toBe(false);
    expect(hasMinimumTelemetry(rawFixture())).toBe(true);
  });
});

describe("thunderbolt parsing", () => {
  it("finds peripherals nested under the root bus", () => {
    const devices = parseDevices(
      rawFixture({
        spthunderbolt: JSON.stringify({
          SPThunderboltDataType: [
            {
              _name: "Thunderbolt/USB4 Bus 0",
              _items: [
                { _name: "CalDigit TS4", vendor_name_key: "CalDigit" },
              ],
            },
          ],
        }),
      }),
    );
    const dock = devices.find((d) => d.name === "CalDigit TS4");
    expect(dock).toBeDefined();
    expect(dock!.kind).toBe("thunderbolt");
    expect(dock!.vendor).toBe("CalDigit");
  });
});

describe("parseSystem", () => {
  it("extracts CPU, memory and load readings", () => {
    const sys = parseSystem(rawFixture());
    expect(sys.cpuBrand).toBe("Apple M2 Pro");
    expect(sys.cpuCores).toBe(10);
    expect(sys.memTotalGb).toBe(16);
    expect(sys.loadAvg1).toBe(2.15);
    expect(sys.cpuUsagePercent).toBeCloseTo(18.8, 1);
    expect(sys.memUsedGb).toBe(11);
    expect(sys.memPressurePercent).toBe(42);
    expect(sys.thermalPressure).toBe("Nominal");
  });

  it("reports throttling when CPU speed is limited", () => {
    const sys = parseSystem(rawFixture({ thermal: THERM_HOT }));
    expect(sys.thermalPressure).toContain("60%");
  });
});

describe("parseDevices", () => {
  it("inventories USB devices and external drives, skipping internal disks", () => {
    const devices = parseDevices(rawFixture());
    const names = devices.map((d) => d.name);
    expect(names).toContain("Magic Keyboard");
    expect(names).toContain("Flash Drive");
    expect(names).toContain("BACKUP");
    expect(names).not.toContain("Macintosh HD");
    const backup = devices.find((d) => d.name === "BACKUP")!;
    expect(backup.kind).toBe("storage");
    expect(backup.encrypted).toBe(false);
    expect(backup.capacityGb).toBeCloseTo(1863.0, 0);
  });
});

describe("parseNetwork", () => {
  it("detects an open Wi-Fi network", () => {
    const net = parseNetwork(rawFixture({ spairport: SPAIR_OPEN }));
    expect(net.ssid).toBe("CoffeeShopFree");
    expect(net.openNetwork).toBe(true);
  });

  it("treats WPA3 as protected and maps the default interface", () => {
    const net = parseNetwork(rawFixture());
    expect(net.ssid).toBe("HomeNet");
    expect(net.openNetwork).toBe(false);
    expect(net.interfaceName).toBe("en0");
    expect(net.interfaceType).toBe("Wi-Fi");
  });

  it("counts ARP neighbors, ignoring incomplete entries", () => {
    const net = parseNetwork(
      rawFixture({ arp: ARP + "\n? (192.168.1.99) at (incomplete) on en0" }),
    );
    expect(net.localDeviceCount).toBe(35);
  });
});

describe("gradeGuardScan", () => {
  it("flags open Wi-Fi as high severity and lowers the trust score", () => {
    const open = gradeGuardScan(rawFixture({ spairport: SPAIR_OPEN }), new Set());
    const protectedNet = gradeGuardScan(rawFixture(), new Set());
    expect(open.findings.some((f) => f.severity === "high" && f.title.includes("Open Wi-Fi"))).toBe(true);
    expect(open.trustScore).toBeLessThan(protectedNet.trustScore);
  });

  it("flags unencrypted external drives", () => {
    const res = gradeGuardScan(rawFixture(), new Set());
    const drive = res.devices.find((d) => d.name === "BACKUP")!;
    expect(drive.riskGrade).toBe("high");
    expect(res.findings.some((f) => f.title.includes("not encrypted"))).toBe(true);
  });

  it("flags a vendor-less USB device", () => {
    const res = gradeGuardScan(rawFixture(), new Set());
    expect(res.findings.some((f) => f.title.includes("no manufacturer"))).toBe(true);
  });

  it("marks devices as new only when earlier scans exist", () => {
    const first = gradeGuardScan(rawFixture(), new Set());
    expect(first.devices.every((d) => !d.isNew)).toBe(true);

    const seen = new Set(first.devices.map(deviceKey));
    seen.delete(deviceKey(first.devices.find((d) => d.name === "Flash Drive")!));
    const second = gradeGuardScan(rawFixture(), seen);
    expect(second.devices.find((d) => d.name === "Flash Drive")!.isNew).toBe(true);
    expect(second.devices.find((d) => d.name === "Magic Keyboard")!.isNew).toBe(false);
    expect(second.findings.some((f) => f.title.includes("New device detected"))).toBe(true);
  });

  it("flags heavy network + busy ARP table as medium", () => {
    const res = gradeGuardScan(rawFixture({ arp: ARP }), new Set());
    expect(res.findings.some((f) => f.title.includes("devices visible"))).toBe(true);
  });

  it("keeps a clean machine at a high trust score", () => {
    const clean = gradeGuardScan(
      rawFixture({
        spusb: JSON.stringify({ SPUSBDataType: [] }),
        spstorage: JSON.stringify({ SPStorageDataType: [] }),
      }),
      new Set(),
    );
    expect(clean.trustScore).toBeGreaterThanOrEqual(90);
  });
});
