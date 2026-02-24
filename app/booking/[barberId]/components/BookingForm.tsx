"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Slot } from "@/app/components/SlotPicker";

type Props = {
  barberId: string;
  barberServiceId: string;
  date: string;
  slot: Slot;
};

export default function BookingForm({
  barberId,
  barberServiceId,
  date,
  slot,
}: Props) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (loading) return;

    if (!name || !phone) {
      setError("Completează nume și telefon");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barberId,
          serviceId: barberServiceId,
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
        setError(
          data.error ||
            "Slot indisponibil. Te rugăm alege alt interval."
        );
        setLoading(false);
        return;
      }

      router.push(`/booking/confirmed/${data.bookingId}`);
    } catch {
      setError("Eroare server. Încearcă din nou.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border p-4 rounded">

      <h3 className="font-semibold">Completează datele</h3>

      <input
        type="text"
        placeholder="Nume"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        className="border p-2 w-full"
      />

      <input
        type="text"
        placeholder="Telefon"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
        className="border p-2 w-full"
      />

      <input
        type="email"
        placeholder="Email (opțional)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border p-2 w-full"
      />

      {error && (
        <p className="text-red-500 text-sm">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="bg-black text-white px-4 py-2 rounded w-full disabled:opacity-50"
      >
        {loading ? "Se procesează…" : "Confirmă programarea"}
      </button>
    </form>
  );
}