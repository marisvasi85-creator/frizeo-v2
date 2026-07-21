import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AssistantToolContext, AssistantToolResult } from "../types";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

export async function listServicesTool(
  args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const barberIdArg = asString(args.barber_id);
  const includeInactive = asBoolean(args.include_inactive, false);

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
    return { ok: true, summary: "Nu există frizeri.", data: { services: [] } };
  }

  let query = supabaseAdmin
    .from("barber_services")
    .select(
      "id, barber_id, name, display_name, duration, price, show_price, active, featured, sort_order",
    )
    .in("barber_id", barberIds)
    .order("sort_order", { ascending: true });

  if (!includeInactive) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;
  if (error) {
    return { ok: false, summary: "Nu am putut încărca serviciile.", error: error.message };
  }

  const barberNameIds = [...new Set((data ?? []).map((s) => s.barber_id))];
  const { data: barbers } = await supabaseAdmin
    .from("barbers")
    .select("id, display_name")
    .in("id", barberNameIds);
  const barbersById = new Map((barbers ?? []).map((b) => [b.id, b.display_name]));

  const services = (data ?? []).map((s) => {
    const showPrice = Boolean(s.show_price) && s.price != null;
    return {
      id: s.id,
      name: s.display_name || s.name,
      duration_minutes: s.duration,
      // Prețul e opțional — îl includem doar dacă e setat și vizibil.
      price_ron: showPrice ? s.price : null,
      price_set: s.price != null,
      show_price: Boolean(s.show_price),
      active: Boolean(s.active),
      featured: Boolean(s.featured),
      barber_name: barbersById.get(s.barber_id) || null,
    };
  });

  return {
    ok: true,
    summary: `${services.length} servicii găsite.`,
    data: { count: services.length, services },
  };
}
