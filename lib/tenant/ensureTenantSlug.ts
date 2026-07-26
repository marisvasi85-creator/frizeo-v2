import { supabaseAdmin } from "@/lib/supabase/admin";
import { allocateTenantSlug } from "@/lib/tenant/allocateTenantSlug";

export async function ensureTenantSlug(tenant: {
  id: string;
  name: string | null;
  slug: string | null;
}): Promise<string> {
  // Never rewrite an existing slug — rename must not break shared links.
  if (tenant.slug) {
    return tenant.slug;
  }

  const slug = await allocateTenantSlug(tenant.name || "salon", tenant.id);

  await supabaseAdmin
    .from("tenants")
    .update({ slug })
    .eq("id", tenant.id);

  return slug;
}
