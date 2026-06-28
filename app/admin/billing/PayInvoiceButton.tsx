"use client";

import { useState } from "react";

export default function PayInvoiceButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/billing/pay-invoice", { method: "POST" });
      const data = await res.json();

      if (!res.ok || !data.url) {
        setError(data.error || "Plata nu a putut fi deschisă.");
        return;
      }

      window.location.href = data.url;
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
        onClick={handleClick}
        disabled={loading}
        className="rounded bg-white text-black px-4 py-2 text-sm hover:bg-gray-200 transition disabled:opacity-60"
      >
        {loading ? "Se deschide…" : "Finalizează plata"}
      </button>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
