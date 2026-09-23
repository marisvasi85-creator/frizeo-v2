export const MARKETING_CHANNELS = [
  "instagram",
  "story",
  "reel",
  "whatsapp",
  "facebook",
  "tiktok",
] as const;

export type MarketingChannel = (typeof MARKETING_CHANNELS)[number];

export const MARKETING_CHANNEL_LABELS: Record<MarketingChannel, string> = {
  instagram: "Instagram",
  story: "Story",
  reel: "Reel",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  tiktok: "TikTok",
};

export function isMarketingChannel(value: string): value is MarketingChannel {
  return (MARKETING_CHANNELS as readonly string[]).includes(value);
}

/** Where the booking link is actually clickable. */
export function channelUsesFullBookingUrl(channel: MarketingChannel): boolean {
  return channel === "whatsapp";
}

export function utmSourceForChannel(channel: MarketingChannel): string {
  if (channel === "reel") return "instagram";
  if (channel === "story") return "story";
  return channel;
}

export function defaultChannelForContentType(contentType: string): MarketingChannel {
  if (contentType === "reel") return "reel";
  if (contentType === "story") return "story";
  return "instagram";
}
