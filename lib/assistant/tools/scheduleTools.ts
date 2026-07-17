import { randomUUID } from "crypto";
import {
  addDaysToDateString,
  getTodayInBookingTimezone,
} from "@/lib/bookings/bookingTimezone";
import { enumerateDateRange } from "@/lib/schedule/vacationPeriods";
import {
  barberOverridesSupportVacationPeriodId,
  isMissingVacationPeriodColumnError,
} from "@/lib/supabase/barberOverrideSchema";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AssistantToolContext, AssistantToolResult } from "../types";
import { asBoolean, asString, resolveTargetBarberId } from "./helpers";

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

  const resolved = await resolveTargetBarberId(ctx, asString(args.barber_id));
  if (resolved.error || !resolved.barberId) {
    return {
      ok: false,
      summary: resolved.error || "Frizer lipsă",
      error: resolved.error,
    };
  }

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
          "Cere confirmare. Dacă acceptă, apelează close_day din nou cu confirmed=true.",
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

export async function createVacationTool(
  args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const dateFrom = asString(args.date_from) || asString(args.from);
  const dateTo = asString(args.date_to) || asString(args.to);
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

  const resolved = await resolveTargetBarberId(ctx, asString(args.barber_id));
  if (resolved.error || !resolved.barberId) {
    return {
      ok: false,
      summary: resolved.error || "Frizer lipsă",
      error: resolved.error,
    };
  }

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
          "Cere confirmare. Dacă acceptă, apelează create_vacation din nou cu confirmed=true.",
      },
    };
  }

  const supportsPeriodId = await barberOverridesSupportVacationPeriodId(
    supabaseAdmin,
  );
  const vacationPeriodId = supportsPeriodId ? randomUUID() : undefined;

  const rows = dates.map((date) => ({
    barber_id: resolved.barberId!,
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
      const { vacation_period_id, ...rest } = row;
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
