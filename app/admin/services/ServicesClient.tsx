"use client";

import { useState } from "react";

export default function ServicesClient({
  services,
}: {
  services: any[];
}) {
  const [items, setItems] = useState(services);

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Servicii</h1>

      {items.length === 0 && (
        <p className="text-white/60">Nu există servicii.</p>
      )}

      <div className="space-y-2">
        {items.map((s) => (
          <div
            key={s.id}
            className="p-3 rounded-lg bg-[#0F0F10] flex justify-between"
          >
            <span>{s.name || s.display_name}</span>
            <span className="text-white/60">
              {s.price ? `${s.price} lei` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}