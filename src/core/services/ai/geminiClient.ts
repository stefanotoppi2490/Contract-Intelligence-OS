/**
 * Gemini API client for STEP 5B.
 * Calls Gemini REST API; supports system + user prompt and JSON response with retry.
 * Do NOT call from tests (mock aiClauseExtractor instead).
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export type GeminiGenerateOptions = {
  systemPrompt?: string;
  userPrompt: string;
  /** If true, parse response as JSON and retry once with "Return ONLY valid JSON" on failure. */
  expectJson?: boolean;
};

export type GeminiGenerateResult =
  | { ok: true; text: string; json?: unknown }
  | { ok: false; error: string };

/**
 * Get API key from env. Returns undefined if not set (caller should skip or mock).
 */
export function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY;
}

/**
 * Get model name from env. Default: gemini-2.0-flash.
 */
export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";
}

/**
 * Call Gemini generateContent. Uses GEMINI_API_KEY and GEMINI_MODEL from env.
 * If expectJson=true and response is not valid JSON, retries once with "Return ONLY valid JSON" appended.
 */
export async function generateContent(
  options: GeminiGenerateOptions,
): Promise<GeminiGenerateResult> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return { ok: false, error: "GEMINI_API_KEY is not set" };
  }
  const model = getGeminiModel();
  const url = `${GEMINI_BASE}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const fullPrompt = options.systemPrompt
    ? `${options.systemPrompt}\n\n---\n\n${options.userPrompt}`
    : options.userPrompt;

  const body = {
    contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
    generationConfig: options.expectJson
      ? { responseMimeType: "application/json" as const }
      : undefined,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    return {
      ok: false,
      error: `Gemini API ${res.status}: ${errText.slice(0, 200)}`,
    };
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  if (!text) {
    return { ok: false, error: "Empty response from Gemini" };
  }

  if (options.expectJson) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Retry once with strict JSON instruction
      const retryPrompt = `${options.userPrompt}\n\nImportant: Return ONLY valid JSON, no markdown or commentary.`;
      const retryBody = {
        contents: [
          {
            role: "user",
            parts: [
              {
                text: options.systemPrompt
                  ? `${options.systemPrompt}\n\n---\n\n${retryPrompt}`
                  : retryPrompt,
              },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json" as const },
      };
      const retryRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(retryBody),
      });
      if (!retryRes.ok) {
        return { ok: false, error: `Gemini retry ${retryRes.status}` };
      }
      const retryData = (await retryRes.json()) as typeof data;
      const retryText =
        retryData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
      try {
        parsed = JSON.parse(retryText);
      } catch {
        return { ok: false, error: "Invalid JSON in response after retry" };
      }
      return { ok: true, text: retryText, json: parsed };
    }
    return { ok: true, text, json: parsed };
  }

  return { ok: true, text };
}
