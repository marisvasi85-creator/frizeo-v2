"use client";

import { Slot } from "@/types/slots";

export default function SlotPicker({
  slots,
  selected,
  onSelect,
  onBookingClick,
  loading = false,
}: {
  slots: Slot[];
  selected: string | null;
  onSelect: (slot: string) => void;
  onBookingClick?: (booking: any) => void;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3 mt-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-10 bg-zinc-700 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  const rows: any[] = [];
  let currentRow: any[] = [];

  slots.forEach((slot) => {
    if (slot.type === "break") {
      if (currentRow.length > 0) {
        rows.push([...currentRow]);
        currentRow = [];
      }

      rows.push(slot);
      return;
    }

    currentRow.push(slot);

    if (currentRow.length === 3) {
      rows.push([...currentRow]);
      currentRow = [];
    }
  });

  if (currentRow.length > 0) {
    rows.push([...currentRow]);
  }

  return (
    <div className="space-y-3 mt-4">
      {rows.map((row, i) => {

        if (!Array.isArray(row) && row.type === "break") {
          return (
            <div
              key={`break-${i}`}
              className="bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 rounded-xl p-4 text-center"
            >
              <div className="text-sm opacity-70">Pauză</div>
              <div className="font-semibold">
                {row.start} – {row.end}
              </div>
            </div>
          );
        }

        return (
          <div key={i} className="grid grid-cols-3 gap-3">
            {row.map((s: any) => {

              if (s.type === "booking") {
                return (
                  <button
                    key={`booking-${s.time}-${s.booking?.id}`}
                    onClick={() => onBookingClick?.(s.booking)}
                    className="p-3 rounded-xl bg-red-500 text-white text-left"
                  >
                    <div className="font-semibold">{s.time}</div>
                    <div className="text-xs">{s.booking?.client_name}</div>
                  </button>
                );
              }

              return (
                <button
                  key={`free-${s.time}`}
                  onClick={() => onSelect(s.time)}
                  className={`
                    p-3 rounded-xl border
                    ${
                      selected === s.time
                        ? "bg-white text-black"
                        : "bg-zinc-800 text-white border-zinc-700"
                    }
                  `}
                >
                  {s.time}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}