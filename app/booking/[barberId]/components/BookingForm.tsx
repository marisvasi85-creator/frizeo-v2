"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Slot = {
  start: string;
  end: string;
};

type Props = {
  barberId: string;
  serviceId: string;
  date: string;
  slot: Slot;
};

export default function BookingForm({
  barberId,
  serviceId,
  date,
  slot,
}: Props) {
  const router = useRouter(); // ✅ AICI, SUS

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/bookings/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barberId,
        serviceId,
        date,
        start_time: slot.start,
        end_time: slot.end,
        client_name: name,
        client_phone: phone,
        client_email: email || null,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Nu s-a putut crea programarea");
      setLoading(false);
      return;
    }

    // ✅ redirect DUPĂ succes
    router.push(`/booking/confirmed/${data.bookingId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nume"
        required
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Telefon"
        required
      />
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email (opțional)"
      />

      {error && <p className="text-red-500">{error}</p>}

      <button disabled={loading}>
        {loading ? "Se salvează…" : "Confirmă programarea"}
      </button>
    </form>
  );
}
