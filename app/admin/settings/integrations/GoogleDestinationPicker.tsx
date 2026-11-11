"use client";

import { useState } from "react";
import AdminButton from "@/app/admin/components/AdminButton";

type Location = { id: string; title: string; accountName: string };

const ERRORS: Record<string, string> = {
  timeout: "Google nu a răspuns la timp. Nu s-a salvat nicio locație.",
  needs_reconnect: "Conexiunea Google Business trebuie refăcută manual.",
  empty: "Alege cel puțin o locație.",
  unknown_destination: "Selecția nu corespunde locațiilor întoarse de Google.",
  forbidden: "Doar owner sau manager pot alege locațiile.",
  capability_off: "Integrarea Google Business este oprită pentru acest salon.",
  save_failed: "Locațiile nu au putut fi salvate.",
};

export default function GoogleDestinationPicker() {
  const [locations, setLocations] = useState<Location[] | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function loadLocations() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/integrations/google-business/destinations", { method: "POST" });
      const payload = await response.json().catch(() => null) as { error?: string; locations?: Location[] } | null;
      if (!response.ok || !payload?.locations) {
        setLocations([]);
        setMessage(ERRORS[payload?.error ?? ""] ?? "Locațiile nu au putut fi încărcate.");
        return;
      }
      setLocations(payload.locations);
      setSelected(Object.fromEntries(payload.locations.map((location) => [location.id, true])));
      if (payload.locations.length === 0) {
        setMessage("Google nu a întors nicio locație pentru acest cont.");
      }
    } finally {
      setPending(false);
    }
  }

  async function save() {
    const destinationIds = Object.entries(selected).flatMap(([id, on]) => on ? [id] : []);
    if (destinationIds.length === 0) {
      setMessage(ERRORS.empty);
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/integrations/google-business/destinations/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinationIds }),
      });
      if (response.redirected) {
        window.location.assign(response.url);
        return;
      }
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        setMessage(ERRORS[payload?.error ?? ""] ?? "Locațiile nu au putut fi salvate.");
        return;
      }
      window.location.assign("/admin/settings/integrations?google=saved");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-3">
      <AdminButton type="button" variant="secondary" disabled={pending} onClick={loadLocations}>
        Încarcă locațiile
      </AdminButton>
      {locations && locations.length > 0 && (
        <fieldset className="grid gap-2">
          <legend className="text-sm text-frz-ink">Locații Google Business</legend>
          {locations.map((location) => (
            <label key={location.id} className="flex items-center gap-2 text-sm text-frz-ink">
              <input
                type="checkbox"
                checked={Boolean(selected[location.id])}
                onChange={() => setSelected((current) => ({ ...current, [location.id]: !current[location.id] }))}
              />
              {location.title}
            </label>
          ))}
          <AdminButton type="button" disabled={pending} onClick={save}>
            Salvează locațiile
          </AdminButton>
        </fieldset>
      )}
      {message && <p className="text-sm text-frz-ink">{message}</p>}
    </div>
  );
}
