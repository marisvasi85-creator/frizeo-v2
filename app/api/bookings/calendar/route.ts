import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  buildBookingIcs,
  buildClientBookingCalendarEvent,
} from "@/lib/calendar/bookingCalendar";
import { fetchResolvedBarberLocation } from "@/lib/location/fetchResolvedBarberLocation";
import { bookingClientUrls } from "@/lib/bookings/bookingClientUrls";

/**
 * Public ICS download for clients — gated by cancel_token (same secret as cancel/review).
 * GET /api/bookings/calendar?token=...
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ error: "token lipsă" }, { status: 400 });
  }

  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, date, start_time, end_time, client_notes, barber_id, tenant_id, barber_service_id, cancel_token, reschedule_token, status",
    )
    .eq("cancel_token", token)
    .maybeSingle();

  if (error || !booking) {
    return NextResponse.json({ error: "Programare inexistentă" }, { status: 404 });
  }

  if (booking.status === "cancelled") {
    return NextResponse.json(
      { error: "Programarea a fost anulată" },
      { status: 410 },
    );
  }

  const [{ data: barber }, { data: service }, location] = await Promise.all([
    supabaseAdmin
      .from("barbers")
      .select("display_name")
      .eq("id", booking.barber_id)
      .maybeSingle(),
    supabaseAdmin
      .from("barber_services")
      .select("display_name, name")
      .eq("id", booking.barber_service_id)
      .maybeSingle(),
    fetchResolvedBarberLocation(booking.barber_id, booking.tenant_id),
  ]);

  const { cancelUrl, rescheduleUrl } = bookingClientUrls(booking);
  const event = buildClientBookingCalendarEvent({
    bookingId: booking.id,
    serviceName: service?.display_name || service?.name || "Programare",
    barberName: barber?.display_name || "Frizer",
    date: booking.date,
    startTime: booking.start_time,
    endTime: booking.end_time,
    locationAddress: location?.formattedAddress,
    notes: booking.client_notes,
    cancelUrl,
    rescheduleUrl,
  });

  const ics = buildBookingIcs(event);

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="programare-frizeo.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
