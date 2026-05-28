"use client";

import { useEffect, useRef, useState } from "react";

export default function EditBookingModal({
  booking,
  onClose,
  onSaved,
}: any) {
  const [name, setName] = useState(booking.client_name);
  const [phone, setPhone] = useState(booking.client_phone || "");
  const [email, setEmail] = useState(booking.client_email || "");

  const [date, setDate] = useState(booking.date);
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const slotsRef = useRef<HTMLDivElement>(null);

  // 🔥 LOAD SLOTS
  useEffect(() => {
    if (!date) return;

    fetch(
      `/api/slots?barberId=${booking.barber_id}&date=${date}&serviceId=${booking.barber_service_id}&excludeBookingId=${booking.id}`
    )
      .then((r) => r.json())
      .then((data) => {
        setSlots(Array.isArray(data?.slots) ? data.slots : []);

        setTimeout(() => {
          slotsRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      });
  }, [date, booking]);

  // 🔥 SAVE (REPROGRAMARE + UPDATE CLIENT)
  async function handleSave() {
    if (!selectedSlot) {
      setError("Alege un interval");
      return;
    }

    setLoading(true);
    setError("");

    const duration = booking.barber_services?.duration || 30;
    const endTime = addMinutes(selectedSlot, duration);

    const res = await fetch("/api/bookings/reschedule", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: booking.reschedule_token,
        new_date: date,
        new_start_time: selectedSlot,
        new_end_time: endTime,

        // 🔥 NU MAI PIERDEM DATELE CLIENTULUI
        client_name: name,
        client_phone: phone,
        client_email: email,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Eroare");
      setLoading(false);
      return;
    }

    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 p-6 rounded-xl w-full max-w-md space-y-4">

        <h2 className="text-white text-lg font-semibold">
          Editează programarea
        </h2>

        {/* INFO */}
        <div className="text-xs text-gray-400">
          Curent: {booking.date} {booking.start_time} - {booking.end_time}
        </div>

        {error && (
          <div className="bg-red-500/20 text-red-400 p-2 rounded text-sm">
            {error}
          </div>
        )}

        {/* NUME */}
        <input
          placeholder="Nume"
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

        {/* EMAIL 🔥 */}
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-zinc-800 p-3 rounded text-white"
        />

        {/* DATA */}
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setSelectedSlot(null);
          }}
          className="w-full bg-zinc-800 p-3 rounded text-white"
        />

        {/* SLOTURI */}
        <div ref={slotsRef} className="grid grid-cols-3 gap-2">
          {slots.map((s) => (
            <button
              key={s}
              onClick={() => setSelectedSlot(s)}
              className={`py-2 rounded text-sm ${
                selectedSlot === s
                  ? "bg-blue-500 text-white"
                  : "bg-zinc-800 text-white hover:bg-white hover:text-black"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* ACTIONS */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 bg-zinc-700 py-2 rounded text-white"
          >
            Anulează
          </button>

          <button
            onClick={handleSave}
            disabled={!selectedSlot || loading}
            className="flex-1 bg-white text-black py-2 rounded"
          >
            {loading ? "Se salvează..." : "Salvează"}
          </button>
        </div>

      </div>
    </div>
  );
}

function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h);
  d.setMinutes(m + minutes);
  return d.toTimeString().slice(0, 5);
}