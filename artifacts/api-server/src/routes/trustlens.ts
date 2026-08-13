import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import {
  db,
  urlInspectionsTable,
  policyAnalysesTable,
  cookieAnalysesTable,
} from "@workspace/db";
import {
  CreateUrlInspectionBody,
  CreateUrlInspectionResponse,
  ListUrlInspectionsResponse,
  CreatePolicyAnalysisBody,
  CreatePolicyAnalysisResponse,
  ListPolicyAnalysesResponse,
  CreateCookieAnalysisBody,
  CreateCookieAnalysisResponse,
  ListCookieAnalysesResponse,
  ListThreatIntelResponse,
} from "@workspace/api-zod";
import { aiJson, asArray, clampScore, normalizeSeverity } from "../lib/ai";
import { THREAT_INTEL } from "../lib/threat-intel";

const router: IRouter = Router();

function iso<T extends { createdAt: Date }>(row: T) {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

interface FindingAi {
  title: string;
  detail: string;
  severity: string;
  regulation?: string | null;
}

function normalizeFindings(items: FindingAi[] | undefined): FindingAi[] {
  return asArray<FindingAi>(items).map((f) => ({
    title: String(f.title ?? ""),
    detail: String(f.detail ?? ""),
    severity: normalizeSeverity(f.severity),
    regulation: f.regulation ? String(f.regulation) : null,
  }));
}

// ---------- URL Inspector ----------

const URL_PROMPT = `You are TrustLens URL Inspector, a compliance-audit tool that flags POTENTIALLY manipulative or risky characteristics of a URL for a compliance/security reviewer. Analyze the URL string itself (structure, domain, TLD, keywords, lookalike patterns, tracking parameters, URL shorteners, punycode, excessive subdomains). Use careful, non-definitive language ("potentially", "may indicate") — you cannot browse the URL, and this is not legal advice.

For each finding, if it plausibly implicates a specific regulation, cite it in "regulation" (e.g. "GDPR Art. 5(1)(a) — lawfulness/transparency", "FTC Act Sec. 5 — deceptive practices"). Use null when no specific regulation applies.

Respond as JSON: {"verdict": one of "safe"|"suspicious"|"dangerous"|"critical", "riskScore": 0-100, "findings":[{"title":s,"detail":s,"severity":"low"|"medium"|"high"|"critical","regulation":s|null}], "summary": 2-4 sentences for a compliance reviewer, noting this is an automated screen, not legal advice}`;

router.get("/trustlens/url-inspections", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(urlInspectionsTable)
    .orderBy(desc(urlInspectionsTable.createdAt));
  res.json(ListUrlInspectionsResponse.parse(rows.map(iso)));
});

router.post("/trustlens/url-inspections", async (req, res): Promise<void> => {
  const parsed = CreateUrlInspectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let result: {
    verdict: string;
    riskScore: number;
    findings: FindingAi[];
    summary: string;
  };
  try {
    result = await aiJson(URL_PROMPT, parsed.data.url.slice(0, 2000));
  } catch (err) {
    req.log.error({ err }, "URL inspection AI failed");
    res.status(502).json({ error: "AI analysis failed, please retry" });
    return;
  }

  const verdict = ["safe", "suspicious", "dangerous", "critical"].includes(
    result.verdict,
  )
    ? result.verdict
    : "suspicious";

  const [row] = await db
    .insert(urlInspectionsTable)
    .values({
      url: parsed.data.url,
      verdict,
      riskScore: clampScore(result.riskScore),
      findings: normalizeFindings(result.findings),
      aiSummary: String(result.summary ?? ""),
    })
    .returning();

  res.status(201).json(CreateUrlInspectionResponse.parse(iso(row)));
});

// ---------- Privacy Policy Analyzer ----------

const POLICY_PROMPT = `You are TrustLens Privacy Policy Analyzer, a compliance-audit tool that reviews privacy policies for a compliance reviewer and flags POTENTIALLY concerning clauses (data selling/sharing, broad licenses, vague retention, arbitration clauses, tracking, third-party sharing, missing legal basis, missing/weak deletion or access rights). Use careful, non-definitive language ("potentially", "may") — this is not legal advice.

For each red flag, if it plausibly implicates a specific regulation, cite it in "regulation" (e.g. "GDPR Art. 13 — information to be provided", "CCPA Cal. Civ. Code §1798.100 — right to know", "GDPR Art. 17 — right to erasure"). Use null when no specific regulation applies.

Respond as JSON: {"riskScore": 0-100, "redFlags":[{"title":s,"detail":s,"severity":"low"|"medium"|"high"|"critical","regulation":s|null}], "userRights":[array of plain-language rights the policy grants the user, e.g. deletion, access, opt-out], "retention": one-sentence plain-language description of data retention, "summary": 3-5 sentences for a compliance reviewer, noting this is an automated screen, not legal advice}`;

