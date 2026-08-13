import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID, randomInt } from "node:crypto";
import { eq, and, desc, ne } from "drizzle-orm";
import { db, guardScansTable, guardTrustedDevicesTable } from "@workspace/db";
import {
  GetGuardScanResponse,
  ListGuardScansResponse,
  CreateGuardScanResponse,
  IngestGuardResultBody,
} from "@workspace/api-zod";
import { aiJson } from "../lib/ai";
import {
  decodeBlobs,
  hasMinimumTelemetry,
  gradeGuardScan,
  deviceKey,
  type GuardDevice,
} from "../lib/guard-analysis";
import { buildAgentScript } from "../lib/guard-agent-script";
import { buildLinuxAgentScript } from "../lib/linux-guard-script";
import { buildWindowsAgentScript } from "../lib/windows-guard-script";

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
  return `curl -fsSL "${baseUrl(req)}/api/guard/agent.sh?code=${code}" | bash`;
}

function isExpired(row: typeof guardScansTable.$inferSelect): boolean {
  return (
    row.status === "pending" &&
    Date.now() - row.createdAt.getTime() > PAIRING_TTL_MS
  );
}

function serialize(row: typeof guardScansTable.$inferSelect, req: Request) {
  const { sessionId: _sid, ...rest } = row;
  return {
    ...rest,
    status: isExpired(row) ? "expired" : row.status,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    command: commandFor(req, row.pairingCode),
    system: row.system ?? null,
    devices: (row.devices as GuardDevice[]) ?? [],
    network: row.network ?? null,
  };
}

router.post("/guard/scans", async (req, res): Promise<void> => {
  const sid = getOrSetSessionId(req, res);
  // 8-char code: unambiguous alphabet, no vowels (avoids words), no 0/O 1/I.
  const alphabet = "23456789BCDFGHJKMNPQRSTVWXZ";
  let code = "";
  for (let i = 0; i < 8; i++) code += alphabet[randomInt(alphabet.length)];

  // A session only ever needs one pending pairing at a time.
  await db
    .delete(guardScansTable)
    .where(
      and(
        eq(guardScansTable.sessionId, sid),
        eq(guardScansTable.status, "pending"),
      ),
    );

  const [row] = await db
    .insert(guardScansTable)
    .values({ sessionId: sid, pairingCode: code, status: "pending" })
    .returning();
  res.status(201).json(CreateGuardScanResponse.parse(serialize(row, req)));
});

router.get("/guard/scans", async (req, res): Promise<void> => {
  const sid = getOrSetSessionId(req, res);
  const rows = await db
    .select()
    .from(guardScansTable)
    .where(
      and(
        eq(guardScansTable.sessionId, sid),
        ne(guardScansTable.status, "pending"),
      ),
    )
    .orderBy(desc(guardScansTable.createdAt));
  res.json(ListGuardScansResponse.parse(rows.map((r) => serialize(r, req))));
});

