"use client";

import { useEffect, useState } from "react";
import SlotPicker from "@/app/components/SlotPicker";

type Slot =
  | { type: "free"; time: string }
  | { type: "booking"; time: string; booking: any }
  | { type: "break"; start: string; end: string };

export default function DayCalendar({ barberId }: any) {
  const [date, setDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!barberId || !date) return;

    setLoading(true);

    fetch(`/api/slots?barberId=${barberId}&date=${date}&mode=admin`)
      .then((r) => r.json())
      .then((data) => {
        setSlots(data.slots || []);
      })
      .finally(() => setLoading(false));
  }, [barberId, date]);

  return (
    <div className="space-y-4">

      {/* DATE */}
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="border p-2 rounded"
      />

      {/* SLOTS */}
      <SlotPicker
        slots={slots}
        selected={selectedSlot}
        onSelect={setSelectedSlot}
        loading={loading}
      />

      {/* SELECTED */}
      {selectedSlot && (
        <div className="pt-4">
          Slot selectat: <b>{selectedSlot}</b>
        </div>
      )}

    </div>
  );
}