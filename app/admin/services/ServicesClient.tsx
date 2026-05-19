"use client";

import { useEffect, useState } from "react";

export default function ServicesClient() {
  const [services, setServices] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then(setServices);
  }, []);

  async function updateService(id: string, field: string, value: any) {
    await fetch("/api/services", {
      method: "PUT",
      body: JSON.stringify({ id, [field]: value }),
    });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Servicii</h2>

      {services.map((s) => (
        <div key={s.id} className="border p-4 rounded-xl space-y-2">
          <input
            defaultValue={s.display_name}
            onBlur={(e) => updateService(s.id, "display_name", e.target.value)}
          />

          <input
            type="number"
            defaultValue={s.duration}
            onBlur={(e) => updateService(s.id, "duration", e.target.value)}
          />

          <input
            type="number"
            defaultValue={s.price}
            onBlur={(e) => updateService(s.id, "price", e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}