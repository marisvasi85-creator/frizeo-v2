"use client";

import { useEffect, useState } from "react";

export type Slot = {
  start: string; // "HH:mm"
  end: string;   // "HH:mm"
};

type Props = {
  barberId: string;
  date: string;
  selectedSlot: Slot | null;
  onSelect: (slot: Slot) => void;
};

export default function SlotPicker({
  barberId,
  date,
  selectedSlot,
  onSelect,
}: Props) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!date) {
      setSlots([]);
      return;
    }

    const controller = new AbortController();

    async function loadSlots() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/slots?barberId=${barberId}&date=${date}`,
          { signal: controller.signal }
        );

        if (!res.ok) {
          throw new Error("Nu pot încărca sloturile");
        }

        const data = await res.json();

        // 🛡️ guard IMPORTANT
        if (!Array.isArray(data)) {
          throw new Error("Răspuns invalid de la server");
        }

        setSlots(data);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setError(err.message || "Eroare la încărcarea sloturilor");
          setSlots([]);
        }
      } finally {
        setLoading(false);
      }
    }

    loadSlots();
    return () => controller.abort();
  }, [barberId, date]);

  if (loading) {
    return <p className="text-sm text-gray-500">Se încarcă sloturile…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-500">{error}</p>;
  }

  if (slots.length === 0) {
    return <p className="text-sm text-gray-500">Nu sunt sloturi disponibile</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {slots.map((slot) => {
        const isSelected =
          selectedSlot?.start === slot.start &&
          selectedSlot?.end === slot.end;

        return (
          <button
            key={`${slot.start}-${slot.end}`}
            type="button"
            onClick={() => onSelect(slot)}
            className={`rounded border px-3 py-2 text-sm transition
              ${
                isSelected
                  ? "bg-black text-white"
                  : "hover:bg-black hover:text-white"
              }`}
          >
            {slot.start} – {slot.end}
          </button>
        );
      })}
    </div>
  );
}
