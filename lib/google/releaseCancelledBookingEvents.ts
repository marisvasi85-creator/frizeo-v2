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
 * Cancelled Frizeo bookings can leave a Google event behind. FreeBusy then
 * keeps the public slot occupied. Delete (or transparent-patch) those
 * leftovers before reading availability.
 */
export async function releaseLeftoverCancelledGoogleEvents(
  supabase: SupabaseClient,
  barberId: string,
  fromDate: string,
  toDate: string,
  googleAuth?: { accessToken: string; calendarId: string } | null,
): Promise<void> {
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
  }
}
