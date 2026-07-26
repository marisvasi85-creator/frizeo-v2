import type { GenerateMarketingResult, MarketingContentType } from "./types";

export type MarketingAIHistoryItem = {
  id: string;
  contentType: MarketingContentType | string;
  provider: string;
  createdAt: string;
  title: string;
  content: string;
  hashtags: string[];
  callToAction: string;
  barberId: string | null;
};

export function historyItemToResult(
  item: MarketingAIHistoryItem,
): GenerateMarketingResult {
  return {
    title: item.title,
    content: item.content,
    hashtags: item.hashtags,
    callToAction: item.callToAction,
  };
}
