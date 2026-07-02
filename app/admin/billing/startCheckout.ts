import { hasAnalyticsConsent } from "@/lib/analytics/consent";
import { trackInitiateCheckout } from "@/lib/analytics/track";

export async function startStripeCheckout(params: {
  planId: string;
  planName: string;
  planPrice?: number;
}): Promise<
  | { ok: true; url: string }
  | { ok: true; success: true }
  | { ok: false; error: string; code?: string }
> {
  if (hasAnalyticsConsent()) {
    trackInitiateCheckout({
      planName: params.planName,
      value: params.planPrice,
      currency: "RON",
    });
  }

  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planId: params.planId }),
  });

  const data = await res.json();

  if (data.url) {
    return { ok: true, url: data.url };
  }

  if (data.success) {
    return { ok: true, success: true };
  }

  return {
    ok: false,
    error: data.error || "Plata nu a putut fi inițiată.",
    code: data.code,
  };
}
