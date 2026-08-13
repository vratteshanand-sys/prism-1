import { describe, it, expect } from "vitest";
import {
  decodeDeepBlobs,
  hasMinimumDeepTelemetry,
  parsePosture,
  gradeDeepScan,
  newestMacos,
  latestInCycle,
} from "./deep-analysis";

const RELEASES = [
  { cycle: "26", latest: "26.1" },
  { cycle: "15", latest: "15.5" },
  { cycle: "14", latest: "14.7.6" },
];

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

const SW_VERS = `ProductName:		macOS
ProductVersion:		15.5
BuildVersion:		24F74`;

const DF = `Filesystem      Size    Used   Avail Capacity iused ifree %iused  Mounted on
/dev/disk3s1s1  460Gi   410Gi   45Gi    91%    404k  471M    0%   /`;

function fixture(overrides: Record<string, string> = {}) {
  return decodeDeepBlobs({
    hostname: b64("Test-MacBook.local"),
    swVers: b64(SW_VERS),
    fdesetup: b64("FileVault is On."),
    firewall: b64("Firewall is enabled. (State = 1)"),
    firewallStealth: b64("Firewall stealth mode is on"),
    spctl: b64("assessments enabled"),
    csrutil: b64("System Integrity Protection status: enabled."),
    softwareupdate: b64("Software Update Tool\n\nNo new software available."),
    df: b64(DF),
    uptime: b64("14:02  up 3 days,  2:11, 2 users"),
    ...Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, b64(v)])),
  });
}

describe("telemetry validation", () => {
  it("requires hostname and sw_vers", () => {
    expect(hasMinimumDeepTelemetry(decodeDeepBlobs({}))).toBe(false);
    expect(
      hasMinimumDeepTelemetry(decodeDeepBlobs({ hostname: b64("m") })),
    ).toBe(false);
    expect(hasMinimumDeepTelemetry(fixture())).toBe(true);
  });
});

describe("parsePosture", () => {
  it("reads version, build, and all toggles from healthy output", () => {
    const p = parsePosture(fixture(), RELEASES);
    expect(p.macosVersion).toBe("15.5");
    expect(p.macosBuild).toBe("24F74");
    expect(p.macosUpToDate).toBe(true);
    expect(p.fileVault).toBe(true);
    expect(p.firewall).toBe(true);
    expect(p.firewallStealth).toBe(true);
    expect(p.sip).toBe(true);
    expect(p.gatekeeper).toBe(true);
    expect(p.pendingUpdates).toEqual([]);
    expect(p.diskUsedPercent).toBe(91);
    expect(p.diskAvailable).toBe("45Gi");
    expect(p.uptime).toContain("3 days");
  });

  it("detects the disabled spellings", () => {
    const p = parsePosture(
      fixture({
        fdesetup: "FileVault is Off.",
        firewall: "Firewall is disabled. (State = 0)",
        spctl: "assessments disabled",
        csrutil: "System Integrity Protection status: disabled.",
      }),
      RELEASES,
    );
    expect(p.fileVault).toBe(false);
    expect(p.firewall).toBe(false);
    expect(p.gatekeeper).toBe(false);
    expect(p.sip).toBe(false);
  });

  it("reports null instead of guessing when output is missing", () => {
    const p = parsePosture(
      decodeDeepBlobs({ hostname: b64("m"), swVers: b64(SW_VERS) }),
      null,
    );
    expect(p.fileVault).toBeNull();
    expect(p.firewall).toBeNull();
    expect(p.macosUpToDate).toBeNull();
  });

  it("parses pending update labels", () => {
    const p = parsePosture(
      fixture({
        softwareupdate:
          "Software Update found the following new or updated software:\n* Label: macOS Sequoia 15.6-24G84\n\tTitle: macOS Sequoia 15.6\n* Label: Safari18.6\n",
      }),
      RELEASES,
    );
    expect(p.pendingUpdates).toEqual([
      "macOS Sequoia 15.6-24G84",
      "Safari18.6",
    ]);
  });

  it("flags a macOS behind its own cycle's latest patch", () => {
    const p = parsePosture(fixture(), [
      { cycle: "26", latest: "26.1" },
      { cycle: "15", latest: "15.6" },
    ]);
    expect(p.latestMacos).toBe("15.6");
    expect(p.macosUpToDate).toBe(false);
  });

  it("does NOT call a fully patched older cycle outdated (feed order irrelevant)", () => {
    const p = parsePosture(fixture(), [
      { cycle: "15", latest: "15.5" },
      { cycle: "26", latest: "26.1" },
    ]);
    expect(p.latestMacos).toBe("15.5");
    expect(p.macosUpToDate).toBe(true);
  });

  it("falls back to newest release when the cycle is unknown to the feed", () => {
    const p = parsePosture(fixture(), [{ cycle: "26", latest: "26.1" }]);
    expect(p.latestMacos).toBe("26.1");
    expect(p.macosUpToDate).toBe(false);
  });

  it("release helpers pick by version, not array order", () => {
    const shuffled = [
      { cycle: "14", latest: "14.7.6" },
      { cycle: "26", latest: "26.1" },
      { cycle: "15", latest: "15.5" },
    ];
    expect(newestMacos(shuffled)).toBe("26.1");
    expect(latestInCycle(shuffled, "15.3")).toBe("15.5");
  });
});

describe("gradeDeepScan", () => {
  it("scores a hardened Mac in the 90s", () => {
    const r = gradeDeepScan(fixture(), RELEASES);
    expect(r.trustScore).toBeGreaterThanOrEqual(90);
    expect(r.findings.some((f) => f.severity === "high" || f.severity === "critical")).toBe(false);
  });

  it("treats FileVault off and SIP off as critical", () => {
    const r = gradeDeepScan(
      fixture({
        fdesetup: "FileVault is Off.",
        csrutil: "System Integrity Protection status: disabled.",
      }),
      RELEASES,
    );
    expect(
      r.findings.filter((f) => f.severity === "critical").length,
    ).toBe(2);
    expect(r.trustScore).toBeLessThanOrEqual(40);
  });

  it("fails closed when core protections cannot be read", () => {
    const r = gradeDeepScan(
      decodeDeepBlobs({
        hostname: Buffer.from("m").toString("base64"),
        swVers: Buffer.from(SW_VERS).toString("base64"),
      }),
      RELEASES,
    );
    expect(
      r.findings.some((f) => f.title.includes("Incomplete scan")),
    ).toBe(true);
    expect(r.trustScore).toBeLessThanOrEqual(40);
  });

  it("flags outdated macOS as high severity", () => {
    const r = gradeDeepScan(fixture(), [
      { cycle: "26", latest: "26.1" },
      { cycle: "15", latest: "15.6" },
    ]);
    expect(
      r.findings.some(
        (f) => f.severity === "high" && f.title.includes("behind the current release"),
      ),
    ).toBe(true);
  });

  it("flags pending updates and a nearly full disk as medium", () => {
    const r = gradeDeepScan(
      fixture({
        softwareupdate: "* Label: Safari18.6\n",
        df: `Filesystem   Size  Used  Avail Capacity  Mounted on\n/dev/disk3s1 460Gi 450Gi  5Gi     97%    /`,
      }),
      RELEASES,
    );
    expect(r.findings.some((f) => f.title.includes("update"))).toBe(true);
    expect(r.findings.some((f) => f.title.includes("97% full"))).toBe(true);
  });
});
