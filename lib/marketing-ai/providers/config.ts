import type { MarketingAIProviderConfig, MarketingAIProviderId } from "./types";

const DEFAULT_MODELS: Record<MarketingAIProviderId, string> = {
  openai: "gpt-4o-mini",
  gemini: "gemini-2.5-flash-lite",
  template: "built-in",
};

const FREE_TIER_PROVIDERS: MarketingAIProviderId[] = ["template", "gemini"];

function parseExplicitProvider(value: string | undefined): MarketingAIProviderId | null {
  if (value === "openai" || value === "gemini" || value === "template") {
    return value;
  }
  return null;
}

/** Alege automat providerul gratuit dacă nu e setat explicit. */
export function resolveMarketingAIProvider(): MarketingAIProviderId {
  const explicit = parseExplicitProvider(process.env.MARKETING_AI_PROVIDER?.trim());
  if (explicit) return explicit;

  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  if (process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()) {
    return "gemini";
  }

  return "template";
}

export function getMarketingAIProviderConfig(): MarketingAIProviderConfig {
  const provider = resolveMarketingAIProvider();

  const model =
    process.env.MARKETING_AI_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    DEFAULT_MODELS[provider];

  const temperature = Number(process.env.MARKETING_AI_TEMPERATURE ?? "0.8");

  return {
    provider,
    model,
    temperature: Number.isFinite(temperature) ? temperature : 0.8,
    isFreeTier: FREE_TIER_PROVIDERS.includes(provider),
  };
}

export function getProviderApiKey(provider: MarketingAIProviderId): string | null {
  if (provider === "openai") {
    return process.env.OPENAI_API_KEY?.trim() || null;
  }

  if (provider === "gemini") {
    return (
      process.env.GEMINI_API_KEY?.trim() ||
      process.env.GOOGLE_API_KEY?.trim() ||
      null
    );
  }

  return null;
}
