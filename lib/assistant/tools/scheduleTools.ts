import { randomUUID } from "crypto";
import {
  addDaysToDateString,
  getTodayInBookingTimezone,
} from "@/lib/bookings/bookingTimezone";
import {
  enumerateDateRange,
  formatVacationPeriodRO,
  groupVacationPeriods,
} from "@/lib/schedule/vacationPeriods";
import {
  barberOverridesSupportVacationPeriodId,
  isMissingVacationPeriodColumnError,
  parseRangeVacationPeriodId,
} from "@/lib/supabase/barberOverrideSchema";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AssistantToolContext, AssistantToolResult } from "../types";
import {
  asBoolean,
  asString,
  resolveBarberFromArgs,
} from "./helpers";

const MAX_VACATION_DAYS = 90;

function resolveCloseDate(args: Record<string, unknown>): string | null {
  const explicit = asString(args.date);
  if (explicit) return explicit;

  const when =
    asString(args.when) ||
    asString(args.relative_day) ||
    asString(args.day);
  if (when === "today") return getTodayInBookingTimezone();
  if (when === "tomorrow") {
    return addDaysToDateString(getTodayInBookingTimezone(), 1);
  }
  return null;
}

export async function closeDayTool(
  args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const targetDate = resolveCloseDate(args);
  if (!targetDate) {
    return {
      ok: false,
      summary:
        "Lipsa data zilei libere. Folosește date=YYYY-MM-DD sau when=today|tomorrow.",
      error: "missing_date",
    };
  }

  const resolved = await resolveBarberFromArgs(ctx, args);
  if (!resolved.ok) return resolved.result;

  const confirmed = asBoolean(args.confirmed);
  const proposal = {
    barber_id: resolved.barberId,
    date: targetDate,
    action: "close_day",
  };

  if (!confirmed) {
    return {
      ok: true,
      summary: `Confirmare necesară: închid ziua ${targetDate} (zi liberă).`,
      data: {
        needs_confirmation: true,
        action: "close_day",
        proposal,
        instruct_user:
          "Prezintă propunerea. Utilizatorul confirmă din butoanele din chat (nu seta confirmed=true).",
      },
    };
  }

  const { error } = await supabaseAdmin.from("barber_day_overrides").upsert(
    {
      barber_id: resolved.barberId,
      tenant_id: ctx.tenantId,
      date: targetDate,
      is_closed: true,
      work_start: null,
      work_end: null,
      break_enabled: false,
      break_start: null,
      break_end: null,
      slot_duration: null,
      vacation_period_id: null,
    },
    { onConflict: "barber_id,date" },
  );

  if (error) {
    return {
      ok: false,
      summary: "Nu am putut închide ziua.",
      error: error.message,
    };
  }

  return {
    ok: true,
    summary: `Ziua ${targetDate} este acum liberă (închisă pentru programări).`,
    data: proposal,
  };
}

export async function openDayTool(
  args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const targetDate = resolveCloseDate(args);
  if (!targetDate) {
    return {
      ok: false,
      summary:
        "Lipsa data. Folosește date=YYYY-MM-DD sau when=today|tomorrow.",
      error: "missing_date",
    };
  }

  const resolved = await resolveBarberFromArgs(ctx, args);
  if (!resolved.ok) return resolved.result;

  const confirmed = asBoolean(args.confirmed);
  const proposal = {
    barber_id: resolved.barberId,
    date: targetDate,
    action: "open_day",
  };

  if (!confirmed) {
    return {
      ok: true,
      summary: `Confirmare necesară: redeschid ziua ${targetDate} (programul săptămânal se aplică din nou).`,
      data: {
        needs_confirmation: true,
        action: "open_day",
        proposal,
        instruct_user:
          "Prezintă propunerea. Utilizatorul confirmă din butoanele din chat (nu seta confirmed=true).",
      },
    };
  }

  const { error } = await supabaseAdmin
    .from("barber_day_overrides")
    .delete()
    .eq("barber_id", resolved.barberId)
    .eq("date", targetDate);

  if (error) {
    return {
      ok: false,
      summary: "Nu am putut redeschide ziua.",
      error: error.message,
    };
  }

  return {
    ok: true,
    summary: `Ziua ${targetDate} e din nou deschisă (fără override — se aplică programul săptămânal).`,
    data: proposal,
  };
}

