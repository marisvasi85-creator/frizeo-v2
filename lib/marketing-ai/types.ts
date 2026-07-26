export const MARKETING_CONTENT_TYPES = [
  "instagram_post",
  "reel",
  "story",
  "christmas_promo",
  "service_promo",
  "birthday_offer",
  "easter_promo",
  "black_friday",
  "back_to_school",
] as const;

export type MarketingContentType = (typeof MARKETING_CONTENT_TYPES)[number];

export const MARKETING_TONES = ["relaxed", "premium", "street"] as const;

export type MarketingTone = (typeof MARKETING_TONES)[number];

export const MARKETING_TONE_LABELS: Record<MarketingTone, string> = {
  relaxed: "Relaxat",
  premium: "Premium",
  street: "Street",
};

export const MARKETING_VARIANT_COUNT = 3;

export const MARKETING_EXTRA_NOTES_MAX = 500;

export type MarketingContext = {
  salonName: string;
  salonDescription: string | null;
  salonAddress: string | null;
  cityHint: string | null;
  barberName: string;
  barberBio: string | null;
  barberInstagram: string | null;
  bookingUrl: string;
  services: Array<{
    id: string;
    name: string;
    duration: number;
    price: number | null;
    showPrice: boolean;
  }>;
};

export type GenerateMarketingInput = {
  contentType: MarketingContentType;
  serviceId?: string;
  extraNotes?: string;
  tone?: MarketingTone;
  variantCount?: number;
};

export type GenerateMarketingResult = {
  title: string;
  content: string;
  hashtags: string[];
  callToAction: string;
};

export function isMarketingTone(value: string): value is MarketingTone {
  return (MARKETING_TONES as readonly string[]).includes(value);
}
