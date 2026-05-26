"use client";

import { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  slot: string;
  barberId: string;
  serviceId: string;
  onCreated: () => void;
};

export default function CreateBookingModal({
  open,
  onClose,
  slot,
  barberId,
  serviceId,
  onCreated,
}: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  async function createBooking() {
    if (!serviceId || !name || !phone) {
      alert("Completează toate câmpurile");
      return;
    }

    setLoading(true);

    try {
      const [date, time] = slot.split("T");

      const start_time = time.slice(0, 5);

      // 🔥 HOLD
      const holdRes = await fetch("/api/bookings/hold", {
        method: "POST",
        body: JSON.stringify({
          barber_id: barberId,
          barber_service_id: serviceId,
          date,
          start_time,
        }),
      });

      const holdData = await holdRes.json();

      if (!holdRes.ok) {
        throw new Error(holdData.error || "Slot ocupat");
      }

      // 🔥 CREATE
      const res = await fetch("/api/bookings/create", {
        method: "POST",
        body: JSON.stringify({
          bookingId: holdData.holdId,
          client_name: name,
          client_phone: phone,
          client_email: email,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Eroare creare");
      }

      setSuccess(true);

setTimeout(() => {
  onCreated();
  onClose();
}, 800);

    } catch (err: any) {
      alert(err.message || "Eroare la creare programare");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 p-6 rounded-xl w-full max-w-sm space-y-4">

        <h2 className="text-white text-lg font-semibold">
          Programare nouă
        </h2>

        {/* SLOT */}
        <div className="text-sm text-gray-400">
          {new Date(slot).toLocaleString("ro-RO", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </div>

        {/* NUME */}
        <input
          placeholder="Nume client"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-zinc-800 p-3 rounded text-white"
        />

        {/* TELEFON */}
        <input
          placeholder="Telefon"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full bg-zinc-800 p-3 rounded text-white"
        />

        {/* EMAIL */}
        <input
          placeholder="Email (opțional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-zinc-800 p-3 rounded text-white"
        />

        {/* ACTIONS */}
        <div className="flex gap-2">

  <button
    onClick={onClose}
    className="flex-1 bg-zinc-700 py-2 rounded text-white"
  >
    Anulează
  </button>

  {success ? (
    <button
      onClick={() => {
        onCreated();
        onClose();
      }}
      className="flex-1 bg-green-600 text-white py-2 rounded"
    >
      ✔ Programare creată
    </button>
  ) : (
    <button
      onClick={createBooking}
      disabled={loading}
      className="flex-1 bg-white text-black py-2 rounded"
    >
      {loading ? "Se salvează..." : "Salvează"}
    </button>
  )}

</div>
      </div>
    </div>
  );
}