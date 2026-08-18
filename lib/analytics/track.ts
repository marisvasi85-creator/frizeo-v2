import { getAnalyticsConfig } from "./config";

type EventParams = Record<string, unknown>;

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    ttq?: {
      page?: () => void;
      track?: (event: string, params?: EventParams) => void;
    };
    dataLayer?: Record<string, unknown>[];
    __frizeoMetaReady?: boolean;
    __frizeoGaReady?: boolean;
    __frizeoTikTokReady?: boolean;
  }
}

type PendingMeta = { event: string; params?: EventParams };
type PendingGa = { event: string; params?: EventParams };
type PendingTikTok =
  | { kind: "page" }
  | { kind: "track"; event: string; params?: EventParams };
type PendingDataLayer = { event: string; params?: EventParams };

const pendingMeta: PendingMeta[] = [];
const pendingGa: PendingGa[] = [];
const pendingTikTok: PendingTikTok[] = [];
const pendingDataLayer: PendingDataLayer[] = [];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pushDataLayer(event: string, params?: EventParams) {
  if (typeof window === "undefined") return;
  if (!window.dataLayer) {
    pendingDataLayer.push({ event, params });
    return;
  }
  window.dataLayer.push({ event, ...params });
}

function trackMeta(event: string, params?: EventParams) {
  if (typeof window === "undefined") return;
  if (!window.fbq) {
    pendingMeta.push({ event, params });
    return;
  }
  window.fbq("track", event, params);
}

function trackGa(event: string, params?: EventParams) {
  if (typeof window === "undefined") return;
  if (!window.gtag) {
    pendingGa.push({ event, params });
    return;
  }
  window.gtag("event", event, params);
}

function trackTikTokPage() {
  if (typeof window === "undefined") return;
  if (!window.ttq?.page) {
    pendingTikTok.push({ kind: "page" });
    return;
  }
  window.ttq.page();
}

function trackTikTok(event: string, params?: EventParams) {
  if (typeof window === "undefined") return;
  if (!window.ttq?.track) {
    pendingTikTok.push({ kind: "track", event, params });
    return;
  }
  window.ttq.track(event, params);
}

export function flushPendingTrackers() {
  if (typeof window === "undefined") return;

  if (window.fbq && pendingMeta.length > 0) {
    const queued = pendingMeta.splice(0, pendingMeta.length);
    for (const item of queued) {
      window.fbq("track", item.event, item.params);
    }
  }

  if (window.gtag && pendingGa.length > 0) {
    const queued = pendingGa.splice(0, pendingGa.length);
    for (const item of queued) {
      window.gtag("event", item.event, item.params);
    }
  }

  if (window.ttq && pendingTikTok.length > 0) {
    const queued = pendingTikTok.splice(0, pendingTikTok.length);
    for (const item of queued) {
      if (item.kind === "page") {
        window.ttq.page?.();
      } else {
        window.ttq.track?.(item.event, item.params);
      }
    }
  }

  if (window.dataLayer && pendingDataLayer.length > 0) {
    const queued = pendingDataLayer.splice(0, pendingDataLayer.length);
    for (const item of queued) {
      window.dataLayer.push({ event: item.event, ...item.params });
    }
  }
}

function configuredTrackersReady(): boolean {
  const config = getAnalyticsConfig();
  if (config.gtmId) return Array.isArray(window.dataLayer);

  const metaOk = !config.metaPixelId || Boolean(window.fbq);
  const gaOk = !config.gaMeasurementId || Boolean(window.gtag);
  const tikTokOk = !config.tiktokPixelId || Boolean(window.ttq?.track);
  return metaOk && gaOk && tikTokOk;
}

export async function waitForConfiguredTrackers(timeoutMs = 4000) {
  if (typeof window === "undefined") return;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (configuredTrackersReady()) {
      flushPendingTrackers();
      return;
    }
    await sleep(50);
  }
  flushPendingTrackers();
}

export async function settleTrackerRequests(delayMs = 400) {
  await sleep(delayMs);
}

function tikTokContents(contentName: string) {
  return [
    {
      content_id: contentName,
      content_type: "product",
      content_name: contentName,
    },
  ];
}

export function initGoogleAnalytics(measurementId: string) {
  if (window.__frizeoGaReady) return;

  window.dataLayer = window.dataLayer || [];

  if (!window.gtag) {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer?.push(args as unknown as Record<string, unknown>);
    };
  }

  window.gtag("js", new Date());
  window.gtag("config", measurementId, { send_page_view: false });
  window.__frizeoGaReady = true;
}

