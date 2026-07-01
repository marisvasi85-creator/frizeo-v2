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

function pushDataLayer(event: string, params?: EventParams) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
}

function trackMeta(event: string, params?: EventParams) {
  if (!window.fbq) return;
  window.fbq("track", event, params);
}

function trackGa(event: string, params?: EventParams) {
  if (!window.gtag) return;
  window.gtag("event", event, params);
}

function trackTikTokPage() {
  window.ttq?.page?.();
}

function trackTikTok(event: string, params?: EventParams) {
  window.ttq?.track?.(event, params);
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
  pushDataLayer("start_trial");
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
  pushDataLayer("subscribe", payload);
}

export function trackRegistrationOnce() {
  const key = "frizeo_tracked_registration";
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, "1");
  trackCompleteRegistration();
  trackStartTrial();
}

export function trackCheckoutSuccessOnce(params: {
  planName: string;
  value?: number;
  currency?: string;
  sessionId?: string;
}) {
  const key = params.sessionId
    ? `frizeo_tracked_checkout_${params.sessionId}`
    : "frizeo_tracked_checkout_success";

  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, "1");
  trackSubscribe(params);
}
