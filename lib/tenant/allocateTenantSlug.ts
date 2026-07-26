import { supabaseAdmin } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils/slugify";

async function isTenantSlugAvailable(
  slug: string,
  excludeTenantId?: string,
): Promise<boolean> {
  let query = supabaseAdmin
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  const { data } = await query;

  if (!data) return true;
  if (excludeTenantId && data.id === excludeTenantId) return true;
  return false;
}

/** Allocate a unique tenant slug once; callers must not rewrite it on rename. */
export async function allocateTenantSlug(
  name: string,
  excludeTenantId?: string,
): Promise<string> {
  let base = slugify(name || "salon");
  if (!base) base = "salon";

  let slug = base;
  let suffix = 2;

  while (!(await isTenantSlugAvailable(slug, excludeTenantId))) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  return slug;
}
