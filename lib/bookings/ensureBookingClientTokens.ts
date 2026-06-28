import { supabaseAdmin } from "@/lib/supabase/admin";

/** Asigură token-uri pentru link-urile client cancel/reschedule. */
export async function ensureBookingClientTokens(bookingId: string) {
  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select("id, cancel_token, reschedule_token")
    .eq("id", bookingId)
    .single();

  if (!booking) {
    return null;
  }

  if (booking.cancel_token && booking.reschedule_token) {
    return booking;
  }

  const { data: updated } = await supabaseAdmin
    .from("bookings")
    .update({
      cancel_token: booking.cancel_token ?? crypto.randomUUID(),
      reschedule_token: booking.reschedule_token ?? crypto.randomUUID(),
    })
    .eq("id", bookingId)
    .select("id, cancel_token, reschedule_token")
    .single();

  return updated ?? booking;
}
