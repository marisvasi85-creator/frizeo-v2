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
        className="rounded border border-frz-line bg-frz-card text-frz-ink px-4 py-2 text-sm hover:bg-frz-fog transition disabled:opacity-60"
      >
        {loading ? "Se deschide…" : label}
      </button>
      <p className="text-xs text-frz-ink/45">
        Poți anula abonamentul (la finalul perioadei plătite), schimba cardul
        sau vedea facturile Stripe.
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
