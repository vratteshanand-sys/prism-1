import { describe, it, expect, vi, afterEach } from "vitest";
import {
  identifyBrowser,
  isUpToDate,
  compareVersions,
  isReducedVersion,
  isValidVersion,
  latestStableVersion,
  type DeviceSignalsInput,
} from "./device-analysis";

const base = (overrides: Partial<DeviceSignalsInput>): DeviceSignalsInput =>
  ({ userAgent: "", ...overrides }) as DeviceSignalsInput;

describe("identifyBrowser", () => {
  it("detects Chrome on macOS", () => {
    const id = identifyBrowser(
      base({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
      }),
    );
    expect(id.browserName).toBe("Chrome");
    expect(id.browserVersion).toBe("136.0.0.0");
    expect(id.osName).toBe("macOS");
  });

  it("prefers the full-version client hint over a reduced UA version", () => {
    const id = identifyBrowser(
      base({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
        uaFullVersion: "136.0.7103.92",
      }),
    );
    expect(id.browserVersion).toBe("136.0.7103.92");
  });

  it("ignores a full-version hint from a different major", () => {
    const id = identifyBrowser(
      base({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
        uaFullVersion: "99.0.1.1",
      }),
    );
    expect(id.browserVersion).toBe("151.0.0.0");
  });

  it("detects Edge on Windows", () => {
    const id = identifyBrowser(
      base({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.4129.78",
      }),
    );
    expect(id.browserName).toBe("Edge");
    expect(id.browserVersion).toBe("151.0.4129.78");
    expect(id.osName).toBe("Windows");
  });

  it("detects Edge on Android (EdgA)", () => {
    const id = identifyBrowser(
      base({
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36 EdgA/151.0.4129.70",
      }),
    );
    expect(id.browserName).toBe("Edge");
    expect(id.browserVersion).toBe("151.0.4129.70");
    expect(id.osName).toBe("Android");
  });

  it("detects Edge on iOS (EdgiOS)", () => {
    const id = identifyBrowser(
      base({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/151.4129.60 Mobile/15E148 Safari/605.1.15",
      }),
    );
    expect(id.browserName).toBe("Edge");
    expect(id.browserVersion).toBe("151.4129.60");
    expect(id.osName).toBe("iOS");
  });

  it("detects Chrome on iOS (CriOS)", () => {
    const id = identifyBrowser(
      base({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/152.0.7977.40 Mobile/15E148 Safari/605.1.15",
      }),
    );
    expect(id.browserName).toBe("Chrome");
    expect(id.browserVersion).toBe("152.0.7977.40");
    expect(id.osName).toBe("iOS");
  });

  it("detects Firefox on iOS (FxiOS)", () => {
    const id = identifyBrowser(
      base({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/141.0 Mobile/15E148 Safari/605.1.15",
      }),
    );
    expect(id.browserName).toBe("Firefox");
    expect(id.browserVersion).toBe("141.0");
    expect(id.osName).toBe("iOS");
  });

  it("detects Firefox on Linux", () => {
    const id = identifyBrowser(
      base({
        userAgent:
          "Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0",
      }),
    );
    expect(id.browserName).toBe("Firefox");
    expect(id.browserVersion).toBe("141.0");
    expect(id.osName).toBe("Linux");
  });
});

describe("compareVersions", () => {
  it("orders versions numerically per segment", () => {
    expect(compareVersions("152.0.1.10", "152.0.1.2")).toBe(1);
    expect(compareVersions("151.9.9.9", "152.0.0.0")).toBe(-1);
    expect(compareVersions("141.0", "141.0.0")).toBe(0);
  });
});

describe("isReducedVersion", () => {
  it("flags Chromium reduced UA versions", () => {
    expect(isReducedVersion("136.0.0.0")).toBe(true);
    expect(isReducedVersion("136.0.7103.92")).toBe(false);
    expect(isReducedVersion("141.0")).toBe(true); // too short to verify patch
  });
});

