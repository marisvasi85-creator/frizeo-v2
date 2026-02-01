import { Slot, Booking } from "./types";

/**
 * Elimină sloturile care se suprapun cu programări existente.
 * - suportă reprogramare (excludeBookingId)
 * - overlap strict (nu taie sloturi valide)
 */
export function filterBookedSlots(
  date: string,
  slots: Slot[],
  bookings: Booking[],
  excludeBookingId?: string | null
): Slot[] {
  console.log("🚫 filterBookedSlots()", {
    date,
    slots,
    bookings,
    excludeBookingId,
  });

  if (!bookings || bookings.length === 0) {
    return slots;
  }

  return slots.filter((slot) => {
    const slotStart = toDate(date, slot.start);
    const slotEnd = toDate(date, slot.end);

    return !bookings.some((b) => {
      // 👉 ignorăm booking-ul curent (reprogramare)
      if (excludeBookingId && b.id === excludeBookingId) {
        return false;
      }

      const bookingStart = toDate(b.date, b.start_time);
      const bookingEnd = toDate(b.date, b.end_time);

      // overlap strict:
      // [slotStart, slotEnd) intersectează [bookingStart, bookingEnd)
      const overlap =
        slotStart < bookingEnd && slotEnd > bookingStart;

      if (overlap) {
        console.log("⛔ overlap slot", slot, "with booking", b);
      }

      return overlap;
    });
  });
}

/* =========================
   Utils
========================= */
function toDate(date: string, time: string): Date {
  // acceptă "HH:mm" sau "HH:mm:ss"
  const t = time.length === 5 ? `${time}:00` : time;
  return new Date(`${date}T${t}`);
}
