import type { Booking } from "./types";

export function isSlotFree({
  slot,
  duration,
  bookings,
}: {
  slot: string;
  duration: number;
  bookings: Booking[];
}) {
  const start = new Date(slot);
  const end = new Date(start.getTime() + duration * 60000);

  for (const b of bookings) {
    const bStart = new Date(b.start_time);
    const bEnd = new Date(b.end_time);

    // 🔥 protecție date invalide
    if (isNaN(bStart.getTime()) || isNaN(bEnd.getTime())) continue;

    const overlap = start < bEnd && end > bStart;

    if (overlap) return false;
  }

  return true;
}