router.get("/trustlens/policy-analyses", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(policyAnalysesTable)
    .orderBy(desc(policyAnalysesTable.createdAt));
  res.json(ListPolicyAnalysesResponse.parse(rows.map(iso)));
});

router.post("/trustlens/policy-analyses", async (req, res): Promise<void> => {
  const parsed = CreatePolicyAnalysisBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let result: {
    riskScore: number;
    redFlags: FindingAi[];
    userRights: string[];
    retention: string;
    summary: string;
  };
  try {
    result = await aiJson(POLICY_PROMPT, parsed.data.text.slice(0, 24000));
  } catch (err) {
    req.log.error({ err }, "Policy analysis AI failed");
    res.status(502).json({ error: "AI analysis failed, please retry" });
    return;
  }

  const [row] = await db
    .insert(policyAnalysesTable)
    .values({
      excerpt: parsed.data.text.slice(0, 300),
      riskScore: clampScore(result.riskScore),
      redFlags: normalizeFindings(result.redFlags),
      userRights: asArray(result.userRights).map(String),
      retention: String(result.retention ?? ""),
      aiSummary: String(result.summary ?? ""),
    })
    .returning();

  res.status(201).json(CreatePolicyAnalysisResponse.parse(iso(row)));
});

// ---------- Cookie Banner Decoder ----------

const COOKIE_PROMPT = `You are TrustLens Cookie Banner Decoder, a compliance-audit tool that analyzes cookie consent banner text for a compliance reviewer, flagging POTENTIALLY manipulative design tactics and consent defects (confirmshaming, pre-ticked boxes, hidden reject options, misleading button hierarchy, forced consent bundling, vague purposes, no equal-prominence reject option). Use careful, non-definitive language — this is not legal advice.

For each tactic, if it plausibly implicates a specific regulation, cite it in "regulation" (e.g. "ePrivacy Directive Art. 5(3) — consent for cookies", "GDPR Art. 7(3) — withdrawal as easy as giving consent", "EU DSA Art. 25 — dark patterns"). Use null when no specific regulation applies.

Respond as JSON: {"manipulationScore": 0-100, "verdict": one of "fair"|"questionable"|"manipulative"|"deceptive", "tactics":[{"title":s,"detail":s,"severity":"low"|"medium"|"high"|"critical","regulation":s|null}], "summary": 2-4 sentences for a compliance reviewer, noting this is an automated screen, not legal advice}`;

router.get("/trustlens/cookie-analyses", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(cookieAnalysesTable)
    .orderBy(desc(cookieAnalysesTable.createdAt));
  res.json(ListCookieAnalysesResponse.parse(rows.map(iso)));
});

router.post("/trustlens/cookie-analyses", async (req, res): Promise<void> => {
  const parsed = CreateCookieAnalysisBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let result: {
    manipulationScore: number;
    verdict: string;
    tactics: FindingAi[];
    summary: string;
  };
  try {
    result = await aiJson(COOKIE_PROMPT, parsed.data.text.slice(0, 12000));
  } catch (err) {
    req.log.error({ err }, "Cookie analysis AI failed");
    res.status(502).json({ error: "AI analysis failed, please retry" });
    return;
  }

  const verdict = [
    "fair",
    "questionable",
    "manipulative",
    "deceptive",
  ].includes(result.verdict)
    ? result.verdict
    : "questionable";

  const [row] = await db
    .insert(cookieAnalysesTable)
    .values({
      excerpt: parsed.data.text.slice(0, 300),
      manipulationScore: clampScore(result.manipulationScore),
      verdict,
      tactics: normalizeFindings(result.tactics),
      aiSummary: String(result.summary ?? ""),
    })
    .returning();

  res.status(201).json(CreateCookieAnalysisResponse.parse(iso(row)));
});

// ---------- Threat Intel (static educational database) ----------

router.get("/trustlens/threat-intel", async (_req, res): Promise<void> => {
  res.json(ListThreatIntelResponse.parse(THREAT_INTEL));
});

export default router;
