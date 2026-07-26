import { supabaseAdmin } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils/slugify";

async function isBarberSlugAvailable(
  tenantId: string,
  slug: string,
  excludeBarberId?: string,
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("barbers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("slug", slug)
    .maybeSingle();

  if (!data) return true;
  if (excludeBarberId && data.id === excludeBarberId) return true;
  return false;
}

/** Allocate a unique barber slug once within a tenant; never rewrite on rename. */
export async function allocateBarberSlug(
  tenantId: string,
  displayName: string,
  excludeBarberId?: string,
): Promise<string> {
  let base = slugify(displayName || "frizer");
  if (!base) base = "frizer";

  let slug = base;
  let suffix = 2;

  while (!(await isBarberSlugAvailable(tenantId, slug, excludeBarberId))) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  return slug;
}
