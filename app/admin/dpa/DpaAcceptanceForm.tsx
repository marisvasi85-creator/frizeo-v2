"use client";

import { useState } from "react";

export default function DpaAcceptanceForm({
  version,
  hash,
}: {
  version: string;
  hash: string;
}) {
  const [checked, setChecked] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!checked || pending) return;
    setPending(true);
    setMessage(null);
    const response = await fetch("/api/salon/dpa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accepted: true, version, hash }),
    });
    const body = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok || body?.accepted !== true) {
      setMessage("Acceptarea nu a fost înregistrată.");
      return;
    }
    setMessage(
      body.acceptedAt
        ? `Înregistrată la ${body.acceptedAt}. Proiectul rămâne nesemnat.`
        : "Înregistrată. Proiectul rămâne nesemnat.",
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
          className="mt-1 h-4 w-4"
        />
        <span>
          Confirm că am citit versiunea {version} și hash-ul afișat. Bifarea nu
          este făcută dinainte.
        </span>
      </label>
      <button
        type="submit"
        disabled={!checked || pending}
        className="rounded-lg bg-frz-ink px-4 py-2 text-sm text-white disabled:opacity-40"
      >
        Înregistrează acceptarea
      </button>
      {message ? <p className="text-sm">{message}</p> : null}
    </form>
  );
}
