import { Router, type IRouter, type Request } from "express";
import { desc, eq } from "drizzle-orm";
import {
  db,
  supplyChainScansTable,
  sentinelAnalysesTable,
  urlInspectionsTable,
  policyAnalysesTable,
  cookieAnalysesTable,
  finguardAnalysesTable,
  deviceScansTable,
  guardScansTable,
  deepScansTable,
} from "@workspace/db";
import { and } from "drizzle-orm";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const deviceSid =
    (req as Request & { cookies?: Record<string, string> }).cookies?.[
      "prism_device_sid"
    ] ?? null;
  const [supply, sentinel, urls, policies, cookies, finguard, devices, guards, deepScans] =
    await Promise.all([
      db
        .select()
        .from(supplyChainScansTable)
        .orderBy(desc(supplyChainScansTable.createdAt)),
      db
        .select()
        .from(sentinelAnalysesTable)
        .orderBy(desc(sentinelAnalysesTable.createdAt)),
      db
        .select()
        .from(urlInspectionsTable)
        .orderBy(desc(urlInspectionsTable.createdAt)),
      db
        .select()
        .from(policyAnalysesTable)
        .orderBy(desc(policyAnalysesTable.createdAt)),
      db
        .select()
        .from(cookieAnalysesTable)
        .orderBy(desc(cookieAnalysesTable.createdAt)),
      db
        .select()
        .from(finguardAnalysesTable)
        .orderBy(desc(finguardAnalysesTable.createdAt)),
      // Device scans hold raw fingerprint data, so only surface the
      // current browser session's own scans on the dashboard.
      deviceSid
        ? db
            .select()
            .from(deviceScansTable)
            .where(eq(deviceScansTable.sessionId, deviceSid))
            .orderBy(desc(deviceScansTable.createdAt))
        : Promise.resolve([]),
      // Guard scans are session-scoped like device scans.
      deviceSid
        ? db
            .select()
            .from(guardScansTable)
            .where(
              and(
                eq(guardScansTable.sessionId, deviceSid),
                eq(guardScansTable.status, "complete"),
              ),
            )
            .orderBy(desc(guardScansTable.createdAt))
        : Promise.resolve([]),
      // Deep scans (MacBook Terminal agent) are also session-scoped.
      deviceSid
        ? db
            .select()
            .from(deepScansTable)
            .where(
              and(
                eq(deepScansTable.sessionId, deviceSid),
                eq(deepScansTable.status, "complete"),
              ),
            )
            .orderBy(desc(deepScansTable.createdAt))
        : Promise.resolve([]),
    ]);

  const activity = [
    ...supply.map((r) => ({
      id: r.id,
      module: "supplychain",
      title: `Scan: ${r.filename}`,
      riskScore: r.riskScore,
      createdAt: r.createdAt,
    })),
    ...sentinel.map((r) => ({
      id: r.id,
      module: "sentinel",
      title: `AI text analysis: ${r.textExcerpt.slice(0, 60)}`,
      riskScore: r.overallRisk,
      createdAt: r.createdAt,
    })),
    ...urls.map((r) => ({
      id: r.id,
      module: "trustlens",
      title: `URL inspection: ${r.url.slice(0, 60)}`,
      riskScore: r.riskScore,
      createdAt: r.createdAt,
    })),
    ...policies.map((r) => ({
      id: r.id,
      module: "trustlens",
      title: `Policy analysis: ${r.excerpt.slice(0, 60)}`,
      riskScore: r.riskScore,
      createdAt: r.createdAt,
    })),
    ...cookies.map((r) => ({
      id: r.id,
      module: "trustlens",
      title: `Cookie banner: ${r.excerpt.slice(0, 60)}`,
      riskScore: r.manipulationScore,
      createdAt: r.createdAt,
    })),
    ...finguard.map((r) => ({
      id: r.id,
      module: "finguard",
      title: `Transaction analysis (${r.transactionCount} transactions)`,
      riskScore: r.riskScore,
      createdAt: r.createdAt,
    })),
    ...devices.map((r) => ({
      id: r.id,
      module: "devicescan",
      title: `Device scan: ${r.deviceLabel}`,
      riskScore: r.riskScore,
      createdAt: r.createdAt,
    })),
    ...guards.map((r) => ({
      id: r.id,
      module: "guard",
      title: `Hardware guard scan: ${r.machineLabel ?? "Mac"}`,
      riskScore: r.riskScore ?? 0,
      createdAt: r.createdAt,
    })),
    ...deepScans.map((r) => ({
      id: r.id,
      module: "devicescan",
      title: `MacBook deep scan: ${r.machineLabel ?? "Mac"}`,
      riskScore: r.riskScore ?? 0,
      createdAt: r.createdAt,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const allScores = activity.map((a) => a.riskScore);
  const avgRiskScore =
    allScores.length === 0
      ? 0
      : Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);

  res.json(
    GetDashboardSummaryResponse.parse({
      supplyChainScans: supply.length,
      sentinelAnalyses: sentinel.length,
      trustlensScans: urls.length + policies.length + cookies.length,
      finguardAnalyses: finguard.length,
      deviceScans: devices.length,
      guardScans: guards.length,
      deepScans: deepScans.length,
      avgRiskScore,
      highRiskCount: allScores.filter((s) => s >= 70).length,
      recentActivity: activity.slice(0, 12).map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      })),
    }),
  );
});

export default router;
