import { getMarketingAIProviderConfig } from "./config";
import { createGeminiProvider } from "./gemini";
import { createOpenAIProvider } from "./openai";
import { createTemplateProvider } from "./template";
import type { MarketingAIProvider } from "./types";

export function getMarketingAIProvider(): MarketingAIProvider {
  const config = getMarketingAIProviderConfig();

  switch (config.provider) {
    case "gemini":
      return createGeminiProvider(config.model);
    case "template":
      return createTemplateProvider();
    case "openai":
    default:
      return createOpenAIProvider(config.model);
  }
}

export function isMarketingAIConfigured(): boolean {
  return getMarketingAIProvider().isConfigured();
}

export function getMarketingAIStatus() {
  const config = getMarketingAIProviderConfig();
  const provider = getMarketingAIProvider();

  const geminiKeySet = Boolean(
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim(),
  );
  const openaiKeySet = Boolean(process.env.OPENAI_API_KEY?.trim());
  const explicitProvider = process.env.MARKETING_AI_PROVIDER?.trim() || null;

  const modeLabel =
    config.provider === "template"
      ? "Demo gratuit (template)"
      : config.provider === "gemini"
        ? "Gemini Free Tier"
        : "OpenAI";

  return {
    provider: config.provider,
    model: config.model,
    configured: provider.isConfigured(),
    isFreeTier: config.isFreeTier,
    modeLabel,
    diagnostics: {
      geminiKeySet,
      openaiKeySet,
      explicitProvider,
    },
  };
}

export { getMarketingAIProviderConfig, resolveMarketingAIProvider } from "./config";
