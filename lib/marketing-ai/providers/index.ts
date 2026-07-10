import { getMarketingAIProviderConfig } from "./config";
import { createOpenAIProvider } from "./openai";
import type { MarketingAIProvider } from "./types";

export function getMarketingAIProvider(): MarketingAIProvider {
  const config = getMarketingAIProviderConfig();

  switch (config.provider) {
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

  return {
    provider: config.provider,
    model: config.model,
    configured: provider.isConfigured(),
  };
}

export { getMarketingAIProviderConfig } from "./config";
