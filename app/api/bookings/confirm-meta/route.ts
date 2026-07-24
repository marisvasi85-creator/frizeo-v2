import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureBookingClientTokens } from "@/lib/bookings/ensureBookingClientTokens";
import { bookingClientUrls } from "@/lib/bookings/bookingClientUrls";
import { buildClientCalendarLinks } from "@/lib/calendar/buildClientCalendarLinks";
import { fetchResolvedBarberLocation } from "@/lib/location/fetchResolvedBarberLocation";
import { hasSalonReviewsTable } from "@/lib/reviews/salonReviews";

/** Meta for confirmed page: review link + add-to-calendar links. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id lipsă" }, { status: 400 });
  }

  const tokens = await ensureBookingClientTokens(id);

  let reviewUrl: string | null = null;
  if (tokens?.cancel_token && (await hasSalonReviewsTable())) {
    const { data: existing } = await supabaseAdmin
      .from("salon_reviews")
      .select("id")
      .eq("booking_id", id)
      .maybeSingle();

    if (!existing) {
      reviewUrl = `/review/${tokens.cancel_token}`;
    }
  }

  let googleCalendarUrl: string | null = null;
  let icsUrl: string | null = null;

  if (tokens?.cancel_token) {
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, date, start_time, end_time, client_notes, barber_id, tenant_id, barber_service_id, status",
      )
      .eq("id", id)
      .maybeSingle();

    if (
      booking &&
      booking.status !== "cancelled" &&
      booking.date &&
      booking.start_time &&
      booking.end_time
    ) {
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

      const { cancelUrl, rescheduleUrl } = bookingClientUrls(tokens);
      const links = buildClientCalendarLinks({
        bookingId: booking.id,
        serviceName: service?.display_name || service?.name || "Programare",
        barberName: barber?.display_name || "Frizer",
        date: booking.date,
        startTime: booking.start_time,
        endTime: booking.end_time,
        cancelToken: tokens.cancel_token,
        locationAddress: location?.formattedAddress,
        notes: booking.client_notes,
        cancelUrl,
        rescheduleUrl,
      });

      googleCalendarUrl = links.googleUrl;
      icsUrl = links.icsUrl;
    }
  }

  return NextResponse.json({
    reviewUrl,
    googleCalendarUrl,
    icsUrl,
  });
}