export function markAnalyticsReady() {
  const config = getAnalyticsConfig();

  if (config.gtmId) {
    pushDataLayer("analytics_consent_granted");
    flushPendingTrackers();
    return;
  }

  if (config.metaPixelId) {
    window.__frizeoMetaReady = true;
  }

  if (config.gaMeasurementId) {
    initGoogleAnalytics(config.gaMeasurementId);
  }

  if (config.tiktokPixelId) {
    window.__frizeoTikTokReady = true;
  }

  flushPendingTrackers();
}

export function trackPageView(pathname: string, search = "") {
  const config = getAnalyticsConfig();
  if (!config.isConfigured) return;

  const pagePath = search ? `${pathname}?${search}` : pathname;

  if (config.gtmId) {
    pushDataLayer("page_view", { page_path: pagePath });
    return;
  }

  trackMeta("PageView");
  trackGa("page_view", { page_path: pagePath });
  trackTikTokPage();
}

export function trackViewContent(contentName: string) {
  const params = { content_name: contentName };

  trackMeta("ViewContent", params);
  trackGa("view_item", { item_name: contentName });
  trackTikTok("ViewContent", { contents: tikTokContents(contentName) });
  pushDataLayer("view_content", params);
}

export function trackCompleteRegistration() {
  trackMeta("CompleteRegistration");
  trackGa("sign_up", { method: "email" });
  trackTikTok("CompleteRegistration");
  pushDataLayer("complete_registration");
}

export function trackStartTrial() {
  trackMeta("StartTrial", { value: 0, currency: "RON", predicted_ltv: 0 });
  trackGa("start_trial");
  trackTikTok("Subscribe", { value: 0, currency: "RON" });
  pushDataLayer("start_trial");
}

export function trackPlanSelected(params: {
  planName: string;
  value?: number;
  currency?: string;
}) {
  const payload = {
    content_name: params.planName,
    value: params.value,
    currency: params.currency ?? "RON",
  };

  trackMeta("AddToCart", payload);
  trackGa("add_to_cart", {
    currency: payload.currency,
    value: payload.value,
    items: [{ item_name: params.planName }],
  });
  trackTikTok("AddToCart", {
    contents: tikTokContents(params.planName),
    value: payload.value,
    currency: payload.currency,
  });
  pushDataLayer("add_to_cart", payload);
}

export function trackInitiateCheckout(params: {
  planName: string;
  value?: number;
  currency?: string;
}) {
  const payload = {
    content_name: params.planName,
    value: params.value,
    currency: params.currency ?? "RON",
  };

  trackMeta("InitiateCheckout", payload);
  trackGa("begin_checkout", {
    currency: payload.currency,
    value: payload.value,
    items: [{ item_name: params.planName }],
  });
  trackTikTok("InitiateCheckout", {
    contents: tikTokContents(params.planName),
    value: payload.value,
    currency: payload.currency,
  });
  pushDataLayer("initiate_checkout", payload);
}

export function trackSubscribe(params: {
  planName: string;
  value?: number;
  currency?: string;
}) {
  const payload = {
    content_name: params.planName,
    value: params.value,
    currency: params.currency ?? "RON",
  };

  trackMeta("Subscribe", payload);
  trackGa("purchase", {
    transaction_id: `sub_${Date.now()}`,
    currency: payload.currency,
    value: payload.value,
    items: [{ item_name: params.planName }],
  });
  trackTikTok("CompletePayment", {
    contents: tikTokContents(params.planName),
    value: payload.value,
    currency: payload.currency,
  });
  trackTikTok("PlaceAnOrder", {
    contents: tikTokContents(params.planName),
    value: payload.value,
    currency: payload.currency,
  });
  pushDataLayer("subscribe", payload);
}

function anyConfiguredTrackerPresent(): boolean {
  const config = getAnalyticsConfig();
  if (config.gtmId) return Array.isArray(window.dataLayer);
  return Boolean(
    (config.metaPixelId && window.fbq) ||
      (config.gaMeasurementId && window.gtag) ||
      (config.tiktokPixelId && window.ttq),
  );
}

export async function trackRegistrationOnce() {
  const key = "frizeo_tracked_registration";
  if (sessionStorage.getItem(key)) return;

  await waitForConfiguredTrackers();
  if (!anyConfiguredTrackerPresent()) return;

  trackCompleteRegistration();
  trackStartTrial();
  flushPendingTrackers();
  sessionStorage.setItem(key, "1");
  await settleTrackerRequests();
}

export async function trackCheckoutSuccessOnce(params: {
  planName: string;
  value?: number;
  currency?: string;
  sessionId?: string;
}) {
  const key = params.sessionId
    ? `frizeo_tracked_checkout_${params.sessionId}`
    : "frizeo_tracked_checkout_success";

  if (sessionStorage.getItem(key)) return;

  await waitForConfiguredTrackers();
  if (!anyConfiguredTrackerPresent()) return;

  trackSubscribe(params);
  flushPendingTrackers();
  sessionStorage.setItem(key, "1");
  await settleTrackerRequests();
}
