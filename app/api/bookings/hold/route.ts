import { NextResponse } from "next/server";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { getActiveBookings } from "@/lib/schedule/bookings";
import {
  addMinutesToTime,
  timesOverlap,
} from "@/lib/schedule/time";

export async function POST(req: Request) {
  try {
    const supabase = createSupabasePublicClient();
    const body = await req.json();

    const { barber_id, barber_service_id, date, start_time } = body;

    if (!barber_id || !barber_service_id || !date || !start_time) {
      return NextResponse.json(
        { error: "Date invalide" },
        { status: 400 }
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

    const { data: barber } = await supabase
      .from("barbers")
      .select("tenant_id")
      .eq("id", barber_id)
      .single();

    if (!barber) {
      return NextResponse.json(
        { error: "Barber invalid" },
        { status: 400 }
      );
    }

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
