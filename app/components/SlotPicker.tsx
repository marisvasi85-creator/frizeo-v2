"use client";

import { Slot } from "@/types/slots";

export default function SlotPicker({
  slots,
  selected,
  onSelect,
  onBookingClick,
  loading = false,
  variant = "dark",
}: {
  slots: Slot[];
  selected: string | null;
  onSelect: (slot: string) => void;
  onBookingClick?: (booking: any) => void;
  loading?: boolean;
  variant?: "light" | "dark";
}) {
  const isLight = variant === "light";

  // =========================
  // 🔥 LOADING
  // =========================
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3 mt-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="h-12 rounded-xl animate-pulse bg-frz-fog"
          />
        ))}
      </div>
    );
  }

  // =========================
  // 🔥 GROUP ROWS (IMPORTANT)
  // =========================
  const rows: any[] = [];
  let currentRow: any[] = [];

  slots.forEach((slot) => {

    // 🟡 BREAK → rând separat
    if (slot.type === "break") {
      if (currentRow.length) {
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

  if (currentRow.length) {
    rows.push([...currentRow]);
  }

  // =========================
  // 🔥 RENDER
  // =========================
  return (
    <div className="space-y-3 mt-4">

      {rows.map((row, i) => {

        // =========================
        // 🟡 BREAK BLOCK (MERO STYLE)
        // =========================
        if (!Array.isArray(row) && row.type === "break") {
          return (
            <div
              key={`break-${i}`}
              className="bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 rounded-xl p-4 text-center"
            >
              <div className="text-sm opacity-70">
                Pauză
              </div>

              <div className="font-semibold">
                {row.start} – {row.end}
              </div>
            </div>
          );
        }

        // =========================
        // 🟢 ROW
        // =========================
        return (
          <div key={i} className="grid grid-cols-3 gap-3">

            {row.map((s: any) => {

              // =========================
              // 🔴 BOOKING (DOAR VIZUAL)
              // =========================
              if (s.type === "booking") {
                return (
                  <button
                    key={`booking-${s.time}`}
                    onClick={() => onBookingClick?.(s.booking)}
                    className="p-3 rounded-xl bg-red-500 text-white text-left hover:opacity-90"
                  >
                    <div className="font-semibold">
                      {s.time}
                    </div>

                    <div className="text-xs opacity-90">
                      {s.booking?.client_name}
                    </div>
                  </button>
                );
              }

              // =========================
              // ⚪ UNAVAILABLE (disabled)
              // =========================
              if (s.type === "unavailable") {
                return (
                  <button
                    key={`unavailable-${s.time}`}
                    type="button"
                    disabled
                    className="p-3 rounded-xl border cursor-not-allowed opacity-60 bg-frz-fog text-frz-muted border-frz-line"
                  >
                    <div className="font-semibold">{s.time}</div>
                    <div className="text-xs mt-0.5">
                      {s.reason === "past" ? "Trecut" : "Indisponibil"}
                    </div>
                  </button>
                );
              }

              // =========================
              // 🟢 FREE (CLICKABIL)
              // =========================
              return (
                <button
                  key={`free-${s.time}`}
                  onClick={() => onSelect(s.time)}
                  className={`
                    p-3 rounded-xl border transition
                    ${
                      selected === s.time
                        ? "bg-frz-ink text-frz-ink-contrast border-frz-ink"
                        : "bg-frz-card text-frz-ink border-frz-line hover:bg-frz-fog"
                    }
                  `}
                >
                  <div className="font-semibold">
                    {s.time}
                  </div>
                </button>
              );
            })}

          </div>
        );
      })}

    </div>
  );
}