import { NextResponse } from "next/server";
import {
  getCurrentBarberId,
  isAuthError,
  requireTenantAccess,
} from "@/lib/auth/requireTenantAccess";
import { requireManagedBarber } from "@/lib/barber-access/authorization";
import {
  asBookingAccessMode,
  BOOKING_ACCESS_MODES,
} from "@/lib/barber-access/types";
import { isMissingBarberAccessSchema } from "@/lib/barber-access/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const auth = await requireTenantAccess(["owner", "manager", "barber"]);
    if (isAuthError(auth)) return auth;

    let query = supabaseAdmin
      .from("barbers")
      .select("id, display_name, active, booking_access_mode")
      .eq("tenant_id", auth.tenantId)
      .eq("active", true)
      .order("display_name");

    if (auth.role === "barber") {
      const barberId = await getCurrentBarberId(auth.user.id, auth.tenantId);
      if (!barberId) {
        return NextResponse.json({ barbers: [], role: auth.role });
      }
      query = query.eq("id", barberId);
    }

    const { data, error } = await query;

    if (error && isMissingBarberAccessSchema(error)) {
      let legacyQuery = supabaseAdmin
        .from("barbers")
        .select("id, display_name, active")
        .eq("tenant_id", auth.tenantId)
        .eq("active", true)
        .order("display_name");

      if (auth.role === "barber") {
        const barberId = await getCurrentBarberId(auth.user.id, auth.tenantId);
        if (barberId) legacyQuery = legacyQuery.eq("id", barberId);
      }

      const { data: legacyBarbers } = await legacyQuery;
      return NextResponse.json({
        role: auth.role,
        schemaReady: false,
        barbers: (legacyBarbers ?? []).map((barber) => ({
          ...barber,
          booking_access_mode: "open",
        })),
      });
    }

    if (error) throw error;

    return NextResponse.json({
      role: auth.role,
      schemaReady: true,
      barbers: (data ?? []).map((barber) => ({
        ...barber,
        booking_access_mode: asBookingAccessMode(
          barber.booking_access_mode,
        ),
      })),
    });
  } catch (error) {
    console.error("BARBER ACCESS SETTINGS GET:", error);
    return NextResponse.json(
      { error: "Nu am putut încărca setările." },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const barberId = typeof body?.barberId === "string" ? body.barberId : "";
    const mode = body?.mode;

    if (
      !barberId ||
      !BOOKING_ACCESS_MODES.includes(mode as (typeof BOOKING_ACCESS_MODES)[number])
    ) {
      return NextResponse.json({ error: "Setare invalidă." }, { status: 400 });
    }

    const context = await requireManagedBarber(barberId);
    if (context instanceof NextResponse) return context;

    const previousMode = asBookingAccessMode(
      context.barber.booking_access_mode,
    );

    const { error } = await supabaseAdmin
      .from("barbers")
      .update({ booking_access_mode: mode })
      .eq("id", barberId)
      .eq("tenant_id", context.auth.tenantId);

    if (error) throw error;

    const { count } = await supabaseAdmin
      .from("barber_existing_clients")
      .select("phone_normalized", { count: "exact", head: true })
      .eq("tenant_id", context.auth.tenantId)
      .eq("barber_id", barberId);

    return NextResponse.json({
      success: true,
      previousMode,
      mode,
      existingClientCount: count ?? 0,
      needsExistingClientChoice:
        previousMode === "open" && mode !== "open",
    });
  } catch (error) {
    console.error("BARBER ACCESS SETTINGS PATCH:", error);
    return NextResponse.json(
      { error: "Nu am putut salva modul de acces." },
      { status: 500 },
    );
  }
}
