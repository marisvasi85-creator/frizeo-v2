import { NextResponse } from "next/server";
import {
  isAuthError,
  requireTenantAccess,
} from "@/lib/auth/requireTenantAccess";
import { allocateBarberSlug } from "@/lib/barbers/allocateBarberSlug";
import {
  activeBarberLimitReachedMessage,
  canCreateBarber,
  getBarberLimitState,
} from "@/lib/limits/checkBarberLimit";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Owner toggle: administrator vs administrator + frizer.
 * Uses barbers.active — never deletes the row or bookings.
 */
export async function POST(req: Request) {
  try {
    const auth = await requireTenantAccess(["owner"]);

    if (isAuthError(auth)) {
      return auth;
    }

    const body = await req.json();
    const enable = body?.enable;

    if (typeof enable !== "boolean") {
      return NextResponse.json(
        { error: "Trimite { enable: true | false }" },
        { status: 400 }
      );
    }

    const { data: existing } = await supabaseAdmin
      .from("barbers")
      .select("id, active, display_name")
      .eq("tenant_id", auth.tenantId)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (!enable) {
      if (!existing) {
        return NextResponse.json({
          success: true,
          active: false,
          message: "Ești deja doar administrator.",
        });
      }

      if (!existing.active) {
        return NextResponse.json({
          success: true,
          active: false,
          message: "Ești deja doar administrator.",
        });
      }

      const { error } = await supabaseAdmin
        .from("barbers")
        .update({ active: false })
        .eq("id", existing.id)
        .eq("tenant_id", auth.tenantId);

      if (error) {
        console.error("owner-role disable:", error);
        return NextResponse.json(
          { error: "Nu s-a putut actualiza rolul." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        active: false,
        message:
          "Ești acum doar administrator. Locul de frizer a fost eliberat.",
      });
    }

    // enable === true
    if (existing?.active) {
      return NextResponse.json({
        success: true,
        active: true,
        message: "Ești deja frizer activ.",
      });
    }

    const allowed = await canCreateBarber(auth.tenantId);
    if (!allowed) {
      const state = await getBarberLimitState(auth.tenantId);
      const limit = state?.limit ?? 0;
      return NextResponse.json(
        {
          error: activeBarberLimitReachedMessage(limit),
          code: "BARBER_LIMIT_EXCEEDED",
          activeCount: state?.activeCount ?? 0,
          limit,
        },
        { status: 403 }
      );
    }

    if (existing) {
      const { error } = await supabaseAdmin
        .from("barbers")
        .update({ active: true })
        .eq("id", existing.id)
        .eq("tenant_id", auth.tenantId);

      if (error) {
        console.error("owner-role enable:", error);
        return NextResponse.json(
          { error: "Nu s-a putut activa profilul de frizer." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        active: true,
        message: "Ești acum administrator și frizer.",
      });
    }

    // Edge case: no barber row yet — create one with defaults
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, phone")
      .eq("id", auth.user.id)
      .maybeSingle();

    const displayName =
      profile?.full_name?.trim() ||
      auth.user.email?.split("@")[0] ||
      "Proprietar";

    const barberSlug = await allocateBarberSlug(auth.tenantId, displayName);

    const { data: barber, error: barberError } = await supabaseAdmin
      .from("barbers")
      .insert({
        user_id: auth.user.id,
        tenant_id: auth.tenantId,
        display_name: displayName,
        phone: profile?.phone || null,
        active: true,
        slug: barberSlug,
      })
      .select("id")
      .single();

    if (barberError || !barber) {
      console.error("owner-role create barber:", barberError);
      return NextResponse.json(
        { error: "Nu s-a putut crea profilul de frizer." },
        { status: 500 }
      );
    }

    await supabaseAdmin.from("barber_services").insert([
      {
        barber_id: barber.id,
        tenant_id: auth.tenantId,
        display_name: "Tuns",
        name: "Tuns",
        duration: 45,
        price: 50,
        active: true,
        featured: true,
        sort_order: 1,
        show_price: true,
      },
      {
        barber_id: barber.id,
        tenant_id: auth.tenantId,
        display_name: "Barbă",
        name: "Barbă",
        duration: 30,
        price: 30,
        active: true,
        featured: false,
        sort_order: 2,
        show_price: true,
      },
      {
        barber_id: barber.id,
        tenant_id: auth.tenantId,
        display_name: "Tuns + Barbă",
        name: "Tuns + Barbă",
        duration: 60,
        price: 70,
        active: true,
        featured: true,
        sort_order: 3,
        show_price: true,
      },
    ]);

    await supabaseAdmin.from("barber_weekly_schedule").insert(
      [1, 2, 3, 4, 5].map((day_of_week) => ({
        barber_id: barber.id,
        tenant_id: auth.tenantId,
        day_of_week,
        is_working: true,
        work_start: "09:00",
        work_end: "18:00",
        break_enabled: true,
        break_start: "13:00",
        break_end: "14:00",
      }))
    );

    return NextResponse.json({
      success: true,
      active: true,
      message: "Ești acum administrator și frizer.",
    });
  } catch (err) {
    console.error("owner-role:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
