import { openai } from "@workspace/integrations-openai-ai-server";

const MODEL = "gpt-5.6-terra";

/**
 * Ask the model for a JSON object response. The system prompt must describe
 * the exact JSON shape expected. Throws if the model returns invalid JSON.
 */
export async function aiJson<T>(
  systemPrompt: string,
  userContent: string,
): Promise<T> {
  const response = await openai.chat.completions.create({
    model: MODEL,
    max_completion_tokens: 4096,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("AI returned an empty response");
  }
  return JSON.parse(raw) as T;
}

export function clampScore(n: unknown, fallback = 0): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : fallback;
  return Math.max(0, Math.min(100, v));
}

/** Safely coerce a model-controlled value to an array (bounded). */
export function asArray<T>(v: unknown, max = 50): T[] {
  return Array.isArray(v) ? (v.slice(0, max) as T[]) : [];
}

const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export function normalizeSeverity(s: unknown): (typeof SEVERITIES)[number] {
  return SEVERITIES.includes(s as never) ? (s as never) : "medium";
}
