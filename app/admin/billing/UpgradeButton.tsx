"use client";

import { useState } from "react";

type Props = {
  planId: string;
  planName: string;
  /** Trial pe același plan — afișează „Cumpără acum” */
  trialEarlyPurchase?: boolean;
};

export default function UpgradeButton({
  planId,
  planName,
  trialEarlyPurchase = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    setLoading(true);
    setError(null);

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

      if (!res.ok) {
        setError(data.error || "Plata nu a putut fi inițiată.");
        return;
      }

      if (data.success || data.planChanged) {
        window.location.href = "/admin/billing?checkout=success&plan_changed=1";
        return;
      }

      setError("Răspuns invalid de la server.");
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
        className="w-full bg-white text-black py-2 rounded hover:bg-gray-200 transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading
          ? "Se procesează…"
          : trialEarlyPurchase
            ? `Cumpără ${planName} acum`
            : `Alege ${planName}`}
      </button>

      {error && (
        <p className="text-xs text-red-400 text-center">{error}</p>
      )}
    </div>
  );
}
