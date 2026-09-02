import { getBarberScheduleMode } from "@/lib/schedule/getBarberScheduleMode";
import { toDBTime } from "@/lib/schedule/time";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AssistantToolContext, AssistantToolResult } from "../types";
import {
  asBoolean,
  asNumber,
  asString,
  normalizeTime,
  resolveBarberFromArgs,
} from "./helpers";

const DAY_LABELS: Record<number, string> = {
  1: "Luni",
  2: "Marți",
  3: "Miercuri",
  4: "Joi",
  5: "Vineri",
  6: "Sâmbătă",
  7: "Duminică",
};

const DAY_ALIASES: Record<string, number> = {
  luni: 1,
  monday: 1,
  "1": 1,
  marti: 2,
  marți: 2,
  tuesday: 2,
  "2": 2,
  miercuri: 3,
  wednesday: 3,
  "3": 3,
  joi: 4,
  thursday: 4,
  "4": 4,
  vineri: 5,
  friday: 5,
  "5": 5,
  sambata: 6,
  sâmbătă: 6,
  sâmbata: 6,
  saturday: 6,
  "6": 6,
  duminica: 7,
  duminică: 7,
  sunday: 7,
  "7": 7,
};

function fold(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function parseDayOfWeek(args: Record<string, unknown>): number | null {
  const numeric = asNumber(args.day_of_week);
  if (numeric != null && numeric >= 1 && numeric <= 7) {
    return Math.round(numeric);
  }

  const raw =
    asString(args.day_of_week) ||
    asString(args.day) ||
    asString(args.weekday);
  if (!raw) return null;

  return DAY_ALIASES[fold(raw)] ?? null;
}

function formatDay(row: {
  day_of_week: number;
  is_working: boolean;
  work_start: string | null;
  work_end: string | null;
  break_enabled: boolean;
  break_start: string | null;
  break_end: string | null;
}) {
  const label = DAY_LABELS[row.day_of_week] || `Ziua ${row.day_of_week}`;
  if (!row.is_working) {
    return `${label}: închis`;
  }
  const start = row.work_start?.slice(0, 5) || "?";
  const end = row.work_end?.slice(0, 5) || "?";
  const brk =
    row.break_enabled && row.break_start && row.break_end
      ? `, pauză ${row.break_start.slice(0, 5)}–${row.break_end.slice(0, 5)}`
      : "";
  return `${label}: ${start}–${end}${brk}`;
}

export async function listWeeklyScheduleTool(
  args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const target = await resolveBarberFromArgs(ctx, args);
  if (!target.ok) return target.result;

  const [{ data, error }, mode] = await Promise.all([
    supabaseAdmin
      .from("barber_weekly_schedule")
      .select(
        "day_of_week, is_working, work_start, work_end, break_enabled, break_start, break_end",
      )
      .eq("barber_id", target.barberId)
      .order("day_of_week", { ascending: true }),
    getBarberScheduleMode(target.barberId),
  ]);

  if (error) {
    return {
      ok: false,
      summary: "Nu am putut citi programul săptămânal.",
      error: error.message,
    };
  }

  const byDay = new Map((data ?? []).map((row) => [row.day_of_week, row]));
  const days = [1, 2, 3, 4, 5, 6, 7].map((day) => {
    const row = byDay.get(day);
    return {
      day_of_week: day,
      label: DAY_LABELS[day],
      is_working: Boolean(row?.is_working),
      work_start: row?.work_start?.slice(0, 5) ?? null,
      work_end: row?.work_end?.slice(0, 5) ?? null,
      break_enabled: Boolean(row?.break_enabled),
      break_start: row?.break_start?.slice(0, 5) ?? null,
      break_end: row?.break_end?.slice(0, 5) ?? null,
    };
  });

  const lines = days.map(formatDay).join("; ");
  const modeNote =
    mode === "selective"
      ? " ATENȚIE: programul e pe mod selectiv — orarul L–D nu deschide sloturi până treci pe săptămânal în /admin/settings."
      : "";

  return {
    ok: true,
    summary: `Program săptămânal (${mode}): ${lines}.${modeNote}`,
    data: {
      schedule_mode: mode,
      admin_path: "/admin/settings",
      days,
    },
  };
}

export async function updateWeeklyScheduleTool(
  args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const dayOfWeek = parseDayOfWeek(args);
  if (!dayOfWeek) {
    return {
      ok: false,
      summary:
        "Specifică ziua (day_of_week 1=Luni … 7=Duminică, sau „luni”, „sâmbătă”). Uneltează o zi pe rând.",
      error: "missing_day",
    };
  }

  const target = await resolveBarberFromArgs(ctx, args);
  if (!target.ok) return target.result;

  const { data: existing } = await supabaseAdmin
    .from("barber_weekly_schedule")
    .select(
      "day_of_week, is_working, work_start, work_end, break_enabled, break_start, break_end",
    )
    .eq("barber_id", target.barberId)
    .eq("day_of_week", dayOfWeek)
    .maybeSingle();

  const isWorkingArg =
    args.is_working === undefined ? null : asBoolean(args.is_working);
  const isWorking = isWorkingArg ?? existing?.is_working ?? true;

  const workStartRaw =
    asString(args.work_start) || asString(args.start) || existing?.work_start;
  const workEndRaw =
    asString(args.work_end) || asString(args.end) || existing?.work_end;
  const breakEnabledArg =
    args.break_enabled === undefined ? null : asBoolean(args.break_enabled);
  const breakEnabled = isWorking
    ? (breakEnabledArg ?? existing?.break_enabled ?? false)
    : false;
  const breakStartRaw = breakEnabled
    ? asString(args.break_start) || existing?.break_start
    : null;
  const breakEndRaw = breakEnabled
    ? asString(args.break_end) || existing?.break_end
    : null;

  if (isWorking && (!workStartRaw || !workEndRaw)) {
    return {
      ok: false,
      summary: `Pentru ${DAY_LABELS[dayOfWeek]} trebuie work_start și work_end (HH:MM).`,
      error: "missing_hours",
    };
  }

  const work_start = isWorking ? normalizeTime(String(workStartRaw)) : null;
  const work_end = isWorking ? normalizeTime(String(workEndRaw)) : null;
  const break_start =
    isWorking && breakEnabled && breakStartRaw
      ? normalizeTime(String(breakStartRaw))
      : null;
  const break_end =
    isWorking && breakEnabled && breakEndRaw
      ? normalizeTime(String(breakEndRaw))
      : null;

  if (isWorking && work_start && work_end && work_start >= work_end) {
    return {
      ok: false,
      summary: "Ora de început trebuie să fie înainte de ora de sfârșit.",
      error: "invalid_hours",
    };
  }

  const mode = await getBarberScheduleMode(target.barberId);
  const next = {
    day_of_week: dayOfWeek,
    is_working: isWorking,
    work_start,
    work_end,
    break_enabled: Boolean(isWorking && breakEnabled && break_start && break_end),
    break_start: breakEnabled ? break_start : null,
    break_end: breakEnabled ? break_end : null,
  };

  const confirmed = asBoolean(args.confirmed);
  const summaryLine = formatDay(next);
  const selectiveNote =
    mode === "selective"
      ? " Programul e selectiv — orarul L–D nu deschide sloturi până treci pe săptămânal în /admin/settings."
      : "";

  if (!confirmed) {
    return {
      ok: true,
      summary: `Confirmare necesară: ${summaryLine}.${selectiveNote}`,
      data: {
        needs_confirmation: true,
        action: "update_weekly_schedule",
        proposal: next,
        schedule_mode: mode,
        instruct_user:
          "Prezintă propunerea. Utilizatorul confirmă din butoane (nu seta confirmed=true).",
      },
    };
  }

  const row = {
    barber_id: target.barberId,
    tenant_id: ctx.tenantId,
    day_of_week: dayOfWeek,
    is_working: isWorking,
    work_start: isWorking ? toDBTime(work_start) : null,
    work_end: isWorking ? toDBTime(work_end) : null,
    break_enabled: next.break_enabled,
    break_start: next.break_enabled ? toDBTime(break_start) : null,
    break_end: next.break_enabled ? toDBTime(break_end) : null,
  };

  const write = existing
    ? await supabaseAdmin
        .from("barber_weekly_schedule")
        .update(row)
        .eq("barber_id", target.barberId)
        .eq("day_of_week", dayOfWeek)
    : await supabaseAdmin.from("barber_weekly_schedule").insert(row);

  if (write.error) {
    return {
      ok: false,
      summary: "Nu am putut salva programul săptămânal.",
      error: write.error.message,
    };
  }

  return {
    ok: true,
    summary: `Am salvat: ${summaryLine}.${selectiveNote}`,
    data: { ...next, schedule_mode: mode, admin_path: "/admin/settings" },
  };
}
