/**
 * Invariants for a barber after Auth detach:
 *   user_id = null AND active = false
 *
 * Public booking, slots, new bookings, and assistant booking must treat
 * that row as permanently unschedulable. An inactive barber that still
 * has an Auth user (owner toggled "admin only") may keep rescheduling
 * an existing booking on the same barber.
 */

export type SchedulableBarberRow = {
  id?: string;
  active?: boolean | null;
  user_id?: string | null;
};

export function isAnonymizedBarber(
  barber: SchedulableBarberRow | null | undefined,
): boolean {
  return Boolean(barber) && !barber?.user_id;
}

export function canBarberReceiveNewBookings(
  barber: SchedulableBarberRow | null | undefined,
): boolean {
  return Boolean(barber?.active && barber?.user_id);
}

export function canBarberGeneratePublicSlots(
  barber: SchedulableBarberRow | null | undefined,
  opts?: { excludeBookingId?: string | null; bookingBarberId?: string | null },
): boolean {
  if (!barber?.user_id) return false;
  if (barber.active) return true;
  return Boolean(
    opts?.excludeBookingId &&
      opts.bookingBarberId &&
      barber.id &&
      opts.bookingBarberId === barber.id,
  );
}

export const ANONYMIZED_BARBER_UNAVAILABLE_MESSAGE =
  "Acest frizer nu mai acceptă programări.";
