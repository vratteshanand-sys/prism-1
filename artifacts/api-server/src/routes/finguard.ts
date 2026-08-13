import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, finguardAnalysesTable } from "@workspace/db";
import {
  CreateFinguardAnalysisBody,
  CreateFinguardAnalysisResponse,
  GetFinguardAnalysisResponse,
  ListFinguardAnalysesResponse,
} from "@workspace/api-zod";
import { aiJson, asArray, clampScore, normalizeSeverity } from "../lib/ai";

const router: IRouter = Router();

function serialize(row: typeof finguardAnalysesTable.$inferSelect) {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

const SYSTEM_PROMPT = `You are FinGuard, a fraud-signal analyst for personal and business bank transactions. The user pastes transactions (CSV or free text). Identify how many transactions there are and flag POTENTIALLY fraudulent or unusual ones: duplicates, round-number transfers to new payees, rapid sequences, unusually large amounts vs the rest, odd-hour activity, known scam patterns (gift cards, crypto ramps, wire mules), subscription creep. Use careful language ("potentially", "unusual") — you cannot verify intent.

Respond as JSON: {"transactionCount": n, "riskScore": 0-100, "flags":[{"transaction": short quote/description of the flagged transaction, "reason": plain-language explanation, "severity":"low"|"medium"|"high"|"critical"}], "summary": 3-5 plain-language sentences}`;

router.get("/finguard/analyses", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(finguardAnalysesTable)
    .orderBy(desc(finguardAnalysesTable.createdAt));
  res.json(ListFinguardAnalysesResponse.parse(rows.map(serialize)));
});

router.post("/finguard/analyses", async (req, res): Promise<void> => {
  const parsed = CreateFinguardAnalysisBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let result: {
    transactionCount: number;
    riskScore: number;
    flags: { transaction: string; reason: string; severity: string }[];
    summary: string;
  };
  try {
    result = await aiJson(SYSTEM_PROMPT, parsed.data.content.slice(0, 24000));
  } catch (err) {
    req.log.error({ err }, "FinGuard AI analysis failed");
    res.status(502).json({ error: "AI analysis failed, please retry" });
    return;
  }

  const flags = asArray<{ transaction: string; reason: string; severity: string }>(result.flags).map((f) => ({
    transaction: String(f.transaction ?? ""),
    reason: String(f.reason ?? ""),
    severity: normalizeSeverity(f.severity),
  }));

  const [row] = await db
    .insert(finguardAnalysesTable)
    .values({
      transactionCount: Math.max(
        0,
        Math.round(Number(result.transactionCount) || 0),
      ),
      flaggedCount: flags.length,
      riskScore: clampScore(result.riskScore),
      flags,
      aiSummary: String(result.summary ?? ""),
    })
    .returning();

  res.status(201).json(CreateFinguardAnalysisResponse.parse(serialize(row)));
});

router.get("/finguard/analyses/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .select()
    .from(finguardAnalysesTable)
    .where(eq(finguardAnalysesTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }
  res.json(GetFinguardAnalysisResponse.parse(serialize(row)));
});

router.delete("/finguard/analyses/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .delete(finguardAnalysesTable)
    .where(eq(finguardAnalysesTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
