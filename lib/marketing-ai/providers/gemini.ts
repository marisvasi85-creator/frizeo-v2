import { getProviderApiKey } from "./config";
import type {
  MarketingAICompletionRequest,
  MarketingAIProvider,
} from "./types";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message?: string; status?: string };
};

/** Modele cu free tier activ în 2026 — în ordinea preferinței. */
export const GEMINI_FREE_TIER_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash-lite",
] as const;

export function isGeminiQuotaError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("limit: 0") ||
    lower.includes("resource_exhausted")
  );
}

export function formatGeminiError(message: string): string {
  if (isGeminiQuotaError(message)) {
    if (message.includes("limit: 0")) {
      return (
        "Cheia Gemini nu are cotă free tier pentru acest model. " +
        "Creează o cheie nouă în Google AI Studio (fără billing activ) sau setează " +
        "MARKETING_AI_MODEL=gemini-2.5-flash-lite în Vercel."
      );
    }
    return "Ai depășit limita gratuită Gemini. Încearcă din nou peste câteva minute.";
  }

  return message;
}

async function callGeminiModel(
  apiKey: string,
  model: string,
  request: MarketingAICompletionRequest,
): Promise<string> {
  const system = request.messages.find((m) => m.role === "system")?.content;
  const user = request.messages.find((m) => m.role === "user")?.content;
  if (!user) {
    throw new Error("Prompt lipsă");
  }

  const prompt = system ? `${system}\n\n${user}` : user;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: request.temperature ?? 0.8,
        responseMimeType: request.jsonMode ? "application/json" : "text/plain",
      },
    }),
  });

  const data = (await response.json()) as GeminiResponse;

  if (!response.ok) {
    const msg = data.error?.message || "Eroare Gemini API";
    throw new Error(msg);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Nu am primit răspuns de la Gemini");
  }

  return text;
}

export function createGeminiProvider(model: string): MarketingAIProvider {
  return {
    id: "gemini",
    isConfigured() {
      return Boolean(getProviderApiKey("gemini"));
    },
    async complete(request: MarketingAICompletionRequest) {
      const apiKey = getProviderApiKey("gemini");
      if (!apiKey) {
        throw new Error("Providerul Gemini nu este configurat.");
      }

      const modelsToTry = [
        model,
        ...GEMINI_FREE_TIER_MODELS.filter((candidate) => candidate !== model),
      ];

      let lastError = "Eroare Gemini API";

      for (const candidate of modelsToTry) {
        try {
          return await callGeminiModel(apiKey, candidate, request);
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : "Eroare Gemini API";
          lastError = message;

          if (!isGeminiQuotaError(message)) {
            throw new Error(formatGeminiError(message));
          }
        }
      }

      throw new Error(formatGeminiError(lastError));
    },
  };
}
