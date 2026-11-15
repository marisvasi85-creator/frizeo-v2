"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DpaAcceptanceForm({
  version,
  hash,
}: {
  version: string;
  hash: string;
}) {
  const router = useRouter();
  const [legalName, setLegalName] = useState("");
  const [cui, setCui] = useState("");
  const [address, setAddress] = useState("");
  const [representativeName, setRepresentativeName] = useState("");
  const [representativeConfirmed, setRepresentativeConfirmed] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const ready =
    representativeConfirmed &&
    accepted &&
    !pending &&
    legalName.trim().length >= 2 &&
    cui.trim().length >= 2 &&
    address.trim().length >= 5 &&
    representativeName.trim().length >= 2;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setPending(true);
    setMessage(null);
    const response = await fetch("/api/salon/dpa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accepted: true,
        representativeConfirmed: true,
        version,
        hash,
        legalName,
        cui,
        address,
        representativeName,
      }),
    });
    const body = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok || body?.accepted !== true) {
      setMessage("Acceptarea nu a fost înregistrată. Verifică datele și încearcă din nou.");
      return;
    }
    setMessage("Acceptarea a fost înregistrată.");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm">
        Denumirea juridică a salonului
        <input
          value={legalName}
          onChange={(event) => setLegalName(event.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-base"
          autoComplete="organization"
        />
      </label>
      <label className="block text-sm">
        CUI sau cod de înregistrare
        <input
          value={cui}
          onChange={(event) => setCui(event.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-base"
        />
      </label>
      <label className="block text-sm">
        Adresa salonului
        <input
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-base"
          autoComplete="street-address"
        />
      </label>
      <label className="block text-sm">
        Numele reprezentantului
        <input
          value={representativeName}
          onChange={(event) => setRepresentativeName(event.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-base"
          autoComplete="name"
        />
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={representativeConfirmed}
          onChange={(event) => setRepresentativeConfirmed(event.target.checked)}
          className="mt-1 h-4 w-4"
        />
        <span>Confirm că sunt reprezentantul autorizat al salonului.</span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          className="mt-1 h-4 w-4"
        />
        <span>
          Accept acordul de prelucrare, versiunea {version}, cu hash-ul afișat.
        </span>
      </label>
      <button
        type="submit"
        disabled={!ready}
        className="rounded-lg bg-frz-ink px-4 py-2 text-sm text-white disabled:opacity-40"
      >
        Acceptă electronic
      </button>
      {message ? <p className="text-sm">{message}</p> : null}
    </form>
  );
}
