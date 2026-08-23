import { hasAnalyticsConsent } from "./consent";

export const FIRST_PARTY_EVENT_NAMES = [
  "page_view",
  "signup_view",
  "pricing_view",
  "lead",
  "plan_selected",
  "checkout_started",
] as const;

export type FirstPartyEventName = (typeof FIRST_PARTY_EVENT_NAMES)[number];

export type FirstPartyAnalyticsContext = {
  visitorId: string;
  sessionId: string;
  source: string;
  medium: string | null;
  campaign: string | null;
  landingPath: string;
  referrerHost: string | null;
};

type StoredAttribution = Omit<
  FirstPartyAnalyticsContext,
  "visitorId" | "sessionId"
> & {
  content: string | null;
  term: string | null;
};

const VISITOR_KEY = "frizeo_analytics_visitor_id";
const SESSION_KEY = "frizeo_analytics_session_id";
const ATTRIBUTION_KEY = "frizeo_analytics_attribution";
const ONCE_PREFIX = "frizeo_analytics_once";

const ACQUISITION_PATHS = [
  "/pricing",
  "/signup",
  "/contact",
  "/faq",
  "/frizerii",
  "/ghid",
  "/marketing-ai",
  "/programari-online-frizerie",
  "/frizeo-vs-programari-pe-telefon",
];

function newId(): string {
  return crypto.randomUUID();
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function getOrCreateId(storage: Storage, key: string): string {
  const existing = storage.getItem(key);
  if (isUuid(existing)) return existing;
  const id = newId();
  storage.setItem(key, id);
  return id;
}

function clean(value: string | null, maxLength: number): string | null {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function referrerHost(): string | null {
  if (!document.referrer) return null;
  try {
    return clean(new URL(document.referrer).hostname.toLowerCase(), 255);
  } catch {
    return null;
  }
}

function sourceFromReferrer(host: string | null): {
  source: string;
  medium: string | null;
} {
  if (!host || host.endsWith("frizeo.ro") || host === "localhost") {
    return { source: "direct", medium: null };
  }
  if (host.includes("google.")) return { source: "google", medium: "organic" };
  if (host.includes("facebook.") || host.includes("instagram.")) {
    return { source: "meta", medium: "social" };
  }
  if (host.includes("tiktok.")) return { source: "tiktok", medium: "social" };
  return { source: host.slice(0, 120), medium: "referral" };
}

function currentAttribution(): StoredAttribution {
  const params = new URLSearchParams(window.location.search);
  const host = referrerHost();
  const utmSource = clean(params.get("utm_source"), 120);
  const utmMedium = clean(params.get("utm_medium"), 120);
  const campaign = clean(params.get("utm_campaign"), 180);
  const content = clean(params.get("utm_content"), 180);
  const term = clean(params.get("utm_term"), 180);
  const clickSource = params.has("fbclid")
    ? { source: "meta", medium: "paid_social" }
    : params.has("ttclid")
      ? { source: "tiktok", medium: "paid_social" }
      : params.has("gclid")
        ? { source: "google", medium: "paid_search" }
        : null;

  const hasExplicitAttribution = Boolean(
    utmSource || utmMedium || campaign || content || term || clickSource,
  );

  if (!hasExplicitAttribution) {
    const stored = sessionStorage.getItem(ATTRIBUTION_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as StoredAttribution;
        if (parsed?.source && parsed?.landingPath) return parsed;
      } catch {
        sessionStorage.removeItem(ATTRIBUTION_KEY);
      }
    }
  }

  const inferred = clickSource ?? sourceFromReferrer(host);
  const attribution: StoredAttribution = {
    source: (utmSource || inferred.source).slice(0, 120),
    medium: utmMedium || inferred.medium,
    campaign,
    content,
    term,
    landingPath: window.location.pathname.slice(0, 500),
    referrerHost: host,
  };
  sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
  return attribution;
}

export function isAcquisitionPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return ACQUISITION_PATHS.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function getFirstPartyAnalyticsContext(): FirstPartyAnalyticsContext | null {
  if (typeof window === "undefined" || !hasAnalyticsConsent()) return null;
  const attribution = currentAttribution();
  return {
    visitorId: getOrCreateId(localStorage, VISITOR_KEY),
    sessionId: getOrCreateId(sessionStorage, SESSION_KEY),
    source: attribution.source,
    medium: attribution.medium,
    campaign: attribution.campaign,
    landingPath: attribution.landingPath,
    referrerHost: attribution.referrerHost,
  };
}

export async function trackFirstPartyEvent(
  eventName: FirstPartyEventName,
  properties: Record<string, string | number | boolean | null> = {},
): Promise<boolean> {
  const context = getFirstPartyAnalyticsContext();
  if (!context) return false;

  const attribution = currentAttribution();
  try {
    const response = await fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify({
        eventId: newId(),
        eventName,
        visitorId: context.visitorId,
        sessionId: context.sessionId,
        path: window.location.pathname,
        pageTitle: document.title,
        referrerHost: attribution.referrerHost,
        source: attribution.source,
        medium: attribution.medium,
        campaign: attribution.campaign,
        content: attribution.content,
        term: attribution.term,
        properties,
        consentGranted: true,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function trackFirstPartyEventOnce(
  eventName: FirstPartyEventName,
  onceKey: string,
  properties: Record<string, string | number | boolean | null> = {},
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const key = `${ONCE_PREFIX}:${eventName}:${onceKey}`;
  if (sessionStorage.getItem(key)) return false;
  const recorded = await trackFirstPartyEvent(eventName, properties);
  if (recorded) sessionStorage.setItem(key, "1");
  return recorded;
}
