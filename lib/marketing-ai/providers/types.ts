export type MarketingAIProviderId = "openai";

export type MarketingAIProviderConfig = {
  provider: MarketingAIProviderId;
  model: string;
  temperature: number;
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
