import type { SupabaseClient } from "@supabase/supabase-js";
import { getAccessTokenForBarber } from "@/lib/google/getAccessTokenForBarber";
import { releaseGoogleCalendarEvent } from "@/lib/google/deleteEvent";

export async function releaseGoogleEventForBarber(input: {
  supabase: SupabaseClient;
  barberId: string;
  googleEventId: string | null | undefined;
}): Promise<boolean> {
  if (!input.googleEventId) return true;

  try {
    const google = await getAccessTokenForBarber(
      input.supabase,
      input.barberId,
    );
    if (!google) return false;

    return await releaseGoogleCalendarEvent({
      accessToken: google.accessToken,
      calendarId: google.calendarId,
      eventId: input.googleEventId,
    });
  } catch (err) {
    console.error("GOOGLE EVENT RELEASE ERROR:", err);
    return false;
  }
}

/**
 * Cancelled Frizeo bookings can leave a Google event behind. Do not await
 * this from availability/slots/hold: sequential Google DELETE/PATCH of
 * leftover events times out public booking. Slot display already punches
 * cancelled intervals out of FreeBusy.
 */
export async function releaseLeftoverCancelledGoogleEvents(
  supabase: SupabaseClient,
  barberId: string,
  fromDate: string,
  toDate: string,
  googleAuth?: { accessToken: string; calendarId: string } | null,
): Promise<void> {
  try {
    const google =
      googleAuth === undefined
        ? await getAccessTokenForBarber(supabase, barberId)
        : googleAuth;
    if (!google) return;

    const { data, error } = await supabase
      .from("bookings")
      .select("id, google_event_id")
      .eq("barber_id", barberId)
      .eq("status", "cancelled")
      .not("google_event_id", "is", null)
      .gte("date", fromDate)
      .lte("date", toDate)
      .limit(40);

    if (error) {
      console.error("GOOGLE LEFTOVER EVENT QUERY ERROR:", error);
      return;
    }

    for (const row of data ?? []) {
      if (!row.google_event_id) continue;

      try {
        const released = await releaseGoogleCalendarEvent({
          accessToken: google.accessToken,
          calendarId: google.calendarId,
          eventId: row.google_event_id,
        });

        if (!released) continue;

        const { error: clearError } = await supabase
          .from("bookings")
          .update({ google_event_id: null })
          .eq("id", row.id);

        if (clearError) {
          console.error("GOOGLE LEFTOVER EVENT CLEAR ERROR:", clearError);
        }
      } catch (err) {
        console.error("GOOGLE LEFTOVER EVENT RELEASE ERROR:", err);
      }
    }
  } catch (err) {
    console.error("GOOGLE LEFTOVER EVENT SWEEP ERROR:", err);
  }
}
