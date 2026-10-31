import { openai } from "@workspace/integrations-openai-ai-server";
import { parseAiObject } from "./ai-result";
export { asArray, clampScore, normalizeSeverity } from "./ai-result";

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
  }, { timeout: 30_000, maxRetries: 0 });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("AI returned an empty response");
  }
  return parseAiObject<T>(raw);
}

