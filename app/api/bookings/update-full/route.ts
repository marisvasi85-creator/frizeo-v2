import { NextResponse } from "next/server";
import {
  bookingAccessibleByUser,
  getCurrentBarberId,
  isAuthError,
  requireTenantAccess,
  serviceBelongsToTenant,
} from "@/lib/auth/requireTenantAccess";
import { addMinutesToTime, timesOverlap } from "@/lib/schedule/time";

export async function POST(req: Request) {
  try {
    const auth = await requireTenantAccess(["owner", "manager", "barber"]);

    if (isAuthError(auth)) {
      return auth;
    }

    const body = await req.json();

    const {
      id,
      client_name,
      client_phone,
      client_email,
      barber_service_id,
      date,
      start_time,
    } = body;

    if (!id || !date || !start_time) {
      return NextResponse.json({ error: "Date lipsă" }, { status: 400 });
    }

    const barberId =
      auth.role === "barber"
        ? await getCurrentBarberId(auth.supabase, auth.user.id, auth.tenantId)
        : null;

    const canAccess = await bookingAccessibleByUser(
      auth.supabase,
      id,
      auth.tenantId,
      auth.role,
      barberId
    );

    if (!canAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (barber_service_id) {
      const serviceOk = await serviceBelongsToTenant(
        auth.supabase,
        barber_service_id,
        auth.tenantId
      );

      if (!serviceOk) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const { data: booking } = await auth.supabase
      .from("bookings")
      .select("barber_id")
      .eq("id", id)
      .single();

    const { data: service } = await auth.supabase
      .from("barber_services")
      .select("duration")
      .eq("id", barber_service_id)
      .single();

    const duration = service?.duration || 30;
    const end_time = addMinutesToTime(start_time, duration);

    const { data: existing } = await auth.supabase
      .from("bookings")
      .select("id, start_time, end_time")
      .eq("date", date)
      .eq("barber_id", booking?.barber_id)
      .neq("id", id)
      .in("status", ["confirmed", "pending"]);

    const overlap = existing?.some((b) =>
      timesOverlap(start_time, end_time, b.start_time, b.end_time)
    );

    if (overlap) {
      return NextResponse.json({ error: "Slot ocupat" }, { status: 400 });
    }

    const { error } = await auth.supabase
      .from("bookings")
      .update({
        client_name,
        client_phone,
        client_email: client_email ?? null,
        barber_service_id,
        date,
        start_time,
        end_time,
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: "Update eșuat" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
