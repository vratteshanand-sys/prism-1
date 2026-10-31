# PRISM — Security Intelligence Platform

PRISM is a student-built cybersecurity and digital-trust prototype. The React interface brings dependency vulnerability checks, AI-output review, privacy and dark-pattern analysis, transaction risk signals, and device-posture tools into one dashboard.

## What is implemented

- Supply Chain DNA parses dependency lists and queries OSV vulnerability data.
- Sentinel asks an AI model to review text for risk signals; its scores are estimates, not verified fact checks.
- TrustLens includes URL, privacy-policy and cookie-banner analysis.
- FinGuard reviews user-supplied transactions for suspicious patterns; it is not a bank integration or a definitive fraud detector.
- Device and Guard modules inspect supplied device signals; optional local scripts require the device owner's informed authorization.
- Reports and optional share links support reviewing results.

## Local setup

Use Node.js and pnpm. Install workspace dependencies with `pnpm install`. Run `pnpm --filter @workspace/prism dev` for the frontend and `pnpm --filter @workspace/api-server dev` for the API. Set the frontend `PORT` and `BASE_PATH` for your host.

The backend requires a PostgreSQL `DATABASE_URL`. AI-backed routes also require `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` for the configured OpenAI-compatible integration. Keep credentials in the host's secret manager, never in the repository. Apply the database schema only to a database you own and intend to modify.

## Validation

`pnpm --filter @workspace/api-server test` runs the analysis and response-boundary regression tests. `pnpm --filter @workspace/prism typecheck` and `pnpm --filter @workspace/prism build` check the frontend. AI response tests run locally without making paid model requests.

The AI helper rejects non-object JSON, removes null array entries before normalization, uses a 30-second request timeout, and disables automatic retries. These controls reduce accidental repeated requests; they do not cap account spending.

## Deployment and privacy limits

This repository is a prototype, not a production security service. The current API includes shared analysis-history endpoints without per-user ownership enforcement. Do not expose it publicly with real transaction records, device reports, private text, or a live paid AI key. Add authentication, authorization, tenant-scoped queries, rate limits and retention controls before a public backend deployment.

Anyone holding a report share link can read that report until it expires; do not share sensitive findings publicly. AI and hosting may incur provider charges. No paid service is required for the local tests described above. Deploying the interface alone does not make its API integrations operational.
