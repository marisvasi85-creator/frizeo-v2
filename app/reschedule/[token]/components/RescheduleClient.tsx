"use client";

import { useState } from "react";
import Calendar from "@/app/components/Calendar";
import SlotPicker, { Slot } from "@/app/components/SlotPicker";

type Props = {
  barberId: string;
  bookingId: string; // doar pentru excludeBookingId
  token: string;     // 🔥 ESENȚIAL
};

export default function RescheduleClient({
  barberId,
  bookingId,
  token,
}: Props) {
  const [date, setDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleConfirm() {
    if (!date || !selectedSlot) return;

    setLoading(true);
    setError(null);

    const res = await fetch("/api/bookings/reschedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token, // ✅ CORECT
        new_date: date,
        new_start_time: selectedSlot.start,
        new_end_time: selectedSlot.end,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Nu s-a putut reprograma");
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <p className="text-green-600 text-center">
        ✅ Programarea a fost reprogramată cu succes!
      </p>
    );
  }
window.location.href = "/reschedule/confirmed";

  return (
    <div className="space-y-6">
      <Calendar
        value={date}
        onChange={(d) => {
          setDate(d);
          setSelectedSlot(null);
        }}
      />

      {date && (
        <SlotPicker
          barberId={barberId}
          date={date}
          selectedSlot={selectedSlot}
          onSelect={setSelectedSlot}
          excludeBookingId={bookingId}
        />
      )}

      {selectedSlot && (
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="w-full bg-black text-white py-2 rounded disabled:opacity-50"
        >
          {loading ? "Se reprogramează..." : "Confirmă reprogramarea"}
        </button>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  );
}
