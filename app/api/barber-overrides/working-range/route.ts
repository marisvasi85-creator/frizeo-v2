import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  barberBelongsToTenant,
  getCurrentBarberId,
  isAuthError,
  requireTenantAccess,
} from "@/lib/auth/requireTenantAccess";
import { enumerateDateRange } from "@/lib/schedule/vacationPeriods";
import { getTodayInBookingTimezone } from "@/lib/bookings/bookingTimezone";
import { toDBTime } from "@/lib/schedule/time";

const MAX_WORKING_RANGE_DAYS = 62;

async function assertBarberScheduleAccess(barberId: string) {
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

/**
 * Set working hours for an inclusive date range (selective schedule helper).
 * Upserts day overrides with custom hours; clears vacation_period_id.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      barber_id,
      date_from,
      date_to,
      work_start,
      work_end,
      break_enabled,
      break_start,
      break_end,
    } = body ?? {};

    if (!barber_id || !date_from || !date_to || !work_start || !work_end) {
      return NextResponse.json(
        { error: "Completează perioada și orele de lucru." },
        { status: 400 },
      );
    }

    if (date_from > date_to) {
      return NextResponse.json(
        { error: "Data de început trebuie să fie înainte de data de final." },
        { status: 400 },
      );
    }

    const today = getTodayInBookingTimezone();
    if (date_from < today) {
      return NextResponse.json(
        { error: "Perioada nu poate începe în trecut." },
        { status: 400 },
      );
    }

    const dates = enumerateDateRange(date_from, date_to);
    if (dates.length === 0) {
      return NextResponse.json({ error: "Perioadă invalidă." }, { status: 400 });
    }
    if (dates.length > MAX_WORKING_RANGE_DAYS) {
      return NextResponse.json(
        {
          error: `Poți seta maxim ${MAX_WORKING_RANGE_DAYS} zile odată.`,
        },
        { status: 400 },
      );
    }

    if (work_start >= work_end) {
      return NextResponse.json(
        { error: "Ora de început trebuie să fie înainte de ora de final." },
        { status: 400 },
      );
    }

    const breakOn = break_enabled === true;
    if (breakOn) {
      if (!break_start || !break_end) {
        return NextResponse.json(
          { error: "Completează intervalul pauzei." },
          { status: 400 },
        );
      }
      if (break_start >= break_end) {
        return NextResponse.json(
          { error: "Pauza este invalidă." },
          { status: 400 },
        );
      }
      if (break_start < work_start || break_end > work_end) {
        return NextResponse.json(
          { error: "Pauza trebuie să fie în intervalul programului." },
          { status: 400 },
        );
      }
    }

    const access = await assertBarberScheduleAccess(barber_id);
    if (access instanceof NextResponse) return access;

    const { data: barber, error: barberError } = await supabaseAdmin
      .from("barbers")
      .select("tenant_id, schedule_mode")
      .eq("id", barber_id)
      .single();

    if (barberError || !barber) {
      return NextResponse.json({ error: "Barber not found" }, { status: 404 });
    }

    if (barber.tenant_id !== access.tenantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rows = dates.map((date) => ({
      barber_id,
      tenant_id: access.tenantId,
      date,
      is_closed: false,
      work_start: toDBTime(work_start),
      work_end: toDBTime(work_end),
      break_enabled: breakOn,
      break_start: breakOn ? toDBTime(break_start) : null,
      break_end: breakOn ? toDBTime(break_end) : null,
      slot_duration: null,
      vacation_period_id: null,
    }));

    const { error } = await supabaseAdmin
      .from("barber_day_overrides")
      .upsert(rows, { onConflict: "barber_id,date" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      days: dates.length,
      date_from,
      date_to,
    });
  } catch (err) {
    console.error("working-range POST:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
