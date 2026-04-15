import { MAX_RETRIES, BASE_DELAY } from './constants.js';

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// --- Sleep helper ---
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// --- Internal: shared retry loop for Gemini calls ---
// fetchFn receives no arguments; throws errors to trigger retries.
// Recognized error messages: "INVALID_KEY", "RATE_LIMIT", "RATE_LIMIT:<seconds>", "EMPTY_RESPONSE"
async function retryGeminiFetch(fetchFn, { onStatusChange } = {}) {
  let retries = 0;
  while (retries < MAX_RETRIES) {
    try {
      return await fetchFn();
    } catch (error) {
      if (error.message === "INVALID_KEY") {
        onStatusChange?.("Error: Invalid or missing API Key. Please check Settings.");
        return null;
      }

      const isRateLimit = error.message.startsWith("RATE_LIMIT") || error.message.includes("429");

      if (retries === MAX_RETRIES - 1) {
        console.error("Final API Failure:", error);
        onStatusChange?.("The Board is overwhelmed (Rate Limit). Please try again in 60s.");
        await sleep(BASE_DELAY);
        onStatusChange?.(null);
        return null;
      }

      let delay = (Math.pow(2, retries) * BASE_DELAY) + (Math.random() * 2000);
      if (isRateLimit) {
        const match = error.message.match(/RATE_LIMIT:(\d+)/);
        const retryAfterSecs = match ? parseInt(match[1]) : 0;
        delay = retryAfterSecs > 0 ? retryAfterSecs * 1000 + 1000 : delay + 5000;
        onStatusChange?.(`High traffic (Rate Limit). Cooling down for ${Math.ceil(delay / 1000)}s...`);
      } else {
        onStatusChange?.(`Network glitch. Retrying in ${Math.ceil(delay / 1000)}s...`);
      }

      await sleep(delay);
      retries++;
    }
  }
  return null;
}

// --- Public: Standard Gemini call ---
// options: { apiKey, onStatusChange }
export async function callGemini(prompt, systemInstruction = "You are a helpful AI.", maxTokens = 1000, { apiKey, onStatusChange } = {}) {
  return retryGeminiFetch(async () => {
    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens },
      }),
    });

    if (response.status === 403) throw new Error("INVALID_KEY");
    if (response.status === 429 || response.status === 503) {
      const retryAfter = response.headers.get('Retry-After');
      throw new Error(retryAfter ? `RATE_LIMIT:${retryAfter}` : "RATE_LIMIT");
    }
    if (!response.ok) throw new Error(`HTTP_${response.status}`);

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      const blockReason = data.promptFeedback?.blockReason;
      if (blockReason) return "My response was blocked by content policy.";
      const finishReason = data.candidates?.[0]?.finishReason;
      if (finishReason === "SAFETY") return "I cannot respond to that due to safety guidelines.";
      if (finishReason === "RECITATION") return "I cannot reproduce that content.";
      if (finishReason === "MAX_TOKENS") return "...";
      // Transient/unknown — retry
      throw new Error("EMPTY_RESPONSE");
    }

    onStatusChange?.(null);
    return text;
  }, { onStatusChange });
}

// --- Public: Gemini call with Google Search grounding ---
// options: { apiKey, onStatusChange }
export async function callGeminiWithSearch(prompt, maxTokens = 300, { apiKey, onStatusChange } = {}) {
  return retryGeminiFetch(async () => {
    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens },
      }),
    });

    if (response.status === 403) throw new Error("INVALID_KEY");
    if (response.status === 429 || response.status === 503) {
      const retryAfter = response.headers.get('Retry-After');
      throw new Error(retryAfter ? `RATE_LIMIT:${retryAfter}` : "RATE_LIMIT");
    }
    if (!response.ok) throw new Error(`HTTP_${response.status}`);

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      const blockReason = data.promptFeedback?.blockReason;
      if (blockReason) return { text: "My response was blocked by content policy.", sources: [] };
      const finishReason = data.candidates?.[0]?.finishReason;
      if (finishReason === "SAFETY") return { text: "I cannot respond to that due to safety guidelines.", sources: [] };
      throw new Error("EMPTY_RESPONSE");
    }

    const sources = data.candidates?.[0]?.groundingMetadata?.webSearchQueries || [];
    onStatusChange?.(null);
    return { text, sources };
  }, { onStatusChange });
}

// --- Public: OpenRouter call (alternative model providers) ---
// options: { apiKey, onStatusChange }
export async function callOpenRouter(userPrompt, systemInstruction = "", model, maxTokens = 500, { apiKey, onStatusChange } = {}) {
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://boardroom-sim.app",
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
          { role: "user", content: userPrompt }
        ],
        max_tokens: maxTokens,
      }),
    });
    if (!response.ok) throw new Error(`OpenRouter error: ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? "";
  } catch (e) {
    console.error("OpenRouter call failed:", e);
    return null;
  }
}

// --- Public: JSON parse helpers (Gemini often wraps output in markdown code fences) ---

// Strips code fences, finds first {...} block, parses and returns it (or null).
// Throws on malformed JSON — caller is responsible for try/catch.
export function parseJsonObject(rawText) {
  const cleaned = rawText.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  return JSON.parse(match[0]);
}

// Strips code fences, finds first [...] block, parses and returns it (or null).
// Throws on malformed JSON — caller is responsible for try/catch.
export function parseJsonArray(rawText) {
  const cleaned = rawText.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) return null;
  return JSON.parse(match[0]);
}
