"use client";

import { useState } from "react";
import type { Slot } from "./SlotPicker";

type Props = {
  barberId: string;
  serviceId: string;
  date: string;
  slot: Slot;
  onSuccess: () => void;
};

export default function BookingForm({
  barberId,
  serviceId,
  date,
  slot,
  onSuccess,
}: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // ⚠️ CHEI CORECTE PENTRU BACKEND
          barber_id: barberId,
          service_id: serviceId,
          date,
          start_time: slot.start,
          end_time: slot.end,
          client_name: name,
          client_phone: phone,
          client_email: null,
        }),
      });

      if (!res.ok) {
  const text = await res.text();
  console.error("CREATE BOOKING ERROR:", text);
  throw new Error(text || "Răspuns invalid de la server");
}


      setSuccess(true);
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Eroare la creare programare");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="p-4 border rounded text-green-700 text-sm">
        ✅ Programarea a fost creată cu succes!
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="text"
        placeholder="Nume"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        className="w-full border p-2 rounded"
      />

      <input
        type="tel"
        placeholder="Telefon"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
        className="w-full border p-2 rounded"
      />

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-black text-white py-2 rounded disabled:opacity-50"
      >
        {loading ? "Se salvează..." : "Confirmă programarea"}
      </button>
    </form>
  );
}
