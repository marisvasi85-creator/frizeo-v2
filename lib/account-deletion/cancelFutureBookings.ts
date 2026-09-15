import { notifyBookingCancelled } from "@/lib/assistant/tools/notifyBookingChange";
import {
  ACCOUNT_DELETION_CANCELLABLE_STATUSES,
  selectFutureActiveBookingsForCancel,
  shouldNotifyAfterCancelUpdate,
  type BookingForDeletionCancel,
} from "@/lib/account-deletion/futureBookings";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BOOKING_CANCEL_SELECT =
  "id, tenant_id, barber_id, date, start_time, end_time, status, expires_at, client_name, client_phone, client_email";

type BookingCancelRow = BookingForDeletionCancel & {
  tenant_id: string;
  end_time: string;
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
};

/**
 * Cancel this barber's future active bookings and notify clients.
 * Idempotent: a retry only notifies rows whose status actually
 * transitioned from pending/confirmed → cancelled. Does not DELETE
 * bookings, does not touch other barbers, and does not delete Google
 * Calendar events.
 */
export async function cancelFutureActiveBookingsForBarber(
  barberId: string,
  now = new Date(),
): Promise<{ cancelledIds: string[] }> {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(BOOKING_CANCEL_SELECT)
    .eq("barber_id", barberId)
    .in("status", [...ACCOUNT_DELETION_CANCELLABLE_STATUSES]);

  if (error) {
    throw new Error(`list bookings for cancel: ${error.message}`);
  }

  const targets = selectFutureActiveBookingsForCancel(
    (data ?? []) as BookingCancelRow[],
    now,
    barberId,
  );

  const cancelledIds: string[] = [];

  for (const booking of targets) {
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking.id)
      .eq("barber_id", barberId)
      .in("status", [...ACCOUNT_DELETION_CANCELLABLE_STATUSES])
      .select(BOOKING_CANCEL_SELECT)
      .maybeSingle();

    if (updateError) {
      throw new Error(`cancel booking ${booking.id}: ${updateError.message}`);
    }

    if (!shouldNotifyAfterCancelUpdate(updated) || !updated) continue;

    const cancelled = updated as BookingCancelRow;
    cancelledIds.push(cancelled.id);
    await notifyBookingCancelled({
      booking: {
        id: cancelled.id,
        tenant_id: cancelled.tenant_id,
        barber_id: cancelled.barber_id,
        date: cancelled.date,
        start_time: cancelled.start_time,
        end_time: cancelled.end_time,
        client_name: cancelled.client_name,
        client_phone: cancelled.client_phone,
        client_email: cancelled.client_email,
      },
    });
  }

  return { cancelledIds };
}
