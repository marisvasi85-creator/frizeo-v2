export const MARKETING_CONTENT_TYPES = [
  "instagram_post",
  "reel",
  "story",
  "christmas_promo",
  "service_promo",
  "birthday_offer",
] as const;

export type MarketingContentType = (typeof MARKETING_CONTENT_TYPES)[number];

export type MarketingContext = {
  salonName: string;
  salonDescription: string | null;
  salonAddress: string | null;
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
};

export type GenerateMarketingResult = {
  title: string;
  content: string;
  hashtags: string[];
  callToAction: string;
};
