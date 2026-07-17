import {
  addDaysToDateString,
  getTodayInBookingTimezone,
} from "@/lib/bookings/bookingTimezone";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AssistantToolContext, AssistantToolResult } from "../types";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function resolveBarberIds(
  ctx: AssistantToolContext,
  barberIdArg: string | null,
): Promise<{ barberIds: string[]; error?: string }> {
  if (ctx.role === "barber") {
    if (!ctx.barberId) {
      return { barberIds: [], error: "Nu am găsit profilul de frizer." };
    }
    return { barberIds: [ctx.barberId] };
  }

  if (barberIdArg) {
    const { data } = await supabaseAdmin
      .from("barbers")
      .select("id")
      .eq("id", barberIdArg)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();

    if (!data) {
      return { barberIds: [], error: "Frizerul nu aparține salonului." };
    }
    return { barberIds: [data.id] };
  }

  const { data: tenantBarbers } = await supabaseAdmin
    .from("barbers")
    .select("id")
    .eq("tenant_id", ctx.tenantId);

  return { barberIds: (tenantBarbers ?? []).map((b) => b.id) };
}

function resolveDateRange(range: string | null, from: string | null, to: string | null) {
  const today = getTodayInBookingTimezone();

  if (from && to) {
    return { from, to };
  }

  switch (range) {
    case "tomorrow": {
      const tomorrow = addDaysToDateString(today, 1);
      return { from: tomorrow, to: tomorrow };
    }
    case "week":
      return { from: today, to: addDaysToDateString(today, 6) };
    case "today":
    default:
      return { from: today, to: today };
  }
}

export async function listBookingsTool(
  args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const range = asString(args.range);
  const from = asString(args.from_date);
  const to = asString(args.to_date);
  const barberIdArg = asString(args.barber_id);
  const { from: startDate, to: endDate } = resolveDateRange(range, from, to);

  const resolved = await resolveBarberIds(ctx, barberIdArg);
  if (resolved.error) {
    return { ok: false, summary: resolved.error, error: resolved.error };
  }
  if (resolved.barberIds.length === 0) {
    return { ok: true, summary: "Nu există frizeri în salon.", data: { bookings: [] } };
  }

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, date, start_time, end_time, status, client_name, client_phone, barber_id, barber_service_id",
    )
    .in("barber_id", resolved.barberIds)
    .neq("status", "cancelled")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(50);

  if (error) {
    return { ok: false, summary: "Nu am putut încărca programările.", error: error.message };
  }

  const bookings = data ?? [];
  const serviceIds = [
    ...new Set(bookings.map((b) => b.barber_service_id).filter(Boolean)),
  ] as string[];
  const barberIds = [...new Set(bookings.map((b) => b.barber_id).filter(Boolean))] as string[];

  const [servicesRes, barbersRes] = await Promise.all([
    serviceIds.length
      ? supabaseAdmin
          .from("barber_services")
          .select("id, display_name, name, duration")
          .in("id", serviceIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string | null; name: string; duration: number }[] }),
    barberIds.length
      ? supabaseAdmin
          .from("barbers")
          .select("id, display_name")
          .in("id", barberIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string | null }[] }),
  ]);

  const servicesById = new Map((servicesRes.data ?? []).map((s) => [s.id, s]));
  const barbersById = new Map((barbersRes.data ?? []).map((b) => [b.id, b]));

  const enriched = bookings.map((b) => {
    const service = b.barber_service_id
      ? servicesById.get(b.barber_service_id)
      : null;
    const barber = b.barber_id ? barbersById.get(b.barber_id) : null;
    return {
      id: b.id,
      date: b.date,
      start_time: String(b.start_time).slice(0, 5),
      end_time: String(b.end_time).slice(0, 5),
      status: b.status,
      client_name: b.client_name,
      client_phone: b.client_phone,
      service_name: service?.display_name || service?.name || null,
      duration_minutes: service?.duration ?? null,
      barber_name: barber?.display_name || null,
    };
  });

  const label =
    startDate === endDate
      ? `Programări pe ${startDate}`
      : `Programări ${startDate} → ${endDate}`;

  return {
    ok: true,
    summary: `${label}: ${enriched.length} găsite.`,
    data: { from: startDate, to: endDate, count: enriched.length, bookings: enriched },
  };
}
