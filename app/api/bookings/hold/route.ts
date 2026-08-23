import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireActiveBarberForNewBooking } from "@/lib/barbers/requireActiveBarberForBooking";
import {
  barberBelongsToTenant,
  isAuthError,
  requireTenantAccess,
} from "@/lib/auth/requireTenantAccess";
import { getActiveBookings } from "@/lib/schedule/bookings";
import { assertBookingLeadTimeForBarber } from "@/lib/bookings/bookingLeadTime";
import {
  addMinutesToTime,
  timesOverlap,
} from "@/lib/schedule/time";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import {
  getGoogleBusyIntervalsForDate,
  slotOverlapsBusyIntervals,
} from "@/lib/google/getGoogleBusyIntervals";
import {
  checkBarberBookingAccess,
  publicAccessMessage,
} from "@/lib/barber-access/server";

export async function POST(req: Request) {
  try {
    const limited = await enforceRateLimit(req, {
      bucket: "booking-hold",
      limit: 30,
      windowSeconds: 600,
    });
    if (limited) return limited;

    const supabase = supabaseAdmin;
    const body = await req.json();

    const {
      barber_id,
      barber_service_id,
      date,
      start_time,
      client_phone,
      booking_context,
    } = body;

    if (!barber_id || !barber_service_id || !date || !start_time) {
      return NextResponse.json(
        { error: "Date invalide" },
        { status: 400 }
      );
    }

    const barberCheck = await requireActiveBarberForNewBooking(barber_id);

    if (!barberCheck.ok) {
      return NextResponse.json(
        { error: barberCheck.error },
        { status: barberCheck.status }
      );
    }

    let isDashboardBooking = false;
    let bypassMinNotice = false;
    let bypassGoogleBusy = false;
    const auth = booking_context === "dashboard"
      ? await requireTenantAccess(["owner", "manager", "barber"])
      : null;

    if (auth && isAuthError(auth)) return auth;

    if (auth && !isAuthError(auth)) {
      const belongs = await barberBelongsToTenant(
        supabase,
        barber_id,
        auth.tenantId,
      );

      if (belongs) {
        isDashboardBooking = true;
        bypassMinNotice = true;
        bypassGoogleBusy = true;
      }
    }

    if (!isDashboardBooking) {
      const bookingAccess = await checkBarberBookingAccess({
        barberId: barber_id,
        phone: typeof client_phone === "string" ? client_phone : "",
      });

      if (!bookingAccess.canBook) {
        return NextResponse.json(
          {
            error: publicAccessMessage(bookingAccess),
            accessStatus: bookingAccess.status,
          },
          { status: 403 },
        );
      }
    }

    const { data: service } = await supabase
      .from("barber_services")
      .select("duration")
      .eq("id", barber_service_id)
      .eq("barber_id", barber_id)
      .eq("tenant_id", barberCheck.barber.tenant_id)
      .eq("active", true)
      .single();

    if (!service) {
      return NextResponse.json(
        { error: "Serviciu invalid" },
        { status: 400 }
      );
    }

    const end_time = addMinutesToTime(start_time, service.duration);

    const barber = barberCheck.barber;

    const { data: existing } = await supabase
      .from("bookings")
      .select("start_time, end_time, status, expires_at")
      .eq("barber_id", barber_id)
      .eq("date", date);

    const active = getActiveBookings(existing);

    const overlap = active.some((booking) =>
      timesOverlap(
        start_time,
        end_time,
        booking.start_time,
        booking.end_time
      )
    );

    if (overlap) {
      return NextResponse.json(
        { error: "Slot ocupat" },
        { status: 400 }
      );
    }

    if (!bypassGoogleBusy) {
      const googleBusyIntervals = await getGoogleBusyIntervalsForDate(
        supabase,
        barber_id,
        date,
      );

      if (
        slotOverlapsBusyIntervals(start_time, end_time, googleBusyIntervals)
      ) {
        return NextResponse.json(
          { error: "Slot ocupat" },
          { status: 400 }
        );
      }
    }

    const leadTime = await assertBookingLeadTimeForBarber(
      supabase,
      barber_id,
      date,
      start_time,
      { bypassMinNotice },
    );

    if (!leadTime.ok) {
      return NextResponse.json({ error: leadTime.error }, { status: 400 });
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const { data, error } = await supabase
      .from("bookings")
      .insert({
        barber_id,
        barber_service_id,
        tenant_id: barber.tenant_id,
        date,
        start_time,
        end_time,
        status: "pending",
        expires_at: expiresAt.toISOString(),
        cancel_token: crypto.randomUUID(),
        reschedule_token: crypto.randomUUID(),
      })
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Nu se poate crea hold" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      holdId: data.id,
      end_time,
      expiresAt: data.expires_at,
    });
  } catch (err) {
    console.error("HOLD ERROR:", err);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
