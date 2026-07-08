import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  barberBelongsToTenant,
  getCurrentBarberId,
  isAuthError,
  requireTenantAccess,
} from "@/lib/auth/requireTenantAccess";
import {
  enumerateDateRange,
  groupVacationPeriods,
} from "@/lib/schedule/vacationPeriods";
import { getTodayInBookingTimezone } from "@/lib/bookings/bookingTimezone";
import {
  barberOverridesSupportVacationPeriodId,
  isMissingVacationPeriodColumnError,
  parseRangeVacationPeriodId,
} from "@/lib/supabase/barberOverrideSchema";

const MAX_VACATION_DAYS = 90;

type VacationRow = {
  barber_id: string;
  tenant_id: string;
  date: string;
  is_closed: boolean;
  work_start: null;
  work_end: null;
  break_enabled: boolean;
  break_start: null;
  break_end: null;
  slot_duration: null;
  vacation_period_id?: string;
};

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

function buildVacationRows(
  dates: string[],
  barberId: string,
  tenantId: string,
  vacationPeriodId?: string,
): VacationRow[] {
  return dates.map((date) => ({
    barber_id: barberId,
    tenant_id: tenantId,
    date,
    is_closed: true,
    work_start: null,
    work_end: null,
    break_enabled: false,
    break_start: null,
    break_end: null,
    slot_duration: null,
    ...(vacationPeriodId ? { vacation_period_id: vacationPeriodId } : {}),
  }));
}

async function upsertVacationRows(rows: VacationRow[]) {
  const firstAttempt = await supabaseAdmin
    .from("barber_day_overrides")
    .upsert(rows, { onConflict: "barber_id,date" });

  if (!firstAttempt.error) {
    return null;
  }

  if (isMissingVacationPeriodColumnError(firstAttempt.error.message)) {
    const fallbackRows = rows.map(({ vacation_period_id: _id, ...row }) => row);
    const secondAttempt = await supabaseAdmin
      .from("barber_day_overrides")
      .upsert(fallbackRows, { onConflict: "barber_id,date" });

    return secondAttempt.error;
  }

  return firstAttempt.error;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { barber_id, date_from, date_to } = body ?? {};

    if (!barber_id || !date_from || !date_to) {
      return NextResponse.json(
        { error: "Completează perioada de concediu." },
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
    if (date_to < today) {
      return NextResponse.json(
        { error: "Perioada de concediu nu poate fi în trecut." },
        { status: 400 },
      );
    }

    const dates = enumerateDateRange(date_from, date_to);
    if (dates.length === 0) {
      return NextResponse.json({ error: "Perioadă invalidă." }, { status: 400 });
    }

    if (dates.length > MAX_VACATION_DAYS) {
      return NextResponse.json(
        { error: `Concediul poate avea maximum ${MAX_VACATION_DAYS} de zile.` },
        { status: 400 },
      );
    }

    const access = await assertBarberScheduleAccess(barber_id);
    if (access instanceof NextResponse) return access;

    const { data: barber, error: barberError } = await supabaseAdmin
      .from("barbers")
      .select("tenant_id")
      .eq("id", barber_id)
      .single();

    if (barberError || !barber) {
      return NextResponse.json({ error: "Barber not found" }, { status: 404 });
    }

    if (barber.tenant_id !== access.tenantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supportsPeriodId = await barberOverridesSupportVacationPeriodId(
      supabaseAdmin,
    );
    const vacationPeriodId = supportsPeriodId ? randomUUID() : undefined;

    const rows = buildVacationRows(
      dates,
      barber_id,
      access.tenantId,
      vacationPeriodId,
    );

    const error = await upsertVacationRows(rows);

    if (error) {
      console.error("VACATION UPSERT ERROR:", error);

      if (isMissingVacationPeriodColumnError(error.message)) {
        return NextResponse.json(
          {
            error:
              "Baza de date nu e actualizată. Rulează migrarea vacation_period_id în Supabase SQL Editor.",
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        { error: error.message || "Nu s-a putut salva concediul." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      vacationPeriod: {
        id: vacationPeriodId ?? `range:${date_from}:${date_to}`,
        from: date_from,
        to: date_to,
        dayCount: dates.length,
      },
    });
  } catch (err) {
    console.error("VACATION POST ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const barberId = searchParams.get("barberId");
    const vacationPeriodId = searchParams.get("vacationPeriodId");

    if (!barberId || !vacationPeriodId) {
      return NextResponse.json(
        { error: "Date invalide pentru ștergere." },
        { status: 400 },
      );
    }

    const access = await assertBarberScheduleAccess(barberId);
    if (access instanceof NextResponse) return access;

    const range = parseRangeVacationPeriodId(vacationPeriodId);

    const query = supabaseAdmin
      .from("barber_day_overrides")
      .delete()
      .eq("barber_id", barberId);

    const { error } = range
      ? await query
          .gte("date", range.from)
          .lte("date", range.to)
          .eq("is_closed", true)
      : await query.eq("vacation_period_id", vacationPeriodId);

    if (error) {
      console.error("VACATION DELETE ERROR:", error);
      return NextResponse.json(
        { error: "Nu s-a putut șterge concediul." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("VACATION DELETE ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const barberId = searchParams.get("barberId");

    if (!barberId) {
      return NextResponse.json({ vacationPeriods: [] });
    }

    const access = await assertBarberScheduleAccess(barberId);
    if (access instanceof NextResponse) return access;

    const today = getTodayInBookingTimezone();

    const { data, error } = await supabaseAdmin
      .from("barber_day_overrides")
      .select("date, is_closed, vacation_period_id")
      .eq("barber_id", barberId)
      .eq("is_closed", true)
      .gte("date", today);

    if (error) {
      if (isMissingVacationPeriodColumnError(error.message)) {
        const { data: fallbackData } = await supabaseAdmin
          .from("barber_day_overrides")
          .select("date, is_closed")
          .eq("barber_id", barberId)
          .eq("is_closed", true)
          .gte("date", today);

        return NextResponse.json({
          vacationPeriods: groupVacationPeriods(
            (fallbackData ?? []).map((row) => ({
              ...row,
              vacation_period_id: null,
            })),
          ),
        });
      }

      return NextResponse.json({ vacationPeriods: [] });
    }

    return NextResponse.json({
      vacationPeriods: groupVacationPeriods(data ?? []),
    });
  } catch {
    return NextResponse.json({ vacationPeriods: [] });
  }
}
