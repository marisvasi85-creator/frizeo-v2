import type { MarketingAIProviderConfig, MarketingAIProviderId } from "./types";

const DEFAULT_MODELS: Record<MarketingAIProviderId, string> = {
  openai: "gpt-4o-mini",
};

function parseProvider(value: string | undefined): MarketingAIProviderId {
  if (value === "openai") return "openai";
  return "openai";
}

export function getMarketingAIProviderConfig(): MarketingAIProviderConfig {
  const provider = parseProvider(process.env.MARKETING_AI_PROVIDER);

  const model =
    process.env.MARKETING_AI_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    DEFAULT_MODELS[provider];

  const temperature = Number(process.env.MARKETING_AI_TEMPERATURE ?? "0.8");

  return {
    provider,
    model,
    temperature: Number.isFinite(temperature) ? temperature : 0.8,
  };
}

export function getProviderApiKey(provider: MarketingAIProviderId): string | null {
  if (provider === "openai") {
    return process.env.OPENAI_API_KEY?.trim() || null;
  }

  return null;
}
