"use client";

import { useEffect, useState } from "react";

type Props = {
  barberId: string;
};

export default function DayCalendar({ barberId }: Props) {
  const [date, setDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 🔹 FETCH AVAILABLE SLOTS
  useEffect(() => {
  fetch(
    `/api/bookings/available?barberId=${barberId}&date=${date}`
  )
    .then(res => res.json())
    .then(data => setSlots(data.slots));
}, [barberId, date]);



  // 🔹 CREATE BOOKING
  const createBooking = async () => {
    if (!selectedSlot) return;

    setSaving(true);

    const res = await fetch("/api/bookings/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barber_id: barberId,
        date,
        time: selectedSlot,
      }),
    });

    const data = await res.json();

    setSaving(false);

    if (!res.ok) {
      alert(data.error || "Eroare la creare booking");
      return;
    }

    alert("Programare creată ✅");

    // refresh slots
    setSelectedSlot(null);
    setSlots((prev) => prev.filter((s) => s !== selectedSlot));
  };

  return (
    <div className="day-calendar">
      {/* SELECTOR ZI */}
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />

      {loading && <p>Se încarcă sloturile...</p>}

      {!loading && slots.length === 0 && (
        <p>Nu există sloturi disponibile</p>
      )}

      <div className="day-calendar-grid">
  {slots.map((slot) => (
    <div
      key={slot}
      className={`day-slot slot-free ${
        selectedSlot === slot ? "slot-selected" : ""
      }`}
      onClick={() => setSelectedSlot(slot)}
    >
      <span className="slot-time">{slot}</span>
      <span>Liber</span>
    </div>
  ))}
</div>


      {/* CONFIRMARE */}
      {selectedSlot && (
        <div style={{ marginTop: 16 }}>
          <p>
            Slot selectat: <b>{selectedSlot}</b>
          </p>
          <button onClick={createBooking} disabled={saving}>
            {saving ? "Se salvează..." : "Programează"}
          </button>
        </div>
      )}
    </div>
  );
}
