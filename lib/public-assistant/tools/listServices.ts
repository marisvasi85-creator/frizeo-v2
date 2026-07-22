import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PublicToolContext, PublicToolResult } from "../types";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function listServicesTool(
  args: Record<string, unknown>,
  ctx: PublicToolContext,
): Promise<PublicToolResult> {
  const barberSlug = asString(args.barber_slug)?.toLowerCase();
  const barberName = asString(args.barber_name);

  let barberIds: string[] = [];
  let scopeLabel = "salon";

  if (ctx.barberId && !barberSlug && !barberName) {
    barberIds = [ctx.barberId];
    scopeLabel = ctx.barberName || "frizerul curent";
  } else if (barberSlug || barberName) {
    let query = supabaseAdmin
      .from("barbers")
      .select("id, display_name")
      .eq("tenant_id", ctx.tenantId)
      .eq("active", true);
    if (barberSlug) query = query.eq("slug", barberSlug);
    else if (barberName) query = query.ilike("display_name", `%${barberName}%`);
    const { data } = await query.limit(3);
    if (!data?.length) {
      return {
        ok: false,
        summary: "Nu am găsit frizerul cerut.",
        error: "barber_not_found",
      };
    }
    barberIds = [data[0].id];
    scopeLabel = data[0].display_name || "frizer";
  } else {
    const { data } = await supabaseAdmin
      .from("barbers")
      .select("id")
      .eq("tenant_id", ctx.tenantId)
      .eq("active", true);
    barberIds = (data ?? []).map((b) => b.id);
  }

  if (!barberIds.length) {
    return { ok: true, summary: "Nu există frizeri activi.", data: { services: [] } };
  }

  const { data, error } = await supabaseAdmin
    .from("barber_services")
    .select(
      "id, barber_id, name, display_name, duration, price, show_price, featured, sort_order",
    )
    .in("barber_id", barberIds)
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    return {
      ok: false,
      summary: "Nu am putut încărca serviciile.",
      error: error.message,
    };
  }

  const ids = [...new Set((data ?? []).map((s) => s.barber_id))];
  const { data: barbers } = await supabaseAdmin
    .from("barbers")
    .select("id, display_name")
    .in("id", ids);
  const nameById = new Map((barbers ?? []).map((b) => [b.id, b.display_name]));

  const services = (data ?? []).map((s) => {
    const showPrice = Boolean(s.show_price) && s.price != null;
    return {
      name: s.display_name || s.name,
      duration_minutes: s.duration,
      price_ron: showPrice ? s.price : null,
      featured: Boolean(s.featured),
      barber_name: nameById.get(s.barber_id) || null,
      // id only for find_slots — don't emphasize in reply
      service_id: s.id,
      barber_id: s.barber_id,
    };
  });

  return {
    ok: true,
    summary: `${services.length} servicii active (${scopeLabel}).`,
    data: { count: services.length, services },
  };
}
