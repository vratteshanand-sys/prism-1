import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, scanSharesTable } from "@workspace/db";
import { CreateShareBody, CreateShareResponse, GetShareResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const SHARE_EXPIRY_DAYS = 90;

function makeToken(): string {
  return randomBytes(16).toString("base64url");
}

function serializeShare(row: typeof scanSharesTable.$inferSelect, shareUrl: string) {
  return {
    token: row.token,
    shareUrl,
    module: row.module,
    title: row.title,
    trustScore: row.trustScore ?? null,
    riskScore: row.riskScore,
    aiSummary: row.aiSummary ?? null,
    findings: row.findings ?? [],
    posture: row.posture ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

router.post("/shares", async (req, res): Promise<void> => {
  const parsed = CreateShareBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const token = makeToken();
  const [row] = await db
    .insert(scanSharesTable)
    .values({
      token,
      module: parsed.data.module,
      title: parsed.data.title,
      trustScore: parsed.data.trustScore ?? null,
      riskScore: parsed.data.riskScore,
      aiSummary: parsed.data.aiSummary ?? null,
      findings: parsed.data.findings as object[],
      posture: parsed.data.posture as object ?? null,
    })
    .returning();

  const proto = ((req.headers["x-forwarded-proto"] as string) ?? req.protocol ?? "https").split(",")[0].trim();
  const host = ((req.headers["x-forwarded-host"] as string) ?? req.headers.host ?? "").split(",")[0].trim();
  const base = /^https?$/.test(proto) && /^[A-Za-z0-9.-]+(:\d+)?$/.test(host)
    ? `${proto}://${host}`
    : "https://localhost";
  const shareUrl = `${base}/share/${token}`;

  res.status(201).json(CreateShareResponse.parse({ token, shareUrl }));
});

router.get("/shares/:token", async (req, res): Promise<void> => {
  const token = req.params.token;
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(token)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [row] = await db
    .select()
    .from(scanSharesTable)
    .where(eq(scanSharesTable.token, token));
  if (!row) {
    res.status(404).json({ error: "Share not found or expired" });
    return;
  }
  const expired = Date.now() - row.createdAt.getTime() > SHARE_EXPIRY_DAYS * 86400 * 1000;
  if (expired) {
    res.status(404).json({ error: "Share has expired" });
    return;
  }

  const proto = ((req.headers["x-forwarded-proto"] as string) ?? req.protocol ?? "https").split(",")[0].trim();
  const host = ((req.headers["x-forwarded-host"] as string) ?? req.headers.host ?? "").split(",")[0].trim();
  const base = /^https?$/.test(proto) && /^[A-Za-z0-9.-]+(:\d+)?$/.test(host)
    ? `${proto}://${host}`
    : "https://localhost";
  const shareUrl = `${base}/share/${token}`;

  res.json(GetShareResponse.parse(serializeShare(row, shareUrl)));
});

export default router;
