"use client";

import { useEffect, useState } from "react";

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number | null;
  active: boolean;
};

export default function AdminServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(30);
  const [price, setPrice] = useState<number | "">("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadServices();
  }, []);

  async function loadServices() {
    const res = await fetch("/api/admin/services");
    const data = await res.json();
    setServices(data.services || []);
  }

  async function addService() {
    setMessage("");

    const res = await fetch("/api/admin/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        duration_minutes: duration,
        price: price === "" ? null : price,
        active: true,
      }),
    });

    if (res.ok) {
      setName("");
      setDuration(30);
      setPrice("");
      loadServices();
      setMessage("✅ Serviciu adăugat");
    } else {
      setMessage("❌ Eroare");
    }
  }

  async function toggleActive(service: Service) {
    await fetch("/api/admin/services", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...service,
        active: !service.active,
      }),
    });

    loadServices();
  }

  return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      <h1>✂️ Servicii</h1>

      <h3>Adaugă serviciu</h3>

      <input
        placeholder="Nume serviciu"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <input
        type="number"
        placeholder="Durată (minute)"
        value={duration}
        onChange={(e) => setDuration(Number(e.target.value))}
      />

      <input
        type="number"
        placeholder="Preț (opțional)"
        value={price}
        onChange={(e) =>
          setPrice(e.target.value === "" ? "" : Number(e.target.value))
        }
      />

      <button onClick={addService}>Adaugă</button>

      {message && <p>{message}</p>}

      <hr />

      <h3>Servicii existente</h3>

      {services.map((s) => (
        <div
          key={s.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: 8,
            borderBottom: "1px solid #eee",
          }}
        >
          <div>
            <strong>{s.name}</strong> – {s.duration_minutes} min
            {s.price !== null && ` – ${s.price} lei`}
          </div>

          <button onClick={() => toggleActive(s)}>
            {s.active ? "Dezactivează" : "Activează"}
          </button>
        </div>
      ))}
    </div>
  );
}
