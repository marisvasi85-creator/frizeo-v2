import { getBarberMinNoticeHours } from "@/lib/bookings/bookingLeadTime";
import {
  addDaysToDateString,
  getTodayInBookingTimezone,
} from "@/lib/bookings/bookingTimezone";
import { getActiveBookings } from "@/lib/schedule/bookings";
import { generatePublicFreeSlots } from "@/lib/schedule/generatePublicFreeSlots";
import { resolveDaySchedule } from "@/lib/schedule/resolveDaySchedule";
import { jsDayToScheduleDay } from "@/lib/schedule/time";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AssistantToolContext, AssistantToolResult } from "../types";
import {
  asNumber,
  asString,
  resolveServiceForBarber,
  resolveTargetBarberId,
} from "./helpers";

function resolveDate(args: Record<string, unknown>): string | null {
  const date = asString(args.date);
  if (date) return date;

  const when = asString(args.when)?.toLowerCase();
  const today = getTodayInBookingTimezone();
  if (when === "today") return today;
  if (when === "tomorrow") return addDaysToDateString(today, 1);
  return null;
}

export async function findSlotsTool(
  args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const date = resolveDate(args);
  if (!date) {
    return {
      ok: false,
      summary: "Specifică date=YYYY-MM-DD sau when=today|tomorrow.",
      error: "missing_date",
    };
  }

  const target = await resolveTargetBarberId(ctx, asString(args.barber_id));
  if (!target.barberId) {
    return {
      ok: false,
      summary: target.error || "Nu am găsit frizerul.",
      error: "missing_barber",
    };
  }

  const service = await resolveServiceForBarber(
    target.barberId,
    ctx.tenantId,
    asString(args.service_id) || asString(args.barber_service_id),
    asString(args.service_name),
  );

  if (!service.ok) {
    return {
      ok: false,
      summary: service.summary,
      error: service.error,
    };
  }

  const limit = Math.min(Math.max(asNumber(args.limit) ?? 12, 1), 40);

  const day = jsDayToScheduleDay(date);
  const [{ data: schedule }, { data: override }, { data: bookings }, { data: barber }] =
    await Promise.all([
      supabaseAdmin
        .from("barber_weekly_schedule")
        .select("*")
        .eq("barber_id", target.barberId)
        .eq("day_of_week", day)
        .maybeSingle(),
      supabaseAdmin
        .from("barber_day_overrides")
        .select("*")
        .eq("barber_id", target.barberId)
        .eq("date", date)
        .maybeSingle(),
      supabaseAdmin
        .from("bookings")
        .select("id, start_time, end_time, status, expires_at")
        .eq("barber_id", target.barberId)
        .eq("date", date)
        .in("status", ["confirmed", "pending"]),
      supabaseAdmin
        .from("barbers")
        .select("id, display_name")
        .eq("id", target.barberId)
        .maybeSingle(),
    ]);

  const resolved = resolveDaySchedule(schedule, override);
  if (!resolved.isWorking) {
    return {
      ok: true,
      summary: `${barber?.display_name || "Frizerul"} nu lucrează pe ${date}.`,
      data: {
        date,
        barber_id: target.barberId,
        barber_name: barber?.display_name || null,
        service_name:
          service.service.display_name || service.service.name || null,
        free_slots: [],
        closed: true,
      },
    };
  }

  const minNoticeHours = await getBarberMinNoticeHours(
    supabaseAdmin,
    target.barberId,
  );

  const freeSlots = generatePublicFreeSlots({
    date,
    resolved,
    duration: service.service.duration,
    bookings: getActiveBookings(bookings),
    googleBusyIntervals: [],
    minNoticeHours,
    bypassMinNotice: true,
    ignoreGoogleBusy: true,
  });

  const slots = freeSlots.slice(0, limit);
  const serviceName =
    service.service.display_name || service.service.name || "Serviciu";

  return {
    ok: true,
    summary:
      slots.length === 0
        ? `Nu sunt sloturi libere pe ${date} pentru ${serviceName}.`
        : `${slots.length} sloturi libere pe ${date} pentru ${serviceName}: ${slots.join(", ")}.`,
    data: {
      date,
      barber_id: target.barberId,
      barber_name: barber?.display_name || null,
      service_id: service.service.id,
      service_name: serviceName,
      duration_minutes: service.service.duration,
      free_slots: slots,
      total_free: freeSlots.length,
      truncated: freeSlots.length > slots.length,
    },
  };
}
