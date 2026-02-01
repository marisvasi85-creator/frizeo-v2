import { DateInterval } from "./buildWorkIntervals";
import { Slot } from "./types";

/**
 * Generează sloturi consecutive din intervale de lucru.
 * - slotDuration în minute
 * - NU depășește capătul intervalului
 * - NU produce sloturi goale
 */
export function generateSlots(
  intervals: DateInterval[],
  slotDuration: number
): Slot[] {
  console.log("🧩 generateSlots()", {
    intervals,
    slotDuration,
  });

  if (!slotDuration || slotDuration <= 0) {
    console.log("⛔ invalid slotDuration");
    return [];
  }

  const slots: Slot[] = [];

  for (const interval of intervals) {
    let cursor = new Date(interval.start);

    // protecție: interval invalid
    if (interval.end <= interval.start) continue;

    while (true) {
      const slotEnd = new Date(
        cursor.getTime() + slotDuration * 60 * 1000
      );

      // nu depășim intervalul
      if (slotEnd > interval.end) break;

      slots.push({
        start: formatTime(cursor),
        end: formatTime(slotEnd),
      });

      cursor = slotEnd;
    }
  }

  console.log("🧩 slots generated:", slots);
  return slots;
}

/* =========================
   Utils locale (fără dependențe)
========================= */
function formatTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
