"use client";

import { useEffect } from "react";
import { hasAnalyticsConsent } from "@/lib/analytics/consent";
import { trackCheckoutSuccessOnce } from "@/lib/analytics/track";

type Props = {
  checkoutStatus?: string;
  sessionId?: string;
  planName?: string;
  planPrice?: number;
};

export default function BillingConversionTracker({
  checkoutStatus,
  sessionId,
  planName,
  planPrice,
}: Props) {
  useEffect(() => {
    if (checkoutStatus !== "success" || !hasAnalyticsConsent()) return;

    trackCheckoutSuccessOnce({
      planName: planName ?? "Paid plan",
      value: planPrice,
      currency: "RON",
      sessionId,
    });
  }, [checkoutStatus, sessionId, planName, planPrice]);

  return null;
}
