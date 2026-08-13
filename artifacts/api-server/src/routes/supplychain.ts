import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, supplyChainScansTable } from "@workspace/db";
import {
  CreateSupplyChainScanBody,
  CreateSupplyChainScanResponse,
  GetSupplyChainScanResponse,
  ListSupplyChainScansResponse,
} from "@workspace/api-zod";
import { aiJson } from "../lib/ai";
import {
  parseDependencyFile,
  queryOsv,
  riskScoreFromVulns,
} from "../lib/deps";

const router: IRouter = Router();

function serialize(row: typeof supplyChainScansTable.$inferSelect) {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

router.get("/supplychain/scans", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(supplyChainScansTable)
    .orderBy(desc(supplyChainScansTable.createdAt));
  res.json(ListSupplyChainScansResponse.parse(rows.map(serialize)));
});

router.post("/supplychain/scans", async (req, res): Promise<void> => {
  const parsed = CreateSupplyChainScanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { filename, content } = parsed.data;

  let parsedFile;
  try {
    parsedFile = parseDependencyFile(filename, content);
  } catch {
    res.status(400).json({ error: "Could not parse dependency file" });
    return;
  }
  if (parsedFile.dependencies.length === 0) {
    res.status(400).json({ error: "No dependencies found in file" });
    return;
  }

  let vulnerabilities: Awaited<ReturnType<typeof queryOsv>> = [];
  try {
    vulnerabilities = await queryOsv(
      parsedFile.ecosystem,
      parsedFile.dependencies,
    );
  } catch (err) {
    req.log.error({ err }, "OSV lookup failed");
    res.status(502).json({ error: "Vulnerability database lookup failed" });
    return;
  }

  const riskScore = riskScoreFromVulns(
    parsedFile.dependencies.length,
    vulnerabilities,
  );

  let aiSummary: string;
  try {
    const result = await aiJson<{ summary: string }>(
      'You are a supply-chain security analyst. Given a dependency scan result, write a concise plain-language summary (3-5 sentences) of the security posture: overall risk, the most urgent packages to update, and a recommended next step. Respond as JSON: {"summary": string}. No markdown.',
      JSON.stringify({
        ecosystem: parsedFile.ecosystem,
        totalDependencies: parsedFile.dependencies.length,
        vulnerableCount: vulnerabilities.length,
        riskScore,
        vulnerabilities: vulnerabilities.slice(0, 30),
      }),
    );
    aiSummary = result.summary;
  } catch (err) {
    req.log.error({ err }, "AI summary failed");
    res.status(502).json({ error: "AI analysis failed, please retry" });
    return;
  }

  const vulnerablePackages = new Set(vulnerabilities.map((v) => v.packageName));
  const [row] = await db
    .insert(supplyChainScansTable)
    .values({
      filename,
      ecosystem: parsedFile.ecosystem,
      totalDependencies: parsedFile.dependencies.length,
      vulnerableCount: vulnerablePackages.size,
      riskScore,
      vulnerabilities,
      dependencies: parsedFile.dependencies,
      aiSummary,
    })
    .returning();

  res.status(201).json(CreateSupplyChainScanResponse.parse(serialize(row)));
});

router.get("/supplychain/scans/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .select()
    .from(supplyChainScansTable)
    .where(eq(supplyChainScansTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Scan not found" });
    return;
  }
  res.json(GetSupplyChainScanResponse.parse(serialize(row)));
});

router.delete("/supplychain/scans/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .delete(supplyChainScansTable)
    .where(eq(supplyChainScansTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Scan not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
