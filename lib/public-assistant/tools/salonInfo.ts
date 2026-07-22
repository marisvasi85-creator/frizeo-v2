import { formatLocationAddress, resolveLocation } from "@/lib/location/resolveLocation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PublicToolContext, PublicToolResult } from "../types";

export async function salonInfoTool(
  _args: Record<string, unknown>,
  ctx: PublicToolContext,
): Promise<PublicToolResult> {
  const { data: tenant, error } = await supabaseAdmin
    .from("tenants")
    .select("*")
    .eq("id", ctx.tenantId)
    .maybeSingle();

  if (error || !tenant) {
    return {
      ok: false,
      summary: "Nu am putut încărca info salon.",
      error: error?.message || "not_found",
    };
  }

  const location = resolveLocation(tenant);
  const address = formatLocationAddress(tenant) || tenant.address || null;

  return {
    ok: true,
    summary: `${tenant.name}: ${tenant.phone || "fără telefon"}${
      address ? ` · ${address}` : ""
    }.`,
    data: {
      name: tenant.name,
      slug: tenant.slug,
      phone: tenant.phone || null,
      description: tenant.description || null,
      address,
      has_map: Boolean(location?.latitude && location?.longitude),
      booking_path: `/booking/salon/${tenant.slug}`,
    },
  };
}
