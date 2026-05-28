"use client";

import { useEffect, useState } from "react";

export default function BreakSettings({ barberId }: any) {
  const [enabled, setEnabled] = useState(false);
  const [minutes, setMinutes] = useState(5);

  useEffect(() => {
    fetch(`/api/barber-settings?barberId=${barberId}`)
      .then((r) => r.json())
      .then((data) => {
        setEnabled(data.break_between_enabled || false);
        setMinutes(data.break_between_minutes || 0);
      });
  }, []);

  async function save() {
    await fetch("/api/barber-settings/update", {
  method: "POST",
  body: JSON.stringify({
    barber_id: barberId,
    break_between_enabled: enabled,
    break_between_minutes: minutes,
  }),
});

    alert("Salvat");
  }

  return (
    <div className="bg-zinc-900 p-4 rounded-xl space-y-4">
      <h2 className="text-white font-semibold">
        Pauză între programări
      </h2>

      <label className="flex items-center gap-2 text-white">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Activ
      </label>

      {enabled && (
        <input
          type="number"
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          className="w-full bg-zinc-800 p-2 rounded text-white"
          placeholder="Minute pauză"
        />
      )}

      <button
        onClick={save}
        className="bg-white text-black px-4 py-2 rounded"
      >
        Salvează
      </button>
    </div>
  );
}