"use client";

import { useEffect } from "react";
import { hasAnalyticsConsent } from "@/lib/analytics/consent";
import { trackViewContent } from "@/lib/analytics/track";

export default function SignupAnalytics() {
  useEffect(() => {
    if (!hasAnalyticsConsent()) return;
    trackViewContent("Signup");
  }, []);

  return null;
}
