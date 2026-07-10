import OpenAI from "openai";
import { getProviderApiKey } from "./config";
import type {
  MarketingAICompletionRequest,
  MarketingAIProvider,
} from "./types";

export function createOpenAIProvider(model: string): MarketingAIProvider {
  return {
    id: "openai",
    isConfigured() {
      return Boolean(getProviderApiKey("openai"));
    },
    async complete(request: MarketingAICompletionRequest) {
      const apiKey = getProviderApiKey("openai");
      if (!apiKey) {
        throw new Error("Providerul OpenAI nu este configurat.");
      }

      const client = new OpenAI({ apiKey });

      const completion = await client.chat.completions.create({
        model,
        temperature: request.temperature ?? 0.8,
        messages: request.messages,
        response_format: request.jsonMode ? { type: "json_object" } : undefined,
      });

      const message = completion.choices[0]?.message?.content;
      if (!message) {
        throw new Error("Nu am primit răspuns de la AI");
      }

      return message;
    },
  };
}
