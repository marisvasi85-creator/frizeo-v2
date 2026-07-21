import {
  addDaysToDateString,
  getTodayInBookingTimezone,
} from "@/lib/bookings/bookingTimezone";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AssistantToolContext, AssistantToolResult } from "../types";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function popularServicesTool(
  args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const days = Math.min(asNumber(args.days, 30), 180);
  const limit = Math.min(asNumber(args.limit, 5), 20);
  const barberIdArg = asString(args.barber_id);

  let barberIds: string[] = [];
  if (ctx.role === "barber") {
    if (!ctx.barberId) {
      return {
        ok: false,
        summary: "Nu am găsit profilul de frizer.",
        error: "missing_barber",
      };
    }
    barberIds = [ctx.barberId];
  } else if (barberIdArg) {
    const { data } = await supabaseAdmin
      .from("barbers")
      .select("id")
      .eq("id", barberIdArg)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();
    if (!data) {
      return {
        ok: false,
        summary: "Frizerul nu aparține salonului.",
        error: "invalid_barber",
      };
    }
    barberIds = [data.id];
  } else {
    const { data } = await supabaseAdmin
      .from("barbers")
      .select("id")
      .eq("tenant_id", ctx.tenantId);
    barberIds = (data ?? []).map((b) => b.id);
  }

  if (barberIds.length === 0) {
    return { ok: true, summary: "Nu există date.", data: { services: [] } };
  }

  const today = getTodayInBookingTimezone();
  const from = addDaysToDateString(today, -(days - 1));

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("barber_service_id")
    .in("barber_id", barberIds)
    .eq("status", "confirmed")
    .gte("date", from)
    .lte("date", today)
    .not("barber_service_id", "is", null);

  if (error) {
    return {
      ok: false,
      summary: "Nu am putut calcula popularitatea serviciilor.",
      error: error.message,
    };
  }

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const id = row.barber_service_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  if (ranked.length === 0) {
    return {
      ok: true,
      summary: `Nicio programare confirmată în ultimele ${days} zile.`,
      data: { days, from, to: today, services: [] },
    };
  }

  const serviceIds = ranked.map(([id]) => id);
  const { data: services } = await supabaseAdmin
    .from("barber_services")
    .select("id, display_name, name, duration, price, show_price")
    .in("id", serviceIds);

  const byId = new Map((services ?? []).map((s) => [s.id, s]));

  const popular = ranked.map(([id, bookingCount], index) => {
    const service = byId.get(id);
    const showPrice = Boolean(service?.show_price) && service?.price != null;
    return {
      rank: index + 1,
      service_id: id,
      name: service?.display_name || service?.name || "Serviciu",
      duration_minutes: service?.duration ?? null,
      price_ron: showPrice ? service?.price : null,
      booking_count: bookingCount,
    };
  });

  return {
    ok: true,
    summary: `Top ${popular.length} servicii pe ${days} zile.`,
    data: { days, from, to: today, services: popular },
  };
}
