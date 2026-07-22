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
import type { PublicToolContext, PublicToolResult } from "../types";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function resolveDate(args: Record<string, unknown>): string | null {
  const date = asString(args.date);
  if (date) return date;
  const when = asString(args.when)?.toLowerCase();
  const today = getTodayInBookingTimezone();
  if (when === "today") return today;
  if (when === "tomorrow") return addDaysToDateString(today, 1);
  return null;
}

async function resolveBarberId(
  ctx: PublicToolContext,
  args: Record<string, unknown>,
): Promise<{ barberId: string; barberName: string | null } | null> {
  const barberIdArg = asString(args.barber_id);
  const barberSlug = asString(args.barber_slug)?.toLowerCase();
  const barberName = asString(args.barber_name);

  if (barberIdArg) {
    const { data } = await supabaseAdmin
      .from("barbers")
      .select("id, display_name")
      .eq("id", barberIdArg)
      .eq("tenant_id", ctx.tenantId)
      .eq("active", true)
      .maybeSingle();
    if (!data) return null;
    return { barberId: data.id, barberName: data.display_name };
  }

  if (barberSlug || barberName) {
    let query = supabaseAdmin
      .from("barbers")
      .select("id, display_name")
      .eq("tenant_id", ctx.tenantId)
      .eq("active", true);
    if (barberSlug) query = query.eq("slug", barberSlug);
    else query = query.ilike("display_name", `%${barberName}%`);
    const { data } = await query.limit(1).maybeSingle();
    if (!data) return null;
    return { barberId: data.id, barberName: data.display_name };
  }

  if (ctx.barberId) {
    return { barberId: ctx.barberId, barberName: ctx.barberName };
  }

  // Single active barber salon → use that one
  const { data: barbers } = await supabaseAdmin
    .from("barbers")
    .select("id, display_name")
    .eq("tenant_id", ctx.tenantId)
    .eq("active", true)
    .limit(2);
  if (barbers?.length === 1) {
    return { barberId: barbers[0].id, barberName: barbers[0].display_name };
  }

  return null;
}

async function resolveService(
  barberId: string,
  tenantId: string,
  serviceId: string | null,
  serviceName: string | null,
) {
  if (serviceId) {
    const { data } = await supabaseAdmin
      .from("barber_services")
      .select("id, name, display_name, duration, price, show_price")
      .eq("id", serviceId)
      .eq("barber_id", barberId)
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .maybeSingle();
    return data;
  }

  if (serviceName) {
    const { data } = await supabaseAdmin
      .from("barber_services")
      .select("id, name, display_name, duration, price, show_price")
      .eq("barber_id", barberId)
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .or(
        `display_name.ilike.%${serviceName}%,name.ilike.%${serviceName}%`,
      )
      .limit(1)
      .maybeSingle();
    return data;
  }

  // Default: first featured/active service
  const { data } = await supabaseAdmin
    .from("barber_services")
    .select("id, name, display_name, duration, price, show_price")
    .eq("barber_id", barberId)
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .order("featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function findSlotsTool(
  args: Record<string, unknown>,
  ctx: PublicToolContext,
): Promise<PublicToolResult> {
  const date = resolveDate(args);
  if (!date) {
    return {
      ok: false,
      summary: "Specifică date=YYYY-MM-DD sau when=today|tomorrow.",
      error: "missing_date",
    };
  }

  const barber = await resolveBarberId(ctx, args);
  if (!barber) {
    return {
      ok: false,
      summary:
        "Alege un frizer (sau deschide pagina unui frizer) ca să-ți arăt orele libere.",
      error: "missing_barber",
    };
  }

  const service = await resolveService(
    barber.barberId,
    ctx.tenantId,
    asString(args.service_id),
    asString(args.service_name),
  );

  if (!service) {
    return {
      ok: false,
      summary: "Nu am găsit un serviciu activ pentru acest frizer.",
      error: "missing_service",
    };
  }

  const limit = Math.min(Math.max(asNumber(args.limit) ?? 12, 1), 24);
  const day = jsDayToScheduleDay(date);

  const [{ data: schedule }, { data: override }, { data: bookings }] =
    await Promise.all([
      supabaseAdmin
        .from("barber_weekly_schedule")
        .select("*")
        .eq("barber_id", barber.barberId)
        .eq("day_of_week", day)
        .maybeSingle(),
      supabaseAdmin
        .from("barber_day_overrides")
        .select("*")
        .eq("barber_id", barber.barberId)
        .eq("date", date)
        .maybeSingle(),
      supabaseAdmin
        .from("bookings")
        .select("id, start_time, end_time, status, expires_at")
        .eq("barber_id", barber.barberId)
        .eq("date", date)
        .in("status", ["confirmed", "pending"]),
    ]);

  const resolved = resolveDaySchedule(schedule, override);
  const serviceName = service.display_name || service.name;

  if (!resolved.isWorking) {
    return {
      ok: true,
      summary: `${barber.barberName || "Frizerul"} nu lucrează pe ${date}.`,
      data: {
        date,
        barber_name: barber.barberName,
        service_name: serviceName,
        free_slots: [],
        closed: true,
      },
    };
  }

  const minNoticeHours = await getBarberMinNoticeHours(
    supabaseAdmin,
    barber.barberId,
  );

  const freeSlots = generatePublicFreeSlots({
    date,
    resolved,
    duration: service.duration,
    bookings: getActiveBookings(bookings ?? []),
    googleBusyIntervals: [],
    minNoticeHours,
    ignoreGoogleBusy: true,
  }).slice(0, limit);

  return {
    ok: true,
    summary: freeSlots.length
      ? `${barber.barberName}: ${freeSlots.length} ore libere pe ${date} pentru ${serviceName}.`
      : `${barber.barberName}: nicio oră liberă pe ${date} pentru ${serviceName}.`,
    data: {
      date,
      barber_name: barber.barberName,
      service_name: serviceName,
      duration_minutes: service.duration,
      free_slots: freeSlots,
      closed: false,
    },
  };
}
