import { NextResponse } from "next/server";
import {
  bookingAccessibleByUser,
  getCurrentBarberId,
  isAuthError,
  requireTenantAccess,
  serviceBelongsToTenant,
} from "@/lib/auth/requireTenantAccess";

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
      barber_service_id,
      date,
      start_time,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
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

    const { data: service } = await auth.supabase
      .from("barber_services")
      .select("duration")
      .eq("id", barber_service_id)
      .single();

    const duration = service?.duration || 30;

    const [h, m] = start_time.split(":").map(Number);
    const end = new Date();
    end.setHours(h);
    end.setMinutes(m + duration);

    const end_time = end.toTimeString().slice(0, 5);

    const { error } = await auth.supabase
      .from("bookings")
      .update({
        client_name,
        client_phone,
        barber_service_id,
        date,
        start_time,
        end_time,
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: "Update failed" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
