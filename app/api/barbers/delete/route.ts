import { NextResponse } from "next/server";
import {
  barberBelongsToTenant,
  isAuthError,
  requireTenantAccess,
} from "@/lib/auth/requireTenantAccess";

export async function POST(req: Request) {
  try {
    const auth = await requireTenantAccess(["owner", "manager"]);

    if (isAuthError(auth)) {
      return auth;
    }

    const { barberId } = await req.json();

    if (!barberId) {
      return NextResponse.json({ error: "Barber invalid" }, { status: 400 });
    }

    const barberOk = await barberBelongsToTenant(
      auth.supabase,
      barberId,
      auth.tenantId
    );

    if (!barberOk) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: barber } = await auth.supabase
      .from("barbers")
      .select("id, user_id")
      .eq("id", barberId)
      .single();

    if (!barber) {
      return NextResponse.json({ error: "Frizer inexistent" }, { status: 404 });
    }

    if (barber.user_id) {
      const { data: tenantUser } = await auth.supabase
        .from("tenant_users")
        .select("role")
        .eq("tenant_id", auth.tenantId)
        .eq("user_id", barber.user_id)
        .maybeSingle();

      if (tenantUser?.role === "owner") {
        return NextResponse.json(
          { error: "Owner-ul salonului nu poate fi șters" },
          { status: 400 }
        );
      }
    }

    const { count } = await auth.supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("barber_id", barberId);

    if ((count || 0) > 0) {
      return NextResponse.json(
        { error: "Frizerul are programări și nu poate fi șters" },
        { status: 400 }
      );
    }

    await auth.supabase
      .from("barber_weekly_schedule")
      .delete()
      .eq("barber_id", barberId);

    await auth.supabase
      .from("barber_day_overrides")
      .delete()
      .eq("barber_id", barberId);

    await auth.supabase
      .from("barber_settings")
      .delete()
      .eq("barber_id", barberId);

    await auth.supabase
      .from("barber_services")
      .delete()
      .eq("barber_id", barberId);

    const { error } = await auth.supabase
      .from("barbers")
      .delete()
      .eq("id", barberId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
