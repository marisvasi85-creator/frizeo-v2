"use client";

import { useState } from "react";
import { hasAnalyticsConsent } from "@/lib/analytics/consent";
import { trackInitiateCheckout } from "@/lib/analytics/track";

type Props = {
  planId: string;
  planName: string;
  planPrice?: number;
  trialEarlyPurchase?: boolean;
  billingProfileComplete?: boolean;
};

export default function UpgradeButton({
  planId,
  planName,
  planPrice,
  trialEarlyPurchase = false,
  billingProfileComplete = true,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    if (!billingProfileComplete) {
      setError("Completează datele de facturare mai sus înainte de plată.");
      document.getElementById("billing-profile-form")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }

    setLoading(true);
    setError(null);

    if (hasAnalyticsConsent()) {
      trackInitiateCheckout({
        planName,
        value: planPrice,
        currency: "RON",
      });
    }

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      if (data.success) {
        window.location.href = "/admin/billing?checkout=success&updated=1";
        return;
      }

      setError(data.error || "Plata nu a putut fi inițiată.");
    } catch {
      setError("Eroare de rețea. Încearcă din nou.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleUpgrade}
        disabled={loading || !billingProfileComplete}
        className="w-full bg-white text-black py-2 rounded hover:bg-gray-200 transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading
          ? "Se deschide Stripe…"
          : !billingProfileComplete
            ? "Completează date facturare"
            : trialEarlyPurchase
              ? `Cumpără ${planName}`
              : `Alege ${planName}`}
      </button>

      {error && (
        <p className="text-xs text-red-400 text-center">{error}</p>
      )}
    </div>
  );
}
