import { NextResponse } from "next/server";
import {
  barberBelongsToTenant,
  isAuthError,
  requireTenantAccess,
} from "@/lib/auth/requireTenantAccess";
import { supabaseAdmin } from "@/lib/supabase/admin";

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
      supabaseAdmin,
      barberId,
      auth.tenantId
    );

    if (!barberOk) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: barber } = await supabaseAdmin
      .from("barbers")
      .select("id, user_id")
      .eq("id", barberId)
      .eq("tenant_id", auth.tenantId)
      .single();

    if (!barber) {
      return NextResponse.json({ error: "Frizer inexistent" }, { status: 404 });
    }

    if (barber.user_id) {
      const { data: tenantUser } = await supabaseAdmin
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

    const { count } = await supabaseAdmin
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("barber_id", barberId);

    if ((count || 0) > 0) {
      return NextResponse.json(
        { error: "Frizerul are programări și nu poate fi șters" },
        { status: 400 }
      );
    }

    const cascadeTables = [
      "barber_weekly_schedule",
      "barber_day_overrides",
      "barber_settings",
      "barber_services",
    ] as const;

    for (const table of cascadeTables) {
      const { error: cascadeError } = await supabaseAdmin
        .from(table)
        .delete()
        .eq("barber_id", barberId);

      if (cascadeError) {
        console.error(`DELETE BARBER ${table} ERROR:`, cascadeError);
        return NextResponse.json(
          { error: "Nu s-a putut șterge frizerul" },
          { status: 500 }
        );
      }
    }

    const { error } = await supabaseAdmin
      .from("barbers")
      .delete()
      .eq("id", barberId)
      .eq("tenant_id", auth.tenantId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
