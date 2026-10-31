export function clampScore(n: unknown, fallback = 0): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : fallback;
  return Math.max(0, Math.min(100, v));
}

/** Safely coerce a model-controlled value to an array (bounded). */
export function asArray<T>(v: unknown, max = 50): T[] {
  return Array.isArray(v) ? (v.slice(0, max).filter((item) => item !== null && item !== undefined) as T[]) : [];
}

const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export function normalizeSeverity(s: unknown): (typeof SEVERITIES)[number] {
  return SEVERITIES.includes(s as never) ? (s as never) : "medium";
}

/** JSON mode does not guarantee the model returned the expected top-level shape. */
export function parseAiObject<T>(raw: string): T {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AI returned a non-object JSON response");
  }
  return value as T;
}
