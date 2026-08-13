import {
  pgTable,
  serial,
  text,
  integer,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

export const supplyChainScansTable = pgTable("supply_chain_scans", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  filename: text("filename").notNull(),
  ecosystem: text("ecosystem").notNull(),
  totalDependencies: integer("total_dependencies").notNull(),
  vulnerableCount: integer("vulnerable_count").notNull(),
  riskScore: integer("risk_score").notNull(),
  vulnerabilities: jsonb("vulnerabilities").notNull().default([]),
  dependencies: jsonb("dependencies").notNull().default([]),
  aiSummary: text("ai_summary").notNull(),
});

export const sentinelAnalysesTable = pgTable("sentinel_analyses", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  textExcerpt: text("text_excerpt").notNull(),
  overallRisk: integer("overall_risk").notNull(),
  riskLevel: text("risk_level").notNull(),
  scores: jsonb("scores").notNull(),
  flags: jsonb("flags").notNull().default([]),
  aiSummary: text("ai_summary").notNull(),
});

export const urlInspectionsTable = pgTable("url_inspections", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  url: text("url").notNull(),
  verdict: text("verdict").notNull(),
  riskScore: integer("risk_score").notNull(),
  findings: jsonb("findings").notNull().default([]),
  aiSummary: text("ai_summary").notNull(),
});

export const policyAnalysesTable = pgTable("policy_analyses", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  excerpt: text("excerpt").notNull(),
  riskScore: integer("risk_score").notNull(),
  redFlags: jsonb("red_flags").notNull().default([]),
  userRights: jsonb("user_rights").notNull().default([]),
  retention: text("retention").notNull(),
  aiSummary: text("ai_summary").notNull(),
});

export const cookieAnalysesTable = pgTable("cookie_analyses", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  excerpt: text("excerpt").notNull(),
  manipulationScore: integer("manipulation_score").notNull(),
  verdict: text("verdict").notNull(),
  tactics: jsonb("tactics").notNull().default([]),
  aiSummary: text("ai_summary").notNull(),
});

export const deviceScansTable = pgTable("device_scans", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deviceLabel: text("device_label").notNull(),
  browserName: text("browser_name").notNull(),
  browserVersion: text("browser_version").notNull(),
  osName: text("os_name").notNull(),
  browserUpToDate: jsonb("browser_up_to_date"),
  latestVersion: text("latest_version"),
  trustScore: integer("trust_score").notNull(),
  riskScore: integer("risk_score").notNull(),
  fingerprintExposure: integer("fingerprint_exposure").notNull(),
  findings: jsonb("findings").notNull().default([]),
  signals: jsonb("signals").notNull().default([]),
  aiSummary: text("ai_summary").notNull(),
});

export const guardScansTable = pgTable("guard_scans", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  pairingCode: text("pairing_code").notNull(),
  status: text("status").notNull().default("pending"),
  machineLabel: text("machine_label"),
  trustScore: integer("trust_score"),
  riskScore: integer("risk_score"),
  system: jsonb("system"),
  devices: jsonb("devices").notNull().default([]),
  network: jsonb("network"),
  findings: jsonb("findings").notNull().default([]),
  aiSummary: text("ai_summary"),
});

export const deepScansTable = pgTable("deep_scans", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  pairingCode: text("pairing_code").notNull(),
  status: text("status").notNull().default("pending"),
  machineLabel: text("machine_label"),
  trustScore: integer("trust_score"),
  riskScore: integer("risk_score"),
  posture: jsonb("posture"),
  findings: jsonb("findings").notNull().default([]),
  aiSummary: text("ai_summary"),
});

export const scanSharesTable = pgTable("scan_shares", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  module: text("module").notNull(),
  title: text("title").notNull(),
  trustScore: integer("trust_score"),
  riskScore: integer("risk_score").notNull().default(0),
  aiSummary: text("ai_summary"),
  findings: jsonb("findings").notNull().default([]),
  posture: jsonb("posture"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const guardTrustedDevicesTable = pgTable("guard_trusted_devices", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  deviceKey: text("device_key").notNull(),
  label: text("label"),
  addedAt: timestamp("added_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const finguardAnalysesTable = pgTable("finguard_analyses", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  transactionCount: integer("transaction_count").notNull(),
  flaggedCount: integer("flagged_count").notNull(),
  riskScore: integer("risk_score").notNull(),
  flags: jsonb("flags").notNull().default([]),
  aiSummary: text("ai_summary").notNull(),
});
