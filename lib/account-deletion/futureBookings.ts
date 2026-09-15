import { shouldCancelBookingOnAccountDeletion } from "@/lib/account-deletion/decisions";
import { parseBookingDateTime } from "@/lib/bookings/bookingTimezone";

export {
  ACCOUNT_DELETION_CANCELLABLE_STATUSES,
  isActiveOccupancyBooking,
  isExpiredPendingHold,
  shouldNotifyAfterCancelUpdate,
} from "@/lib/account-deletion/decisions";

export type BookingForDeletionCancel = {
  id: string;
  barber_id: string;
  date: string;
  start_time: string;
  status: string;
  expires_at?: string | null;
};

export function isFutureBookingStart(
  booking: Pick<BookingForDeletionCancel, "date" | "start_time">,
  now: Date,
): boolean {
  return parseBookingDateTime(booking.date, booking.start_time).getTime() >
    now.getTime();
}

export function shouldCancelBookingRowOnAccountDeletion(
  booking: BookingForDeletionCancel,
  now: Date,
): boolean {
  return shouldCancelBookingOnAccountDeletion({
    status: booking.status,
    expiresAt: booking.expires_at,
    startMs: parseBookingDateTime(booking.date, booking.start_time).getTime(),
    nowMs: now.getTime(),
  });
}

export function selectFutureActiveBookingsForCancel<
  T extends BookingForDeletionCancel,
>(bookings: T[] | null | undefined, now: Date, barberId: string): T[] {
  return (bookings ?? []).filter(
    (booking) =>
      booking.barber_id === barberId &&
      shouldCancelBookingRowOnAccountDeletion(booking, now),
  );
}
