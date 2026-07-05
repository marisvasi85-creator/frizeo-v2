import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  barberBelongsToTenant,
  getCurrentBarberId,
  isAuthError,
  requireTenantAccess,
  type TenantAuthContext,
} from "@/lib/auth/requireTenantAccess";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { toDBTime } from "@/lib/schedule/time";

async function assertBarberScheduleAccess(
  barberId: string,
): Promise<TenantAuthContext | NextResponse> {
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

  return auth;
}

/* =========================
   GET override(s)
========================= */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const barberId = searchParams.get("barberId");
    const date = searchParams.get("date");

    if (!barberId) {
      return NextResponse.json(
        { error: "Missing barberId" },
        { status: 400 }
      );
    }

    const access = await assertBarberScheduleAccess(barberId);
    if (access instanceof NextResponse) return access;

    const supabase = await createSupabaseServerClient();

    if (date) {
      const { data, error } = await supabase
        .from("barber_day_overrides")
        .select("*")
        .eq("barber_id", barberId)
        .eq("date", date)
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json(data ?? null);
    }

    const { data, error } = await supabase
      .from("barber_day_overrides")
      .select("*")
      .eq("barber_id", barberId)
      .order("date");

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      overrides: data || [],
    });
  } catch (err) {
    console.error("OVERRIDE GET ERROR:", err);

    return NextResponse.json({ error: "GET ERROR" }, { status: 500 });
  }
}

/* =========================
   CREATE / UPDATE override
========================= */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      barber_id,
      date,
      is_closed,
      work_start,
      work_end,
      break_enabled,
      break_start,
      break_end,
      slot_duration,
    } = body ?? {};

    if (!barber_id || !date) {
      return NextResponse.json(
        { error: "Missing barber_id or date" },
        { status: 400 }
      );
    }

    const access = await assertBarberScheduleAccess(barber_id);
    if (access instanceof NextResponse) return access;

    const closed = is_closed === true;
    const hasCustomHours = !closed && work_start && work_end;

    if (!closed && !hasCustomHours && break_enabled) {
      return NextResponse.json(
        {
          error:
            "Pentru pauză specială fără program custom, folosește programul săptămânal.",
        },
        { status: 400 }
      );
    }

    if (hasCustomHours && work_start >= work_end) {
      return NextResponse.json(
        { error: "Ora de început trebuie să fie înainte de ora de final" },
        { status: 400 }
      );
    }

    if (hasCustomHours && break_enabled) {
      if (!break_start || !break_end) {
        return NextResponse.json(
          { error: "Completează intervalul pauzei" },
          { status: 400 }
        );
      }

      if (break_start >= break_end) {
        return NextResponse.json(
          { error: "Pauza este invalidă" },
          { status: 400 }
        );
      }

      if (break_start < work_start || break_end > work_end) {
        return NextResponse.json(
          { error: "Pauza trebuie să fie în intervalul programului" },
          { status: 400 }
        );
      }
    }

    const { data: barber, error: barberError } = await supabaseAdmin
      .from("barbers")
      .select("tenant_id")
      .eq("id", barber_id)
      .single();

    if (barberError || !barber) {
      return NextResponse.json(
        { error: "Barber not found" },
        { status: 404 }
      );
    }

    if (barber.tenant_id !== access.tenantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payload = {
      barber_id,
      tenant_id: access.tenantId,
      date,
      is_closed: closed,
      work_start: closed || !hasCustomHours ? null : toDBTime(work_start),
      work_end: closed || !hasCustomHours ? null : toDBTime(work_end),
      break_enabled: closed || !hasCustomHours ? false : !!break_enabled,
      break_start:
        closed || !hasCustomHours || !break_enabled
          ? null
          : toDBTime(break_start),
      break_end:
        closed || !hasCustomHours || !break_enabled
          ? null
          : toDBTime(break_end),
      slot_duration:
        closed || !hasCustomHours ? null : slot_duration ?? null,
    };

    const { data, error } = await supabaseAdmin
      .from("barber_day_overrides")
      .upsert(payload, {
        onConflict: "barber_id,date",
      })
      .select();

    if (error) {
      console.error("OVERRIDE UPSERT ERROR:", error);

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error("OVERRIDE POST ERROR:", err);

    return NextResponse.json({ error: "POST ERROR" }, { status: 500 });
  }
}

/* =========================
   DELETE override
========================= */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const barberId = searchParams.get("barberId");
    const date = searchParams.get("date");

    if (!barberId || !date) {
      return NextResponse.json(
        { error: "Missing barberId or date" },
        { status: 400 }
      );
    }

    const access = await assertBarberScheduleAccess(barberId);
    if (access instanceof NextResponse) return access;

    const { error } = await supabaseAdmin
      .from("barber_day_overrides")
      .delete()
      .eq("barber_id", barberId)
      .eq("date", date);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
    });
  } catch (err) {
    console.error("OVERRIDE DELETE ERROR:", err);

    return NextResponse.json({ error: "DELETE ERROR" }, { status: 500 });
  }
}