describe("isUpToDate", () => {
  const latest = "152.0.7977.42";

  it("returns false when a full major behind", () => {
    expect(isUpToDate("136.0.7103.92", latest)).toBe(false);
    expect(isUpToDate("151.0.0.0", latest)).toBe(false);
  });

  it("returns false when same major but older full patch", () => {
    expect(isUpToDate("152.0.7977.1", latest)).toBe(false);
  });

  it("returns true only for verified full versions at or above stable", () => {
    expect(isUpToDate("152.0.7977.42", latest)).toBe(true);
    expect(isUpToDate("152.0.7999.1", latest)).toBe(true);
  });

  it("returns null (unverified) for reduced versions on the current major", () => {
    expect(isUpToDate("152.0.0.0", latest)).toBe(null);
  });

  it("returns null when the feed gave no version or versions are malformed", () => {
    expect(isUpToDate("152.0.7977.42", null)).toBe(null);
    expect(isUpToDate("", latest)).toBe(null);
    expect(isUpToDate("abc", latest)).toBe(null);
  });

  it("handles Firefox-style short versions", () => {
    expect(isUpToDate("140.0", "141.0")).toBe(false);
    // 141.0 is same major but too short to verify the exact patch → unverified
    expect(isUpToDate("141.0", "141.0")).toBe(null);
    expect(isUpToDate("141.0.3", "141.0")).toBe(true);
  });

  it("never returns true for versions with malformed later segments", () => {
    expect(isUpToDate("152.x.beta", latest)).toBe(null);
    expect(isUpToDate("152.0.7977.42", "152.oops")).toBe(null);
  });
});

describe("isValidVersion", () => {
  it("accepts only fully numeric dotted versions", () => {
    expect(isValidVersion("152.0.7977.42")).toBe(true);
    expect(isValidVersion("141.0")).toBe(true);
    expect(isValidVersion("152.x.1")).toBe(false);
    expect(isValidVersion("152.")).toBe(false);
    expect(isValidVersion("")).toBe(false);
  });
});

describe("latestStableVersion (mocked feeds)", () => {
  afterEach(() => vi.unstubAllGlobals());

  const mockFetch = (payload: unknown, ok = true) =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok,
        status: ok ? 200 : 500,
        json: async () => payload,
      })),
    );

  it("returns null when the Edge feed has no release for the exact platform", async () => {
    mockFetch([
      {
        Product: "Stable",
        Releases: [{ Platform: "Windows", ProductVersion: "151.0.4129.78" }],
      },
    ]);
    expect(await latestStableVersion("Edge", "Android")).toBe(null);
  });

  it("picks the exact-platform Edge release", async () => {
    mockFetch([
      {
        Product: "Stable",
        Releases: [
          { Platform: "Windows", ProductVersion: "151.0.4129.78" },
          { Platform: "iOS", ProductVersion: "151.4129.60" },
        ],
      },
    ]);
    expect(await latestStableVersion("Edge", "iOS")).toBe("151.4129.60");
  });

  it("rejects malformed versions coming from a feed", async () => {
    mockFetch({ versions: [{ version: "not-a-version" }] });
    expect(await latestStableVersion("Chrome", "Linux")).toBe(null);
  });

  it("returns null on unexpected feed shape", async () => {
    mockFetch({ totally: "different" });
    expect(await latestStableVersion("Edge", "Windows")).toBe(null);
  });

  it("returns null when the feed request fails", async () => {
    mockFetch({}, false);
    expect(await latestStableVersion("Chrome", "Android")).toBe(null);
  });

  it("uses Mozilla's mobile feed for Firefox on Android", async () => {
    const spy = vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () =>
        url.includes("mobile_versions")
          ? { version: "141.0.2", ios_version: "141.1" }
          : { LATEST_FIREFOX_VERSION: "999.0" },
    }));
    vi.stubGlobal("fetch", spy);
    expect(await latestStableVersion("Firefox", "Android")).toBe("141.0.2");
    expect(String(spy.mock.calls[0][0])).toContain("mobile_versions.json");
  });

  it("uses Mozilla's iOS version for Firefox on iOS", async () => {
    mockFetch({ version: "141.0.2", ios_version: "141.1" });
    expect(await latestStableVersion("Firefox", "iOS")).toBe("141.1");
  });

  it("returns null for Firefox on an unknown platform without fetching", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    expect(await latestStableVersion("Firefox", "Unknown OS")).toBe(null);
    expect(spy).not.toHaveBeenCalled();
  });

  it("skips lookup entirely for unknown platforms", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    expect(await latestStableVersion("Chrome", "Unknown OS")).toBe(null);
    expect(spy).not.toHaveBeenCalled();
  });
});
