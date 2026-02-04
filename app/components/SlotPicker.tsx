"use client";

import { useEffect, useState } from "react";

export type Slot = {
  start: string;
  end: string;
};

type Props = {
  barberId: string;
  date: string;
  selectedSlot: Slot | null;
  onSelect: (slot: Slot) => void;
  excludeBookingId?: string; // ✅ ADĂUGAT
};

export default function SlotPicker({
  barberId,
  date,
  selectedSlot,
  onSelect,
  excludeBookingId,
}: Props) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
  if (!barberId || !date) return;

  let cancelled = false;

  async function load() {
    setLoading(true);

    const params = new URLSearchParams({ barberId, date });

    if (excludeBookingId) {
      params.append("excludeBookingId", excludeBookingId);
    }

    const res = await fetch(`/api/slots?${params.toString()}`);
    const data = await res.json();

    if (!cancelled) {
      setSlots(data.slots || []);
      setLoading(false);
    }
  }

  load();

  return () => {
    cancelled = true;
  };
}, [barberId, date, excludeBookingId]);


  if (loading) return <p>Se încarcă sloturile…</p>;
  if (slots.length === 0) return <p>Nu sunt sloturi disponibile</p>;

  return (
    <div className="grid grid-cols-2 gap-2">
      {slots.map((slot) => {
        const active =
          selectedSlot?.start === slot.start &&
          selectedSlot?.end === slot.end;

        return (
          <button
            key={`${slot.start}-${slot.end}`}
            onClick={() => onSelect(slot)}
            className={`border rounded p-2 text-sm ${
              active
                ? "bg-black text-white"
                : "bg-white hover:bg-gray-100"
            }`}
          >
            {slot.start} – {slot.end}
          </button>
        );
      })}
    </div>
  );
}
