import type { SupabaseClient } from "@supabase/supabase-js";
import { createGoogleEvent } from "@/lib/google/createEvent";
import { getAccessTokenForBarber } from "@/lib/google/getAccessTokenForBarber";

type BookingForSync = {
  id: string;
  barber_id: string;
  date: string;
  start_time: string;
  end_time: string;
};

function toGoogleDateTime(date: string, time: string): string {
  const normalized = time.slice(0, 5);
  return `${date}T${normalized}:00`;
}

export async function syncBookingToGoogleCalendar(
  supabase: SupabaseClient,
  booking: BookingForSync,
  details: {
    clientName: string;
    clientPhone: string;
    serviceName: string;
    notes?: string | null;
  },
): Promise<string | null> {
  const tokens = await getAccessTokenForBarber(supabase, booking.barber_id);
  if (!tokens) {
    console.error("GOOGLE SYNC: no tokens for barber", booking.barber_id);
    return null;
  }

  const event = await createGoogleEvent({
    accessToken: tokens.accessToken,
    calendarId: tokens.calendarId,
    title: `${details.clientName} | ${details.clientPhone} | ${details.serviceName}`,
    description: `Client: ${details.clientName}
Telefon: ${details.clientPhone}
Serviciu: ${details.serviceName}${details.notes ? `\nMentiuni: ${details.notes}` : ""}`,
    start: toGoogleDateTime(booking.date, booking.start_time),
    end: toGoogleDateTime(booking.date, booking.end_time),
  });

  if (!event?.id) {
    return null;
  }

  const { error } = await supabase
    .from("bookings")
    .update({ google_event_id: event.id })
    .eq("id", booking.id);

  if (error) {
    console.error("GOOGLE SYNC: failed to save event id", error);
    return null;
  }

  return event.id;
}

export async function backfillBarberCalendarEvents(
  supabase: SupabaseClient,
  barberId: string,
): Promise<{ synced: number; failed: number }> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(
      "id, barber_id, date, start_time, end_time, client_name, client_phone, client_notes, barber_service_id",
    )
    .eq("barber_id", barberId)
    .eq("status", "confirmed")
    .is("google_event_id", null)
    .gte("date", today)
    .order("date")
    .limit(50);

  if (error) {
    console.error("GOOGLE BACKFILL: query error", error);
    return { synced: 0, failed: 0 };
  }

  if (!bookings?.length) {
    return { synced: 0, failed: 0 };
  }

  let synced = 0;
  let failed = 0;

  for (const booking of bookings) {
    const { data: service } = await supabase
      .from("barber_services")
      .select("display_name, name")
      .eq("id", booking.barber_service_id)
      .maybeSingle();

    const serviceName = service?.display_name || service?.name || "Serviciu";

    const eventId = await syncBookingToGoogleCalendar(supabase, booking, {
      clientName: booking.client_name,
      clientPhone: booking.client_phone,
      serviceName,
      notes: booking.client_notes,
    });

    if (eventId) {
      synced++;
    } else {
      failed++;
    }
  }

  console.log(
    `GOOGLE BACKFILL barber=${barberId} synced=${synced} failed=${failed}`,
  );

  return { synced, failed };
}
