"use client";

import { useEffect, useState } from "react";
import SlotPicker from "@/app/components/SlotPicker";
import { Slot } from "@/types/slots"; // 🔥 FOLOSEȘTI TIPUL GLOBAL

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
        // 🔥 FIX CRITIC – NORMALIZARE TIP
        const fixedSlots: Slot[] = (data.slots || []).map((s: any) => {
          if (s.type === "booking") {
            return {
              type: "booking",
              time: s.time,
              end:
                s.end ||
                s.booking?.end_time?.slice(0, 5) ||
                s.time,
              booking: s.booking,
            };
          }

          if (s.type === "break") {
            return {
              type: "break",
              start: s.start,
              end: s.end,
            };
          }

          return {
            type: "free",
            time: s.time,
          };
        });

        setSlots(fixedSlots);
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