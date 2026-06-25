import { NextResponse } from "next/server";
import {
  barberBelongsToTenant,
  isAuthError,
  requireTenantAccess,
} from "@/lib/auth/requireTenantAccess";

const ALLOWED_DURATIONS = [15, 30, 45, 60, 75, 90, 120];

export async function POST(req: Request) {
  try {
    const auth = await requireTenantAccess(["owner", "manager", "barber"]);

    if (isAuthError(auth)) {
      return auth;
    }

    const body = await req.json();

    const {
      barber_id,
      name,
      display_name,
      duration,
      price,
      show_price,
      featured,
    } = body;

    if (!barber_id || !name || !duration) {
      return NextResponse.json({ error: "Date incomplete" }, { status: 400 });
    }

    if (!ALLOWED_DURATIONS.includes(duration)) {
      return NextResponse.json({ error: "Durată invalidă" }, { status: 400 });
    }

    const barberOk = await barberBelongsToTenant(
      auth.supabase,
      barber_id,
      auth.tenantId
    );

    if (!barberOk) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (auth.role === "barber") {
      const { data: ownBarber } = await auth.supabase
        .from("barbers")
        .select("id")
        .eq("user_id", auth.user.id)
        .eq("id", barber_id)
        .maybeSingle();

      if (!ownBarber) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const { data, error } = await auth.supabase
      .from("barber_services")
      .insert({
        barber_id,
        tenant_id: auth.tenantId,
        name,
        display_name: display_name || name,
        duration,
        price: price || null,
        show_price: show_price ?? true,
        featured: featured ?? false,
        active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ service: data });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
