import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID, randomInt } from "node:crypto";
import { eq, and, desc, ne } from "drizzle-orm";
import { db, deepScansTable } from "@workspace/db";
import {
  CreateDeepScanResponse,
  GetDeepScanResponse,
  GetPendingDeepScanResponse,
  ListDeepScansResponse,
  IngestDeepScanResultBody,
} from "@workspace/api-zod";
import { aiJson } from "../lib/ai";
import {
  decodeDeepBlobs,
  hasMinimumDeepTelemetry,
  fetchMacosReleases,
  gradeDeepScan,
} from "../lib/deep-analysis";
import { buildDeepAgentScript } from "../lib/deep-agent-script";

const router: IRouter = Router();

const SESSION_COOKIE = "prism_device_sid";
const PAIRING_TTL_MS = 15 * 60 * 1000;

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

/**
 * Origin used inside the copy-paste Terminal command. This string ends up in
 * a shell script the user executes, so it must never carry attacker-supplied
 * bytes: both parts are validated against strict character classes and
 * anything unexpected falls back to the local origin.
 */
function baseUrl(req: Request): string {
  const rawProto =
    ((req.headers["x-forwarded-proto"] as string) ?? req.protocol ?? "http")
      .split(",")[0]
      .trim();
  const rawHost = (
    ((req.headers["x-forwarded-host"] as string) ?? req.headers.host ?? "")
      .split(",")[0]
      .trim()
  );
  const proto = /^https?$/.test(rawProto) ? rawProto : "http";
  const host = /^[A-Za-z0-9.-]+(:\d{1,5})?$/.test(rawHost)
    ? rawHost
    : "localhost";
  return `${proto}://${host}`;
}

function commandFor(req: Request, code: string): string {
  return `curl -fsSL "${baseUrl(req)}/api/devicescan/deep-agent.sh?code=${code}" | bash`;
}

function isExpired(row: typeof deepScansTable.$inferSelect): boolean {
  return (
    row.status === "pending" &&
    Date.now() - row.createdAt.getTime() > PAIRING_TTL_MS
  );
}

function serialize(row: typeof deepScansTable.$inferSelect, req: Request) {
  const { sessionId: _sid, ...rest } = row;
  return {
    ...rest,
    status: isExpired(row) ? "expired" : row.status,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    command: commandFor(req, row.pairingCode),
    posture: row.posture ?? null,
  };
}

router.post("/devicescan/deep-scans", async (req, res): Promise<void> => {
  const sid = getOrSetSessionId(req, res);
  // 8-char code: unambiguous alphabet, no vowels (avoids words), no 0/O 1/I.
  const alphabet = "23456789BCDFGHJKMNPQRSTVWXZ";
  let code = "";
  for (let i = 0; i < 8; i++) code += alphabet[randomInt(alphabet.length)];

  // A session only ever needs one pending pairing at a time.
  await db
    .delete(deepScansTable)
    .where(
      and(
        eq(deepScansTable.sessionId, sid),
        eq(deepScansTable.status, "pending"),
      ),
    );

  const [row] = await db
    .insert(deepScansTable)
    .values({ sessionId: sid, pairingCode: code, status: "pending" })
    .returning();
  res.status(201).json(CreateDeepScanResponse.parse(serialize(row, req)));
});

router.get("/devicescan/deep-scans", async (req, res): Promise<void> => {
  const sid = getOrSetSessionId(req, res);
  const rows = await db
    .select()
    .from(deepScansTable)
    .where(
      and(
        eq(deepScansTable.sessionId, sid),
        ne(deepScansTable.status, "pending"),
      ),
    )
    .orderBy(desc(deepScansTable.createdAt));
  res.json(ListDeepScansResponse.parse(rows.map((r) => serialize(r, req))));
});

/** Returns the session's live pending scan (if any, and not expired). */
router.get("/devicescan/deep-scans/pending", async (req, res): Promise<void> => {
  const sid = getOrSetSessionId(req, res);
  const [row] = await db
    .select()
    .from(deepScansTable)
    .where(
      and(eq(deepScansTable.sessionId, sid), eq(deepScansTable.status, "pending")),
    )
    .orderBy(desc(deepScansTable.createdAt))
    .limit(1);
  if (!row || isExpired(row)) {
    res.sendStatus(204);
    return;
  }
  res.json(GetPendingDeepScanResponse.parse(serialize(row, req)));
});

