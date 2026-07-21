import { supabaseAdmin } from "@/lib/supabase/admin";

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function asNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return fallback;
}

export type ResolvedTenant = {
  id: string;
  name: string;
  slug: string;
  phone?: string | null;
};

/**
 * Resolve tenant by tenant_id / slug / name (or tenant_name).
 */
export async function resolveTenant(args: Record<string, unknown>): Promise<{
  tenant: ResolvedTenant | null;
  ambiguous: Array<{ tenant_id: string; name: string; slug: string }> | null;
}> {
  const tenantId = asString(args.tenant_id);
  const slug = asString(args.slug)?.toLowerCase() || null;
  const nameQuery = asString(args.name) || asString(args.tenant_name);

  if (tenantId) {
    const { data } = await supabaseAdmin
      .from("tenants")
      .select("id, name, slug, phone")
      .eq("id", tenantId)
      .maybeSingle();
    return { tenant: data, ambiguous: null };
  }

  if (slug) {
    const { data } = await supabaseAdmin
      .from("tenants")
      .select("id, name, slug, phone")
      .eq("slug", slug)
      .maybeSingle();
    return { tenant: data, ambiguous: null };
  }

  if (nameQuery) {
    const { data } = await supabaseAdmin
      .from("tenants")
      .select("id, name, slug, phone")
      .ilike("name", `%${nameQuery}%`)
      .limit(5);
    if (!data?.length) return { tenant: null, ambiguous: null };
    if (data.length > 1) {
      return {
        tenant: null,
        ambiguous: data.map((t) => ({
          tenant_id: t.id,
          name: t.name,
          slug: t.slug,
        })),
      };
    }
    return { tenant: data[0], ambiguous: null };
  }

  return { tenant: null, ambiguous: null };
}