router.get("/guard/scans/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const scanId = parseInt(raw, 10);
  if (Number.isNaN(scanId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const sid = getOrSetSessionId(req, res);
  const [row] = await db
    .select()
    .from(guardScansTable)
    .where(
      and(eq(guardScansTable.id, scanId), eq(guardScansTable.sessionId, sid)),
    );
  if (!row) {
    res.status(404).json({ error: "Scan not found" });
    return;
  }
  res.json(GetGuardScanResponse.parse(serialize(row, req)));
});

router.delete("/guard/scans/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const scanId = parseInt(raw, 10);
  if (Number.isNaN(scanId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const sid = getOrSetSessionId(req, res);
  const [row] = await db
    .delete(guardScansTable)
    .where(
      and(eq(guardScansTable.id, scanId), eq(guardScansTable.sessionId, sid)),
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
router.get("/guard/agent.sh", (req, res): void => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  if (!/^[A-Z0-9]{4,16}$/i.test(code)) {
    res.status(400).type("text/plain").send("echo 'PRISM: invalid pairing code'");
    return;
  }
  res
    .type("text/x-shellscript")
    .send(buildAgentScript(baseUrl(req), code.toUpperCase()));
});

router.get("/guard/agent-linux.sh", (req, res): void => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  if (!/^[A-Z0-9]{4,16}$/i.test(code)) {
    res.status(400).type("text/plain").send("echo 'PRISM: invalid pairing code'");
    return;
  }
  res
    .type("text/x-shellscript")
    .send(buildLinuxAgentScript(baseUrl(req), code.toUpperCase()));
});

router.get("/guard/agent-windows.ps1", (req, res): void => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  if (!/^[A-Z0-9]{4,16}$/i.test(code)) {
    res.status(400).type("text/plain").send("Write-Error 'PRISM: invalid pairing code'");
    return;
  }
  res
    .type("text/plain")
    .send(buildWindowsAgentScript(baseUrl(req), code.toUpperCase()));
});

/** Agent submission — authenticated purely by the one-time pairing code. */
router.post("/guard/ingest", async (req, res): Promise<void> => {
  const parsed = IngestGuardResultBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const code = parsed.data.pairingCode.toUpperCase();
  const [row] = await db
    .select()
    .from(guardScansTable)
    .where(
      and(
        eq(guardScansTable.pairingCode, code),
        eq(guardScansTable.status, "pending"),
      ),
    );
  if (!row || isExpired(row)) {
    res.status(404).json({ error: "Unknown or expired pairing code" });
    return;
  }

  const blobs = decodeBlobs(parsed.data.raw as Record<string, string>);
  if (!hasMinimumTelemetry(blobs)) {
    res.status(400).json({
      error:
        "Insufficient telemetry — the payload is missing core readings the agent always sends",
    });
    return;
  }

  // "Newly seen" = not present in any earlier completed Guard scan of the
  // same browser session.
  const prior = await db
    .select()
    .from(guardScansTable)
    .where(
      and(
        eq(guardScansTable.sessionId, row.sessionId),
        eq(guardScansTable.status, "complete"),
      ),
    );
  const seen = new Set<string>();
  for (const p of prior) {
    for (const d of (p.devices as GuardDevice[]) ?? []) seen.add(deviceKey(d));
  }
  // Trusted devices are treated as "previously seen" so they never trigger
  // "new device" findings in future scans.
  const trusted = await db
    .select()
    .from(guardTrustedDevicesTable)
    .where(eq(guardTrustedDevicesTable.sessionId, row.sessionId));
  for (const t of trusted) seen.add(t.deviceKey);

  const analysis = gradeGuardScan(blobs, seen);
  const hostname = blobs.hostname?.trim().split("\n")[0] ?? null;
  const machineLabel = [hostname, analysis.system.cpuBrand]
    .filter(Boolean)
    .join(" · ") || "Mac";

  let aiSummary: string;
  try {
    const result = await aiJson<{ summary: string }>(
      'You are PRISM Hardware & Network Guard, explaining a local Mac hardware/network scan to a non-technical user. Given real readings, write 3-5 plain-language sentences: overall health, the most important risk among connected devices or the network, and one concrete action (e.g. what to unplug or distrust). Be honest: this is detection and warning — software cannot physically block electrical damage from malicious hardware. Respond as JSON: {"summary": string}. No markdown.',
      JSON.stringify({
        machineLabel,
        system: analysis.system,
        devices: analysis.devices,
        network: analysis.network,
        findings: analysis.findings,
        trustScore: analysis.trustScore,
      }),
    );
    aiSummary = result.summary;
  } catch (err) {
    req.log.error({ err }, "Guard AI summary failed");
    res.status(502).json({ error: "AI analysis failed, please retry" });
    return;
  }

  await db
    .update(guardScansTable)
    .set({
      status: "complete",
      completedAt: new Date(),
      machineLabel,
      trustScore: analysis.trustScore,
      riskScore: analysis.riskScore,
      system: analysis.system,
      devices: analysis.devices,
      network: analysis.network,
      findings: analysis.findings,
      aiSummary,
    })
    .where(eq(guardScansTable.id, row.id));

  res.json({ ok: true });
});

export default router;
