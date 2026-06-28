import { supabaseAdmin } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils/slugify";

export async function ensureTenantSlug(tenant: {
  id: string;
  name: string | null;
  slug: string | null;
}): Promise<string> {
  if (tenant.slug) {
    return tenant.slug;
  }

  const slug = slugify(tenant.name || "salon");

  await supabaseAdmin
    .from("tenants")
    .update({ slug })
    .eq("id", tenant.id);

  return slug;
}
