"use client";

import { useState } from "react";

export default function AddBookingClient({
  barberId,
  services,
}: {
  barberId: string;
  services: any[];
}) {
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // 🔥 LOAD SLOTS
  async function loadSlots(dateValue: string, serviceValue: string) {
    if (!dateValue || !serviceValue) return;

    setLoadingSlots(true);

    const res = await fetch(
      `/api/slots?barberId=${barberId}&date=${dateValue}&serviceId=${serviceValue}`
    );

    const data = await res.json();
    setSlots(data.slots || []);
    setLoadingSlots(false);
  }

  // 🔥 CREATE BOOKING
  async function createBooking() {
    if (!serviceId || !date || !slot || !name || !phone) {
      alert("Completează toate câmpurile");
      return;
    }

    const res = await fetch("/api/bookings/create", {
      method: "POST",
      body: JSON.stringify({
        barberId,
        serviceId,
        booking_date: date,
        start_time: slot,
        client_name: name,
        client_phone: phone,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Eroare");
      return;
    }

    alert("Programare creată!");
    window.location.href = "/admin/bookings";
  }

  return (
    <div className="max-w-md space-y-4">

      <h1 className="text-xl font-semibold">
        Adaugă programare
      </h1>

      {/* SERVICE */}
      <select
        value={serviceId}
        onChange={(e) => {
          setServiceId(e.target.value);
          loadSlots(date, e.target.value);
        }}
        className="w-full bg-zinc-800 p-3 rounded text-white"
      >
        <option value="">Alege serviciu</option>
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.display_name} ({s.duration} min)
          </option>
        ))}
      </select>

      {/* DATE */}
      <input
        type="date"
        value={date}
        onChange={(e) => {
          setDate(e.target.value);
          loadSlots(e.target.value, serviceId);
        }}
        className="w-full bg-zinc-800 p-3 rounded text-white"
      />

      {/* SLOTS */}
      <div className="grid grid-cols-3 gap-2">
        {loadingSlots && <p>Se încarcă...</p>}

        {slots.map((s) => (
          <button
            key={s}
            onClick={() => setSlot(s)}
            className={`p-2 rounded ${
              slot === s
                ? "bg-white text-black"
                : "bg-zinc-800 text-white"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* CLIENT */}
      <input
        placeholder="Nume client"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full bg-zinc-800 p-3 rounded text-white"
      />

      <input
        placeholder="Telefon"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="w-full bg-zinc-800 p-3 rounded text-white"
      />

      {/* SUBMIT */}
      <button
        onClick={createBooking}
        className="w-full bg-white text-black py-3 rounded"
      >
        Creează programare
      </button>

    </div>
  );
}