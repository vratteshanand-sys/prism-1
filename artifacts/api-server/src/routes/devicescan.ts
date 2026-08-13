import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { eq, and, desc } from "drizzle-orm";
import { db, deviceScansTable } from "@workspace/db";
import {
  CreateDeviceScanBody,
  CreateDeviceScanResponse,
  GetDeviceScanResponse,
  ListDeviceScansResponse,
} from "@workspace/api-zod";
import { aiJson } from "../lib/ai";
import {
  identifyBrowser,
  latestStableVersion,
  isUpToDate,
  analyzeSignals,
  computeTrustScore,
} from "../lib/device-analysis";

const router: IRouter = Router();

const SESSION_COOKIE = "prism_device_sid";

/**
 * Device scans contain raw fingerprint material, so they are scoped to the
 * browser session that created them — no visitor can read another
 * visitor's scans.
 */
function getOrSetSessionId(req: Request, res: Response): string {
  const existing = (req as Request & { cookies?: Record<string, string> })
    .cookies?.[SESSION_COOKIE];
  if (existing && /^[a-f0-9-]{36}$/.test(existing)) return existing;
  const sid = randomUUID();
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 365 * 24 * 60 * 60 * 1000,
  });
  return sid;
}

function serialize(row: typeof deviceScansTable.$inferSelect) {
  const { sessionId: _sessionId, ...rest } = row;
  return {
    ...rest,
    createdAt: row.createdAt.toISOString(),
    browserUpToDate: row.browserUpToDate as boolean | null,
  };
}

router.get("/devicescan/scans", async (req, res): Promise<void> => {
  const sid = getOrSetSessionId(req, res);
  const rows = await db
    .select()
    .from(deviceScansTable)
    .where(eq(deviceScansTable.sessionId, sid))
    .orderBy(desc(deviceScansTable.createdAt));
  res.json(ListDeviceScansResponse.parse(rows.map(serialize)));
});

router.post("/devicescan/scans", async (req, res): Promise<void> => {
  const parsed = CreateDeviceScanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const input = parsed.data;

  const id = identifyBrowser(input);
  const latest = await latestStableVersion(id.browserName, id.osName);
  const upToDate = isUpToDate(id.browserVersion, latest);
  const analysis = analyzeSignals(input, id, latest, upToDate);
  const trustScore = computeTrustScore(
    upToDate,
    analysis.fingerprintExposure,
    analysis.findings,
  );

  let aiSummary: string;
  try {
    const result = await aiJson<{ summary: string }>(
      'You are PRISM Device Trust Scan, explaining a live browser/device exposure scan to a non-technical user. Given real collected signals and findings, write 3-5 plain-language sentences: what their device reveals to any website, the most important risk, and one concrete action. Be honest — this is a browser-exposure scan, not an antivirus scan. Respond as JSON: {"summary": string}. No markdown.',
      JSON.stringify({
        device: id,
        latestStable: latest,
        upToDate,
        trustScore,
        fingerprintExposure: analysis.fingerprintExposure,
        findings: analysis.findings,
        signalCount: analysis.signals.length,
      }),
    );
    aiSummary = result.summary;
  } catch (err) {
    req.log.error({ err }, "Device scan AI summary failed");
    res.status(502).json({ error: "AI analysis failed, please retry" });
    return;
  }

  const [row] = await db
    .insert(deviceScansTable)
    .values({
      sessionId: getOrSetSessionId(req, res),
      deviceLabel: `${id.osName} · ${id.browserName}${id.browserVersion ? " " + id.browserVersion.split(".")[0] : ""}`,
      browserName: id.browserName,
      browserVersion: id.browserVersion,
      osName: id.osName,
      browserUpToDate: upToDate,
      latestVersion: latest,
      trustScore,
      riskScore: 100 - trustScore,
      fingerprintExposure: analysis.fingerprintExposure,
      findings: analysis.findings,
      signals: analysis.signals,
      aiSummary,
    })
    .returning();

  res.status(201).json(CreateDeviceScanResponse.parse(serialize(row)));
});

router.get("/devicescan/scans/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const scanId = parseInt(raw, 10);
  if (Number.isNaN(scanId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const sid = getOrSetSessionId(req, res);
  const [row] = await db
    .select()
    .from(deviceScansTable)
    .where(
      and(eq(deviceScansTable.id, scanId), eq(deviceScansTable.sessionId, sid)),
    );
  if (!row) {
    res.status(404).json({ error: "Scan not found" });
    return;
  }
  res.json(GetDeviceScanResponse.parse(serialize(row)));
});

router.delete("/devicescan/scans/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const scanId = parseInt(raw, 10);
  if (Number.isNaN(scanId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const sid = getOrSetSessionId(req, res);
  const [row] = await db
    .delete(deviceScansTable)
    .where(
      and(eq(deviceScansTable.id, scanId), eq(deviceScansTable.sessionId, sid)),
    )
    .returning();
  if (!row) {
    res.status(404).json({ error: "Scan not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
