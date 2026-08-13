import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db, guardTrustedDevicesTable } from "@workspace/db";
import { ListTrustedDevicesResponse, AddTrustedDeviceResponse, AddTrustedDeviceBody } from "@workspace/api-zod";

const router: IRouter = Router();
const SESSION_COOKIE = "prism_device_sid";

function getOrSetSessionId(req: Request, res: Response): string {
  const existing = (req as Request & { cookies?: Record<string, string> }).cookies?.[SESSION_COOKIE];
  if (existing && /^[a-f0-9-]{36}$/.test(existing)) return existing;
  const sid = randomUUID();
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 365 * 24 * 60 * 60 * 1000,
  });
  return sid;
}

function serialize(row: typeof guardTrustedDevicesTable.$inferSelect) {
  return {
    id: row.id,
    deviceKey: row.deviceKey,
    label: row.label ?? null,
    addedAt: row.addedAt.toISOString(),
  };
}

router.get("/guard/trust", async (req, res): Promise<void> => {
  const sid = getOrSetSessionId(req, res);
  const rows = await db
    .select()
    .from(guardTrustedDevicesTable)
    .where(eq(guardTrustedDevicesTable.sessionId, sid));
  res.json(ListTrustedDevicesResponse.parse(rows.map(serialize)));
});

router.post("/guard/trust", async (req, res): Promise<void> => {
  const sid = getOrSetSessionId(req, res);
  const parsed = AddTrustedDeviceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // Upsert: if already trusted, return existing record.
  const [existing] = await db
    .select()
    .from(guardTrustedDevicesTable)
    .where(
      and(
        eq(guardTrustedDevicesTable.sessionId, sid),
        eq(guardTrustedDevicesTable.deviceKey, parsed.data.deviceKey),
      ),
    );
  if (existing) {
    res.status(201).json(AddTrustedDeviceResponse.parse(serialize(existing)));
    return;
  }
  const [row] = await db
    .insert(guardTrustedDevicesTable)
    .values({
      sessionId: sid,
      deviceKey: parsed.data.deviceKey,
      label: parsed.data.label ?? null,
    })
    .returning();
  res.status(201).json(AddTrustedDeviceResponse.parse(serialize(row)));
});

router.delete("/guard/trust/:deviceKey", async (req, res): Promise<void> => {
  const sid = getOrSetSessionId(req, res);
  const key = Array.isArray(req.params.deviceKey) ? req.params.deviceKey[0] : req.params.deviceKey;
  await db
    .delete(guardTrustedDevicesTable)
    .where(
      and(
        eq(guardTrustedDevicesTable.sessionId, sid),
        eq(guardTrustedDevicesTable.deviceKey, key),
      ),
    );
  res.sendStatus(204);
});

export default router;