router.get("/devicescan/deep-scans/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const scanId = parseInt(raw, 10);
  if (Number.isNaN(scanId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const sid = getOrSetSessionId(req, res);
  const [row] = await db
    .select()
    .from(deepScansTable)
    .where(
      and(eq(deepScansTable.id, scanId), eq(deepScansTable.sessionId, sid)),
    );
  if (!row) {
    res.status(404).json({ error: "Scan not found" });
    return;
  }
  res.json(GetDeepScanResponse.parse(serialize(row, req)));
});

router.delete("/devicescan/deep-scans/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const scanId = parseInt(raw, 10);
  if (Number.isNaN(scanId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const sid = getOrSetSessionId(req, res);
  const [row] = await db
    .delete(deepScansTable)
    .where(
      and(eq(deepScansTable.id, scanId), eq(deepScansTable.sessionId, sid)),
    )
    .returning();
  if (!row) {
    res.status(404).json({ error: "Scan not found" });
    return;
  }
  res.sendStatus(204);
});

/**
 * The agent script itself — served as plain text so the user can `curl | bash`
 * it (or read it first; it is deliberately short and read-only).
 */
router.get("/devicescan/deep-agent.sh", (req, res): void => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  if (!/^[A-Z0-9]{4,16}$/i.test(code)) {
    res.status(400).type("text/plain").send("echo 'PRISM: invalid pairing code'");
    return;
  }
  res
    .type("text/x-shellscript")
    .send(buildDeepAgentScript(baseUrl(req), code.toUpperCase()));
});

/** Agent submission — authenticated purely by the one-time pairing code. */
router.post("/devicescan/deep-ingest", async (req, res): Promise<void> => {
  const parsed = IngestDeepScanResultBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const code = parsed.data.pairingCode.toUpperCase();
  const [row] = await db
    .select()
    .from(deepScansTable)
    .where(
      and(
        eq(deepScansTable.pairingCode, code),
        eq(deepScansTable.status, "pending"),
      ),
    );
  if (!row || isExpired(row)) {
    res.status(404).json({ error: "Unknown or expired pairing code" });
    return;
  }

  const blobs = decodeDeepBlobs(parsed.data.raw as Record<string, string>);
  if (!hasMinimumDeepTelemetry(blobs)) {
    res.status(400).json({
      error:
        "Insufficient telemetry — the payload is missing core readings the agent always sends",
    });
    return;
  }

  const releases = await fetchMacosReleases();
  const analysis = gradeDeepScan(blobs, releases);
  const hostname = blobs.hostname?.trim().split("\n")[0] ?? null;
  const machineLabel =
    [hostname, analysis.posture.macosVersion ? `macOS ${analysis.posture.macosVersion}` : null]
      .filter(Boolean)
      .join(" · ") || "Mac";

  let aiSummary: string;
  try {
    const result = await aiJson<{ summary: string }>(
      'You are PRISM MacBook Deep Scan, explaining a local macOS security-posture scan to a non-technical user. Given real readings (FileVault, firewall, SIP, Gatekeeper, macOS freshness, pending updates, disk), write 3-5 plain-language sentences: overall posture, the single most important gap, and one concrete action with where to click. Be honest and specific. Respond as JSON: {"summary": string}. No markdown.',
      JSON.stringify({
        machineLabel,
        posture: analysis.posture,
        findings: analysis.findings,
        trustScore: analysis.trustScore,
      }),
    );
    aiSummary = result.summary;
  } catch (err) {
    req.log.error({ err }, "Deep scan AI summary failed");
    res.status(502).json({ error: "AI analysis failed, please retry" });
    return;
  }

  await db
    .update(deepScansTable)
    .set({
      status: "complete",
      completedAt: new Date(),
      machineLabel,
      trustScore: analysis.trustScore,
      riskScore: analysis.riskScore,
      posture: analysis.posture,
      findings: analysis.findings,
      aiSummary,
    })
    .where(eq(deepScansTable.id, row.id));

  res.json({ ok: true });
});

export default router;
