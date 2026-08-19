"use client";

import { useState } from "react";
import { hasAnalyticsConsent } from "@/lib/analytics/consent";
import {
  flushPendingTrackers,
  settleTrackerRequests,
  trackInitiateCheckout,
  waitForConfiguredTrackers,
} from "@/lib/analytics/track";

type Props = {
  planId: string;
  planName: string;
  planPrice?: number;
  trialEarlyPurchase?: boolean;
};

export default function UpgradeButton({
  planId,
  planName,
  planPrice,
  trialEarlyPurchase = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    setLoading(true);
    setError(null);

    if (hasAnalyticsConsent()) {
      await waitForConfiguredTrackers();
      trackInitiateCheckout({
        planName,
        value: planPrice,
        currency: "RON",
      });
      flushPendingTrackers();
    }

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });

      const data = await res.json();

      if (data.url) {
        if (hasAnalyticsConsent()) {
          await settleTrackerRequests();
        }
        window.location.href = data.url;
        return;
      }

      if (data.success) {
        if (hasAnalyticsConsent()) {
          await settleTrackerRequests();
        }
        window.location.href = "/admin/billing?checkout=success&updated=1";
        return;
      }

      if (data.code === "BARBER_LIMIT_EXCEEDED") {
        setError(
          `${data.error || "Prea mulți frizeri activi pentru acest plan."} Mergi la Frizeri și dezactivează până la limita planului.`,
        );
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
        disabled={loading}
        className="w-full bg-frz-ink text-frz-fog py-2 rounded hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading
          ? "Se deschide Stripe…"
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