export async function createVacationTool(
  args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const dateFrom =
    asString(args.date_from) ||
    asString(args.start_date) ||
    asString(args.from);
  const dateTo =
    asString(args.date_to) || asString(args.end_date) || asString(args.to);
  const confirmed = asBoolean(args.confirmed);

  if (!dateFrom || !dateTo) {
    return {
      ok: false,
      summary: "Lipsa perioada de concediu (date_from și date_to, YYYY-MM-DD).",
      error: "missing_range",
    };
  }

  if (dateFrom > dateTo) {
    return {
      ok: false,
      summary: "Data de început trebuie să fie înainte de data de final.",
      error: "invalid_range",
    };
  }

  const today = getTodayInBookingTimezone();
  if (dateTo < today) {
    return {
      ok: false,
      summary: "Perioada de concediu nu poate fi în trecut.",
      error: "past_range",
    };
  }

  const dates = enumerateDateRange(dateFrom, dateTo);
  if (dates.length === 0) {
    return { ok: false, summary: "Perioadă invalidă.", error: "invalid_range" };
  }
  if (dates.length > MAX_VACATION_DAYS) {
    return {
      ok: false,
      summary: `Concediul poate avea maximum ${MAX_VACATION_DAYS} de zile.`,
      error: "too_long",
    };
  }

  const resolved = await resolveBarberFromArgs(ctx, args);
  if (!resolved.ok) return resolved.result;

  const proposal = {
    barber_id: resolved.barberId,
    date_from: dateFrom,
    date_to: dateTo,
    day_count: dates.length,
  };

  if (!confirmed) {
    return {
      ok: true,
      summary: `Confirmare necesară: concediu ${dateFrom} → ${dateTo} (${dates.length} zile).`,
      data: {
        needs_confirmation: true,
        action: "create_vacation",
        proposal,
        instruct_user:
          "Prezintă propunerea. Utilizatorul confirmă din butoanele din chat (nu seta confirmed=true).",
      },
    };
  }

  const supportsPeriodId = await barberOverridesSupportVacationPeriodId(
    supabaseAdmin,
  );
  const vacationPeriodId = supportsPeriodId ? randomUUID() : undefined;

  const rows = dates.map((date) => ({
    barber_id: resolved.barberId,
    tenant_id: ctx.tenantId,
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

  const firstAttempt = await supabaseAdmin
    .from("barber_day_overrides")
    .upsert(rows, { onConflict: "barber_id,date" });

  let upsertError = firstAttempt.error;
  if (upsertError && isMissingVacationPeriodColumnError(upsertError.message)) {
    const fallbackRows = rows.map((row) => {
      const { vacation_period_id, ...rest } = row as typeof row & {
        vacation_period_id?: string;
      };
      void vacation_period_id;
      return rest;
    });
    const secondAttempt = await supabaseAdmin
      .from("barber_day_overrides")
      .upsert(fallbackRows, { onConflict: "barber_id,date" });
    upsertError = secondAttempt.error;
  }

  if (upsertError) {
    return {
      ok: false,
      summary: "Nu am putut salva concediul.",
      error: upsertError.message,
    };
  }

  return {
    ok: true,
    summary: `Concediu salvat: ${dateFrom} → ${dateTo} (${dates.length} zile închise).`,
    data: {
      ...proposal,
      vacation_period_id: vacationPeriodId ?? null,
    },
  };
}

export async function listVacationsTool(
  args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const resolved = await resolveBarberFromArgs(ctx, args);
  if (!resolved.ok) return resolved.result;

  const today = getTodayInBookingTimezone();
  const { data, error } = await supabaseAdmin
    .from("barber_day_overrides")
    .select("date, is_closed, vacation_period_id")
    .eq("barber_id", resolved.barberId)
    .eq("is_closed", true)
    .gte("date", today)
    .order("date", { ascending: true });

  if (error) {
    if (isMissingVacationPeriodColumnError(error.message)) {
      const { data: fallbackData } = await supabaseAdmin
        .from("barber_day_overrides")
        .select("date, is_closed")
        .eq("barber_id", resolved.barberId)
        .eq("is_closed", true)
        .gte("date", today)
        .order("date", { ascending: true });

      const periods = groupVacationPeriods(
        (fallbackData ?? []).map((row) => ({
          ...row,
          vacation_period_id: null,
        })),
      );

      return {
        ok: true,
        summary:
          periods.length === 0
            ? "Nu există concedii viitoare."
            : `Concedii viitoare (${periods.length}): ${periods
                .map((p) => formatVacationPeriodRO(p))
                .join("; ")}.`,
        data: { vacation_periods: periods, barber_id: resolved.barberId },
      };
    }

    return {
      ok: false,
      summary: "Nu am putut lista concediile.",
      error: error.message,
    };
  }

  const periods = groupVacationPeriods(data ?? []);
  // Also surface single closed days that aren't part of a multi-day vacation
  const periodDates = new Set(
    periods.flatMap((p) => enumerateDateRange(p.from, p.to)),
  );
  const singleClosed = (data ?? [])
    .filter((row) => row.is_closed && !periodDates.has(row.date))
    .map((row) => row.date);

  return {
    ok: true,
    summary:
      periods.length === 0 && singleClosed.length === 0
        ? "Nu există concedii sau zile libere viitoare."
        : [
            periods.length
              ? `Concedii (${periods.length}): ${periods
                  .map((p) => `${formatVacationPeriodRO(p)} [${p.id.slice(0, 8)}…]`)
                  .join("; ")}`
              : null,
            singleClosed.length
              ? `Zile libere: ${singleClosed.join(", ")}`
              : null,
          ]
            .filter(Boolean)
            .join(" "),
    data: {
      barber_id: resolved.barberId,
      vacation_periods: periods,
      closed_days: singleClosed,
    },
  };
}

export async function deleteVacationTool(
  args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const resolved = await resolveBarberFromArgs(ctx, args);
  if (!resolved.ok) return resolved.result;

  const vacationPeriodId =
    asString(args.vacation_period_id) ||
    asString(args.vacation_id) ||
    asString(args.period_id);
  const dateFrom = asString(args.date_from) || asString(args.from);
  const dateTo = asString(args.date_to) || asString(args.to);
  const confirmed = asBoolean(args.confirmed);

  let from = dateFrom;
  let to = dateTo;
  let periodId = vacationPeriodId;

  if (periodId && (!from || !to)) {
    const range = parseRangeVacationPeriodId(periodId);
    if (range) {
      from = range.from;
      to = range.to;
    }
  }

  if (!periodId && from && to) {
    // Prefer matching an existing period id when possible
    const listed = await listVacationsTool(
      { barber_id: resolved.barberId },
      ctx,
    );
    const periods =
      listed.data && typeof listed.data === "object"
        ? (
            listed.data as {
              vacation_periods?: Array<{ id: string; from: string; to: string }>;
            }
          ).vacation_periods || []
        : [];
    const match = periods.find((p) => p.from === from && p.to === to);
    if (match) periodId = match.id;
  }

  if (!periodId && (!from || !to)) {
    return {
      ok: false,
      summary:
        "Specifică vacation_period_id (din list_vacations) sau date_from + date_to.",
      error: "missing_period",
    };
  }

  const proposal = {
    barber_id: resolved.barberId,
    vacation_period_id: periodId,
    date_from: from,
    date_to: to,
  };

  if (!confirmed) {
    return {
      ok: true,
      summary: `Confirmare necesară: șterg concediul ${
        from && to ? `${from} → ${to}` : periodId
      }.`,
      data: {
        needs_confirmation: true,
        action: "delete_vacation",
        proposal,
        instruct_user:
          "Prezintă propunerea. Utilizatorul confirmă din butoanele din chat (nu seta confirmed=true).",
      },
    };
  }

  const query = supabaseAdmin
    .from("barber_day_overrides")
    .delete()
    .eq("barber_id", resolved.barberId);

  const range = periodId ? parseRangeVacationPeriodId(periodId) : null;
  const { error } =
    range || (from && to)
      ? await query
          .gte("date", range?.from || from!)
          .lte("date", range?.to || to!)
          .eq("is_closed", true)
      : await query.eq("vacation_period_id", periodId!);

  if (error) {
    return {
      ok: false,
      summary: "Nu am putut șterge concediul.",
      error: error.message,
    };
  }

  return {
    ok: true,
    summary: `Concediul a fost șters${
      from && to ? ` (${from} → ${to})` : ""
    }. Zilele revin la programul normal.`,
    data: proposal,
  };
}
