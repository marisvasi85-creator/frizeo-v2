import {
  addDaysToDateString,
  getTodayInBookingTimezone,
} from "@/lib/bookings/bookingTimezone";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AssistantToolContext, AssistantToolResult } from "../types";
import {
  asBoolean,
  asNumber,
  asString,
  phoneVariants,
  resolveOptionalBarberFilter,
} from "./helpers";

function resolveDateRange(
  range: string | null,
  from: string | null,
  to: string | null,
  searchingClient: boolean,
) {
  const today = getTodayInBookingTimezone();

  if (from && to) {
    return { from, to };
  }
  if (from && !to) {
    return { from, to: from };
  }

  if (searchingClient && !range) {
    return {
      from: addDaysToDateString(today, -90),
      to: addDaysToDateString(today, 30),
    };
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
  const from = asString(args.from_date) || asString(args.date);
  const to = asString(args.to_date);
  const phone = asString(args.client_phone) || asString(args.phone);
  const name = asString(args.client_name) || asString(args.name);
  const includeCancelled = asBoolean(args.include_cancelled);
  const searchingClient = Boolean(phone || name);
  const { from: startDate, to: endDate } = resolveDateRange(
    range,
    from,
    to,
    searchingClient,
  );
  const limit = Math.min(
    Math.max(asNumber(args.limit) ?? (searchingClient ? 40 : 50), 1),
    100,
  );

  const resolved = await resolveOptionalBarberFilter(ctx, args);
  if (!resolved.ok) return resolved.result;
  if (resolved.barberIds.length === 0) {
    return { ok: true, summary: "Nu există frizeri în salon.", data: { bookings: [] } };
  }

  let query = supabaseAdmin
    .from("bookings")
    .select(
      "id, date, start_time, end_time, status, client_name, client_phone, barber_id, barber_service_id",
    )
    .in("barber_id", resolved.barberIds)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(limit);

  if (!includeCancelled) {
    query = query.neq("status", "cancelled");
  }

  if (phone) {
    query = query.in("client_phone", phoneVariants(phone));
  } else if (name) {
    query = query.ilike("client_name", `%${name}%`);
  }

  const { data, error } = await query;

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
  const extra = [
    phone ? `telefon ${phone}` : null,
    name ? `nume „${name}"` : null,
    includeCancelled ? "inclusiv anulate" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    ok: true,
    summary: `${label}${extra ? ` (${extra})` : ""}: ${enriched.length} găsite.`,
    data: {
      from: startDate,
      to: endDate,
      count: enriched.length,
      include_cancelled: includeCancelled,
      bookings: enriched,
    },
  };
}
