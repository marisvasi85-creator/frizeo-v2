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

export async function POST(req: Request) {
  try {
    const supabase = supabaseAdmin;
    const body = await req.json();

    const { barber_id, barber_service_id, date, start_time } = body;

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

    const { data: service } = await supabase
      .from("barber_services")
      .select("duration")
      .eq("id", barber_service_id)
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

    let bypassMinNotice = false;
    const auth = await requireTenantAccess(["owner", "manager", "barber"]);

    if (!isAuthError(auth)) {
      const belongs = await barberBelongsToTenant(
        supabase,
        barber_id,
        auth.tenantId,
      );

      if (belongs) {
        bypassMinNotice = true;
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
