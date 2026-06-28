"use client";

import { useState } from "react";

type PaymentMethod = "card" | "bank_transfer";

type Props = {
  planId: string;
  planName: string;
  allowBankTransfer?: boolean;
  /** Trial pe același plan — afișează „Cumpără acum” */
  trialEarlyPurchase?: boolean;
};

export default function UpgradeButton({
  planId,
  planName,
  allowBankTransfer = true,
  trialEarlyPurchase = false,
}: Props) {
  const [loading, setLoading] = useState<PaymentMethod | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade(paymentMethod: PaymentMethod) {
    setLoading(paymentMethod);
    setError(null);

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, paymentMethod }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Plata nu a putut fi inițiată.");
        return;
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      if (data.success || data.planChanged) {
        window.location.href = "/admin/billing?checkout=success";
        return;
      }

      setError("Răspuns invalid de la server.");
    } catch {
      setError("Eroare de rețea. Încearcă din nou.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => handleUpgrade("card")}
        disabled={loading !== null}
        className="w-full bg-white text-black py-2 rounded hover:bg-gray-200 transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading === "card"
          ? "Se deschide Stripe…"
          : trialEarlyPurchase
            ? `Cumpără ${planName} acum`
            : `Alege ${planName}`}
      </button>

      {allowBankTransfer && (
        <button
          type="button"
          onClick={() => handleUpgrade("bank_transfer")}
          disabled={loading !== null}
          className="w-full border border-white/20 text-white py-2 rounded hover:bg-white/5 transition disabled:opacity-60 disabled:cursor-not-allowed text-sm"
        >
          {loading === "bank_transfer"
            ? "Se generează factura…"
            : "Transfer bancar"}
        </button>
      )}

      {error && (
        <p className="text-xs text-red-400 text-center">{error}</p>
      )}
    </div>
  );
}
