"use client";

import { useState } from "react";

export default function ManageBillingButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Portalul nu a putut fi deschis.");
        return;
      }

      if (data.url) {
        window.location.href = data.url;
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
        onClick={handleClick}
        disabled={loading}
        className="rounded border border-white/20 px-4 py-2 text-sm text-white/90 hover:bg-white/5 transition disabled:opacity-60"
      >
        {loading ? "Se deschide portalul…" : "Gestionează facturarea"}
      </button>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
