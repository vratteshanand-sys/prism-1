# PRISM — "Know it like you know you."

A 4-in-1 digital trust & cybersecurity platform built for a hackathon. One lens, four beams of analysis:

1. **Supply Chain DNA** (`/supplychain`) — paste/upload a dependency file (package.json, requirements.txt), parses deps, checks real CVEs via the free OSV.dev API, risk score + AI summary.
2. **Sentinel** (`/sentinel`) — paste AI-generated text, scores 6 risk dimensions (safety, factuality, toxicity, bias, coherence, hallucination risk), flags problem sentences.
3. **TrustLens** (`/trustlens`) — dark-pattern exposure suite: URL inspector, privacy-policy analyzer, cookie-banner decoder, plus a static threat-intel database of 10 dark patterns. Educational tone, "potentially manipulative" language.
4. **FinGuard** (`/finguard`) — paste bank transactions, flags fraud signals with reasons + AI summary.

Plus a cross-module dashboard (`/`) and unified reports page (`/reports`).

## Architecture

- pnpm monorepo. Frontend: `artifacts/prism` (React + Vite + wouter + recharts, served at `/`). Backend: `artifacts/api-server` (Express 5, mounted at `/api`).
- API contract: `lib/api-spec/openapi.yaml` → codegen (`pnpm --filter @workspace/api-spec run codegen`) → React Query hooks in `lib/api-client-react` + Zod schemas in `lib/api-zod`. Note: use `type: number` (not `integer`) in the spec — the zod generator emits unsupported `zod.int()` otherwise.
- DB: PostgreSQL via Drizzle, schema in `lib/db/src/schema/prism.ts` (6 tables, JSON columns for findings/flags/scores). Push with `pnpm --filter @workspace/db run push`.
- AI: OpenAI via Replit AI integration (`@workspace/integrations-openai-ai-server`, model `gpt-5.6-terra`, JSON responses, `max_completion_tokens`). Helper: `artifacts/api-server/src/lib/ai.ts`.
- Vulnerability data: OSV.dev querybatch + per-vuln detail lookups (`artifacts/api-server/src/lib/deps.ts`), no API key needed.

## User preferences

- Reply in plain text; avoid interactive question forms.
- Enthusiastic tone welcome, but give honest assessments.
- No emojis in the product UI.
