"use client";

import { useState } from "react";

export default function UnsubscribeClient({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [already, setAlready] = useState(false);
  const [masked, setMasked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Link invalid.");
        return;
      }
      setAlready(Boolean(data.alreadyUnsubscribed));
      setMasked(data.emailMasked || null);
      setDone(true);
    } catch {
      setError("Eroare de rețea. Încearcă din nou.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-100 space-y-2">
        <p className="font-medium">
          {already
            ? "Erai deja dezabonat."
            : "Te-ai dezabonat cu succes."}
        </p>
        {masked && <p className="text-emerald-100/80">Adresa: {masked}</p>}
        <p className="text-emerald-100/70">
          Nu vei mai primi campanii de marketing Frizeo pe această adresă.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={confirm}
        disabled={loading || !token}
        className="w-full rounded-lg bg-frz-ink text-frz-ink-contrast py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Se procesează…" : "Confirmă dezabonarea"}
      </button>
    </div>
  );
}
