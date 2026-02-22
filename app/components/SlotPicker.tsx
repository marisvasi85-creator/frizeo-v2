"use client";

import { useEffect, useState } from "react";

export type Slot = {
  start: string;
  end: string;
};

type Props = {
  barberId: string;
  barberServiceId: string; // 🔥 obligatoriu
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

  /* ===============================
     🔎 RENDER DEBUG
  =============================== */
  console.log("🎯 SlotPicker RENDER");
  console.log("Props:", {
    barberId,
    barberServiceId,
    date,
    excludeBookingId,
  });

  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {

    console.log("🚀 useEffect TRIGGERED");
    console.log("VALUES:", {
      barberId,
      barberServiceId,
      date,
    });

    if (!barberId || !date || !barberServiceId) {
      console.log("⛔ Missing required params → abort fetch");
      return;
    }

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

        console.log("🌍 FETCH URL:", `/api/slots?${params.toString()}`);

        const res = await fetch(`/api/slots?${params.toString()}`);

        console.log("📡 Response status:", res.status);

        const data = await res.json();

        console.log("📦 Response data:", data);

        if (!cancelled) {
          setSlots(data.slots || []);
          setLoading(false);
        }

      } catch (err) {
        console.error("🔥 FETCH ERROR:", err);
        setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };

  }, [barberId, date, barberServiceId, excludeBookingId]);

  if (loading) return <p>Se încarcă sloturile…</p>;

  if (slots.length === 0) {
    console.log("⚠️ No slots returned");
    return <p>Nu sunt sloturi disponibile</p>;
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
