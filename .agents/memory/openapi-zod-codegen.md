---
name: OpenAPI zod codegen
description: Avoiding zod.int() breakage in generated api-zod code
---
Use `type: number` instead of `type: integer` in `lib/api-spec/openapi.yaml`.

**Why:** The orval zod client generates `zod.int()` for integer fields, but the workspace's zod version has no top-level `int()`, so `pnpm --filter @workspace/api-spec run codegen` fails typecheck.

**How to apply:** When authoring/editing the OpenAPI spec, always declare numeric fields as `type: number`; the TS type is `number` either way.
