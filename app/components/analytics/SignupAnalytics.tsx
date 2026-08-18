"use client";

import { useEffect, useRef } from "react";
import { hasAnalyticsConsent, onConsentChange } from "@/lib/analytics/consent";
import { flushPendingTrackers, trackViewContent } from "@/lib/analytics/track";

export default function SignupAnalytics() {
  const sent = useRef(false);

  useEffect(() => {
    function maybeTrack() {
      if (sent.current || !hasAnalyticsConsent()) return;
      sent.current = true;
      trackViewContent("Signup");
      flushPendingTrackers();
    }

    maybeTrack();
    return onConsentChange(maybeTrack);
  }, []);

  return null;
}
