"use client";

import { useEffect, useState } from "react";

export type Slot = {
  start: string;
  end: string;
};

type Props = {
  barberId: string;
  barberServiceId: string;
  date: string;
  selectedSlot: Slot | null;
  onSelect: (slot: Slot) => void;
  excludeBookingId?: string;
};

export default function SlotPicker({
  barberId,
  barberServiceId,
  date,
  selectedSlot,
  onSelect,
  excludeBookingId,
}: Props) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!barberId || !date || !barberServiceId) return;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);

        const params = new URLSearchParams({
          barberId,
          date,
          barberServiceId,
        });

        if (excludeBookingId) {
          params.append("excludeBookingId", excludeBookingId);
        }

        const res = await fetch(`/api/slots?${params.toString()}`);
        const data = await res.json();

        if (!cancelled) {
          setSlots(data.slots || []);
        }
      } catch {
        if (!cancelled) setSlots([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [barberId, date, barberServiceId, excludeBookingId]);

  if (loading) return <p>Se încarcă sloturile…</p>;

  if (!loading && slots.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Nu mai sunt sloturi disponibile pentru această zi.
      </p>
    );
  }

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
            className={`border rounded p-2 text-sm transition ${
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