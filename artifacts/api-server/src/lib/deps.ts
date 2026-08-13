export interface ParsedDep {
  name: string;
  version: string;
}

export interface ParsedFile {
  ecosystem: string; // OSV ecosystem name, e.g. "npm", "PyPI"
  dependencies: ParsedDep[];
}

function cleanSemver(v: string): string {
  return v.replace(/^[\^~>=<\s*]+/, "").trim();
}

export function parseDependencyFile(
  filename: string,
  content: string,
): ParsedFile {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".json") || content.trim().startsWith("{")) {
    // package.json
    const pkg = JSON.parse(content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const all = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    const dependencies = Object.entries(all)
      .filter(([, v]) => typeof v === "string" && !v.startsWith("workspace:"))
      .map(([name, version]) => ({ name, version: cleanSemver(version) }));
    return { ecosystem: "npm", dependencies };
  }

  // requirements.txt style: name==version / name>=version / bare name
  const dependencies: ParsedDep[] = [];
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("-")) continue;
    const match = line.match(/^([A-Za-z0-9._\-\[\]]+)\s*(?:[=<>!~]{1,2}=?\s*([^\s;#,]+))?/);
    if (!match) continue;
    const name = match[1].replace(/\[.*\]$/, "");
    dependencies.push({ name, version: match[2] ?? "" });
  }
  return { ecosystem: "PyPI", dependencies };
}

export interface OsvVuln {
  packageName: string;
  version: string;
  vulnId: string;
  severity: "low" | "medium" | "high" | "critical";
  summary: string;
  fixedVersion: string | null;
}

interface OsvApiVuln {
  id: string;
  summary?: string;
  details?: string;
  severity?: { type: string; score: string }[];
  database_specific?: { severity?: string };
  affected?: {
    ranges?: { events?: { fixed?: string }[] }[];
  }[];
}

function osvSeverity(v: OsvApiVuln): OsvVuln["severity"] {
  const dbSev = v.database_specific?.severity?.toLowerCase();
  if (dbSev === "critical" || dbSev === "high" || dbSev === "low") return dbSev;
  if (dbSev === "moderate" || dbSev === "medium") return "medium";
  // Fall back to CVSS score parsing
  const cvss = v.severity?.find((s) => s.type.startsWith("CVSS"));
  if (cvss) {
    const m = cvss.score.match(/\d+(\.\d+)?/);
    const score = m ? parseFloat(m[0]) : NaN;
    if (score >= 9) return "critical";
    if (score >= 7) return "high";
    if (score >= 4) return "medium";
    if (!Number.isNaN(score)) return "low";
  }
  return "medium";
}

function osvFixedVersion(v: OsvApiVuln): string | null {
  for (const aff of v.affected ?? []) {
    for (const range of aff.ranges ?? []) {
      for (const event of range.events ?? []) {
        if (event.fixed) return event.fixed;
      }
    }
  }
  return null;
}

/** Query OSV.dev for known vulnerabilities across a set of dependencies. */
export async function queryOsv(
  ecosystem: string,
  deps: ParsedDep[],
): Promise<OsvVuln[]> {
  const queryDeps = deps.filter((d) => d.version).slice(0, 200);
  if (queryDeps.length === 0) return [];

  const res = await fetch("https://api.osv.dev/v1/querybatch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      queries: queryDeps.map((d) => ({
        package: { name: d.name, ecosystem },
        version: d.version,
      })),
    }),
  });
  if (!res.ok) {
    throw new Error(`OSV querybatch failed with status ${res.status}`);
  }
  const data = (await res.json()) as {
    results: { vulns?: { id: string }[] }[];
  };

  // Collect (dep, vulnId) pairs first, capped per-dep and in total,
  // BEFORE starting any detail fetches.
  const pairs: { dep: ParsedDep; vulnId: string }[] = [];
  data.results.forEach((result, i) => {
    const dep = queryDeps[i];
    for (const vuln of (result.vulns ?? []).slice(0, 5)) {
      pairs.push({ dep, vulnId: vuln.id });
    }
  });
  const capped = pairs.slice(0, 60);

  const out: OsvVuln[] = [];
  const CONCURRENCY = 10;
  for (let i = 0; i < capped.length; i += CONCURRENCY) {
    await Promise.all(
      capped.slice(i, i + CONCURRENCY).map(async ({ dep, vulnId }) => {
        try {
          const detailRes = await fetch(
            `https://api.osv.dev/v1/vulns/${encodeURIComponent(vulnId)}`,
            { signal: AbortSignal.timeout(10000) },
          );
          if (!detailRes.ok) return;
          const detail = (await detailRes.json()) as OsvApiVuln;
          out.push({
            packageName: dep.name,
            version: dep.version,
            vulnId: detail.id,
            severity: osvSeverity(detail),
            summary:
              detail.summary ??
              detail.details?.slice(0, 200) ??
              "Known vulnerability",
            fixedVersion: osvFixedVersion(detail),
          });
        } catch {
          // Skip individual detail failures; batch result already confirmed the vuln exists.
        }
      }),
    );
  }
  return out;
}

export function riskScoreFromVulns(total: number, vulns: OsvVuln[]): number {
  if (total === 0) return 0;
  const weight = { low: 3, medium: 8, high: 18, critical: 30 } as const;
  const score = vulns.reduce((acc, v) => acc + weight[v.severity], 0);
  return Math.max(0, Math.min(100, score));
}
