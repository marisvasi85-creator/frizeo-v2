"use client";

import { useState } from "react";

export default function ManageSubscriptionButton({
  label = "Gestionează abonamentul",
}: {
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };

      if (!res.ok || !data.url) {
        setError(data.error || "Portalul nu a putut fi deschis.");
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
        className="rounded border border-white/20 bg-white/5 text-white px-4 py-2 text-sm hover:bg-white/10 transition disabled:opacity-60"
      >
        {loading ? "Se deschide…" : label}
      </button>
      <p className="text-xs text-white/45">
        Poți anula abonamentul (la finalul perioadei plătite), schimba cardul
        sau vedea facturile Stripe.
      </p>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
