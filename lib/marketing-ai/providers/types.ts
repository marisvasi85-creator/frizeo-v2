export type MarketingAIProviderId = "openai" | "gemini" | "template";

export type MarketingAIProviderConfig = {
  provider: MarketingAIProviderId;
  model: string;
  temperature: number;
  isFreeTier: boolean;
};

export type MarketingAIMessage = {
  role: "system" | "user";
  content: string;
};

export type MarketingAICompletionRequest = {
  messages: MarketingAIMessage[];
  jsonMode?: boolean;
  temperature?: number;
};

export interface MarketingAIProvider {
  readonly id: MarketingAIProviderId;
  isConfigured(): boolean;
  complete(request: MarketingAICompletionRequest): Promise<string>;
}
