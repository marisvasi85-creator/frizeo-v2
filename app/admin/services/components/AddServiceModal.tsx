"use client";

import { useState } from "react";

const inputClass =
  "w-full bg-[#0F0F10] border border-white/10 rounded-lg px-4 py-3 text-white";

export default function AddServiceModal({
  barberId,
  service,
  onClose,
  onCreated,
}: any) {
  const [name, setName] = useState(service?.display_name || "");
  const [price, setPrice] = useState(service?.price ?? "");
  const [duration, setDuration] = useState<string>(
    service?.duration?.toString() || ""
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!name || !duration) {
      alert("Completează nume și durată");
      return;
    }

    setLoading(true);

    const url = service ? "/api/services/update" : "/api/services/create";

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: service?.id,
        barber_id: barberId,
        name: name.toLowerCase().replace(/\s+/g, "_"),
        display_name: name,
        price: price ? Number(price) : null,
        duration: Number(duration),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Eroare");
      setLoading(false);
      return;
    }

    onCreated(data);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#161618] border border-white/10 p-6 rounded-xl w-full max-w-sm space-y-4">
        <h2 className="text-lg font-semibold">
          {service ? "Editează serviciu" : "Adaugă serviciu"}
        </h2>

        <input
          placeholder="Nume serviciu"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />

        <select
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className={inputClass}
        >
          <option value="">Alege durata</option>
          <option value="15">15 min</option>
          <option value="30">30 min</option>
          <option value="45">45 min</option>
          <option value="60">60 min</option>
          <option value="75">75 min</option>
          <option value="90">90 min</option>
          <option value="120">120 min</option>
        </select>

        <input
          placeholder="Preț (opțional)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className={inputClass}
        />

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 bg-white/10 py-3 rounded-lg text-white"
          >
            Anulează
          </button>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-white text-black py-3 rounded-lg font-medium disabled:opacity-50"
          >
            {loading ? "Se salvează..." : "Salvează"}
          </button>
        </div>
      </div>
    </div>
  );
}
