import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PublicToolContext, PublicToolResult } from "../types";

export async function listBarbersTool(
  _args: Record<string, unknown>,
  ctx: PublicToolContext,
): Promise<PublicToolResult> {
  const { data, error } = await supabaseAdmin
    .from("barbers")
    .select("id, display_name, slug, bio, active")
    .eq("tenant_id", ctx.tenantId)
    .eq("active", true)
    .order("display_name");

  if (error) {
    return {
      ok: false,
      summary: "Nu am putut încărca frizerii.",
      error: error.message,
    };
  }

  const barbers = (data ?? []).map((b) => ({
    name: b.display_name,
    slug: b.slug,
    bio: b.bio || null,
    booking_path: b.slug
      ? `/booking/salon/${ctx.salonSlug}/${b.slug}`
      : null,
    is_current: ctx.barberId === b.id,
  }));

  return {
    ok: true,
    summary: barbers.length
      ? `${barbers.length} frizer(i) activ(i).`
      : "Niciun frizer activ momentan.",
    data: { barbers },
  };
}
