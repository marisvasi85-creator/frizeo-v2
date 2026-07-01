"use client";

import Link from "next/link";
import { hasAnalyticsConsent } from "@/lib/analytics/consent";
import { trackPlanSelected } from "@/lib/analytics/track";

type Props = {
  href: string;
  label: string;
  planName: string;
  planPrice?: number;
  className: string;
  trackSelection?: boolean;
};

export default function PricingPlanCta({
  href,
  label,
  planName,
  planPrice,
  className,
  trackSelection = false,
}: Props) {
  function handleClick() {
    if (!trackSelection || !hasAnalyticsConsent()) return;

    trackPlanSelected({
      planName,
      value: planPrice,
      currency: "RON",
    });
  }

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {label}
    </Link>
  );
}
