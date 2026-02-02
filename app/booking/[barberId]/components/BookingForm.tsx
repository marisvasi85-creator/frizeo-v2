"use client";

import { useState } from "react";

type Slot = {
  start: string;
  end: string;
};

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
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (loading) return;
    setLoading(true);
    setError(null);
    setSuccess(false);

    const res = await fetch("/api/bookings/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
  barberId,
  serviceId,
  date,
  start_time: slot.start,
  end_time: slot.end,
  client_name: name.trim(),
  client_phone: phone.trim(),
  client_email: email.trim() || null,
}),

    });

    const data = await res.json();

    if (!res.ok) {
  if (res.status === 409) {
    setError("⛔ Slotul a fost deja rezervat. Alege altul.");
  } else {
    setError(data.error || "Nu s-a putut crea programarea");
  }
  setLoading(false);
  return;
}


    setSuccess(true);
    setLoading(false);
    onSuccess();
  }
if (success) {
  return (
    <p className="text-green-600 text-center">
      ✅ Programarea a fost creată cu succes!
    </p>
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

      <input
        type="email"
        placeholder="Email (opțional)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full border p-2 rounded"
      />

      {error && <p className="text-red-500 text-sm">{error}</p>}
      {success && (
        <p className="text-green-600 text-sm">
          ✅ Programarea a fost creată cu succes!
        </p>
      )}

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
