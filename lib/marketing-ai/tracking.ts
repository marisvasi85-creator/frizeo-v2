export const MARKETING_UTM_SOURCES = [
  "instagram",
  "facebook",
  "tiktok",
  "whatsapp",
  "qr",
  "story",
] as const;

export type MarketingUtmSource = (typeof MARKETING_UTM_SOURCES)[number];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isMarketingUtmSource(value: string): value is MarketingUtmSource {
  return (MARKETING_UTM_SOURCES as readonly string[]).includes(value);
}

export function utmMediumForSource(source: MarketingUtmSource): string {
  if (source === "whatsapp") return "messaging";
  if (source === "qr") return "offline";
  return "social";
}

/**
 * Appends Marketing AI attribution to an existing Frizeo booking URL.
 * Rejects anything that is not an http(s) /booking/ URL. Does not follow redirects.
 */
export function withMarketingTracking(
  bookingUrl: string,
  input: {
    source: string;
    batchId: string;
    appOrigin?: string | null;
  },
): string | null {
  if (!isMarketingUtmSource(input.source)) return null;
  if (!UUID_RE.test(input.batchId)) return null;

  let url: URL;
  try {
    url = new URL(bookingUrl);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!url.pathname.startsWith("/booking/")) return null;
  if (url.username || url.password) return null;

  if (input.appOrigin) {
    try {
      const origin = new URL(input.appOrigin);
      if (url.origin !== origin.origin) return null;
    } catch {
      return null;
    }
  }

  url.searchParams.set("utm_source", input.source);
  url.searchParams.set("utm_medium", utmMediumForSource(input.source));
  url.searchParams.set("utm_campaign", "marketing_ai");
  url.searchParams.set("utm_content", input.batchId.toLowerCase());
  return url.toString();
}
