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
  error?: { message?: string };
};

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
        throw new Error(data.error?.message || "Eroare Gemini API");
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("Nu am primit răspuns de la Gemini");
      }

      return text;
    },
  };
}
