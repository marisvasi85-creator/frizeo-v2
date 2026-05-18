"use client";

import { useEffect, useState } from "react";

type Service = {
  id: string;
  display_name: string;
  price: number | null;
  duration: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  slot: string;
  barberId: string;
  onCreated: () => void;
};

export default function CreateBookingModal({
  open,
  onClose,
  slot,
  barberId,
  onCreated,
}: Props) {
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔥 fetch servicii
  useEffect(() => {
    if (!open) return;

    fetch("/api/services")
      .then((res) => res.json())
      .then((data) => {
        setServices(data.services || []);
      });
  }, [open]);

  // 🔥 serviciu selectat (pentru UI)
  const selectedService = services.find((s) => s.id === serviceId);

  // 🔥 creare booking
  async function createBooking() {
    if (!serviceId || !name || !phone) {
      alert("Completează toate câmpurile");
      return;
    }

    setLoading(true);

    try {
      // 🔥 convert slot -> ISO
      const startISO = new Date(slot).toISOString();

      const res = await fetch("/api/bookings/create", {
        method: "POST",
        body: JSON.stringify({
          barberId,
          serviceId,
          start_time: startISO,
          client_name: name,
          client_phone: phone,
        }),
      });

      if (!res.ok) {
        throw new Error("Booking failed");
      }

      onCreated();
      onClose();
    } catch (err) {
      alert("Eroare la creare programare");
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

        {/* SERVICE */}
        <select
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          className="w-full bg-zinc-800 p-3 rounded text-white"
        >
          <option value="">Alege serviciu</option>

          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.display_name}
              {s.price ? ` - ${s.price} RON` : ""}
            </option>
          ))}
        </select>

        {/* INFO SERVICIU */}
        {selectedService && (
          <div className="text-xs text-gray-400">
            Durată: {selectedService.duration} min
            {selectedService.price && ` • ${selectedService.price} RON`}
          </div>
        )}

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

        {/* ACTIONS */}
        <div className="flex gap-2">

          <button
            onClick={onClose}
            className="flex-1 bg-zinc-700 py-2 rounded text-white"
          >
            Anulează
          </button>

          <button
            onClick={createBooking}
            disabled={loading}
            className="flex-1 bg-white text-black py-2 rounded"
          >
            {loading ? "Se salvează..." : "Salvează"}
          </button>

        </div>

      </div>
    </div>
  );
}