import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  barberBelongsToTenant,
  getCurrentBarberId,
  isAuthError,
  requireTenantAccess,
} from "@/lib/auth/requireTenantAccess";
import { normalizeScheduleMode } from "@/lib/schedule/resolveDaySchedule";

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const barberId = String(body?.barber_id || "");
    const mode = normalizeScheduleMode(body?.schedule_mode);

    if (!barberId) {
      return NextResponse.json({ error: "Missing barber_id" }, { status: 400 });
    }

    if (body?.schedule_mode !== "weekly" && body?.schedule_mode !== "selective") {
      return NextResponse.json(
        { error: "Mod invalid. Alege weekly sau selective." },
        { status: 400 },
      );
    }

    const auth = await requireTenantAccess(["owner", "manager", "barber"]);
    if (isAuthError(auth)) return auth;

    const belongs = await barberBelongsToTenant(
      supabaseAdmin,
      barberId,
      auth.tenantId,
    );
    if (!belongs) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (auth.role === "barber") {
      const currentBarberId = await getCurrentBarberId(
        auth.user.id,
        auth.tenantId,
      );
      if (currentBarberId !== barberId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const { data, error } = await supabaseAdmin
      .from("barbers")
      .update({ schedule_mode: mode })
      .eq("id", barberId)
      .eq("tenant_id", auth.tenantId)
      .select("id, schedule_mode")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Nu am putut actualiza modul." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      schedule_mode: normalizeScheduleMode(data.schedule_mode),
    });
  } catch (err) {
    console.error("schedule-mode PATCH:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
