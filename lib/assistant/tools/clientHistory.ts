import {
  addDaysToDateString,
  getTodayInBookingTimezone,
} from "@/lib/bookings/bookingTimezone";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AssistantToolContext, AssistantToolResult } from "../types";
import {
  asNumber,
  asString,
  phoneVariants,
  resolveOptionalBarberFilter,
} from "./helpers";

export async function clientHistoryTool(
  args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const phone = asString(args.client_phone) || asString(args.phone);
  const name = asString(args.client_name) || asString(args.name);
  const limit = Math.min(Math.max(asNumber(args.limit) ?? 10, 1), 30);

  if (!phone && !name) {
    return {
      ok: false,
      summary: "Specifică telefonul sau numele clientului.",
      error: "missing_lookup",
    };
  }

  const resolved = await resolveOptionalBarberFilter(ctx, args);
  if (!resolved.ok) return resolved.result;
  let barberIds = resolved.barberIds;
  if (ctx.role !== "barber" && !asString(args.barber_id) && !asString(args.barber_name) && !asString(args.barber)) {
    const { data } = await supabaseAdmin
      .from("barbers")
      .select("id")
      .eq("tenant_id", ctx.tenantId);
    barberIds = (data ?? []).map((b) => b.id);
  }

  if (barberIds.length === 0) {
    return { ok: true, summary: "Nu există frizeri.", data: { bookings: [] } };
  }

  const today = getTodayInBookingTimezone();
  const from = addDaysToDateString(today, -365);

  let query = supabaseAdmin
    .from("bookings")
    .select(
      "id, date, start_time, end_time, status, client_name, client_phone, barber_id, barber_service_id",
    )
    .in("barber_id", barberIds)
    .gte("date", from)
    .order("date", { ascending: false })
    .order("start_time", { ascending: false })
    .limit(80);

  if (phone) {
    const variants = phoneVariants(phone);
    query = query.in("client_phone", variants);
  } else if (name) {
    query = query.ilike("client_name", `%${name}%`);
  }

  const { data, error } = await query;
  if (error) {
    return {
      ok: false,
      summary: "Nu am putut încărca istoricul.",
      error: error.message,
    };
  }

  const rows = (data ?? []).slice(0, limit);
  if (rows.length === 0) {
    return {
      ok: true,
      summary: phone
        ? `Nicio programare găsită pentru ${phone} în ultimul an.`
        : `Nicio programare găsită pentru „${name}".`,
      data: { bookings: [] },
    };
  }

  const serviceIds = [
    ...new Set(rows.map((b) => b.barber_service_id).filter(Boolean)),
  ] as string[];
  const { data: services } = serviceIds.length
    ? await supabaseAdmin
        .from("barber_services")
        .select("id, display_name, name")
        .in("id", serviceIds)
    : { data: [] as { id: string; display_name: string | null; name: string }[] };
  const servicesById = new Map((services ?? []).map((s) => [s.id, s]));

  const bookings = rows.map((b) => ({
    date: b.date,
    start_time: String(b.start_time).slice(0, 5),
    status: b.status,
    client_name: b.client_name,
    client_phone: b.client_phone,
    service_name: b.barber_service_id
      ? servicesById.get(b.barber_service_id)?.display_name ||
        servicesById.get(b.barber_service_id)?.name ||
        null
      : null,
  }));

  const cancelled = bookings.filter((b) => b.status === "cancelled").length;
  const label = bookings[0].client_name || phone || name;

  return {
    ok: true,
    summary: `${label}: ${bookings.length} programări în istoric (${cancelled} anulate). Fără sume / încasări.`,
    data: {
      client_name: bookings[0].client_name,
      client_phone: bookings[0].client_phone,
      count: bookings.length,
      cancelled,
      bookings,
    },
  };
}
