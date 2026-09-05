import { supabaseAdmin } from "@/lib/supabase/admin";
import { hasSlugRedirectsMigration } from "./hasSlugRedirectsMigration";

export async function isTenantSlugAvailable(
  slug: string,
  excludeTenantId?: string,
): Promise<boolean> {
  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (tenant && tenant.id !== excludeTenantId) {
    return false;
  }

  if (!(await hasSlugRedirectsMigration())) {
    return true;
  }

  const { data: redirect } = await supabaseAdmin
    .from("slug_redirects")
    .select("entity_id")
    .eq("entity_type", "tenant")
    .eq("old_slug", slug)
    .maybeSingle();

  if (!redirect) return true;
  if (excludeTenantId && redirect.entity_id === excludeTenantId) return true;
  return false;
}

export async function isBarberSlugAvailable(
  tenantId: string,
  slug: string,
  excludeBarberId?: string,
): Promise<boolean> {
  const { data: barber } = await supabaseAdmin
    .from("barbers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("slug", slug)
    .maybeSingle();

  if (barber && barber.id !== excludeBarberId) {
    return false;
  }

  if (!(await hasSlugRedirectsMigration())) {
    return true;
  }

  const { data: redirect } = await supabaseAdmin
    .from("slug_redirects")
    .select("entity_id")
    .eq("entity_type", "barber")
    .eq("tenant_id", tenantId)
    .eq("old_slug", slug)
    .maybeSingle();

  if (!redirect) return true;
  if (excludeBarberId && redirect.entity_id === excludeBarberId) return true;
  return false;
}
