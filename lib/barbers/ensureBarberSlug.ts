import { supabaseAdmin } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils/slugify";

type BarberSlugInput = {
  id: string;
  tenant_id: string;
  display_name: string | null;
  slug: string | null;
};

async function isSlugAvailable(
  tenantId: string,
  slug: string,
  barberId: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("barbers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("slug", slug)
    .maybeSingle();

  return !data || data.id === barberId;
}

export async function ensureBarberSlug(barber: BarberSlugInput): Promise<string> {
  if (barber.slug && (await isSlugAvailable(barber.tenant_id, barber.slug, barber.id))) {
    return barber.slug;
  }

  let base = slugify(barber.display_name || "frizer");
  if (!base) {
    base = "frizer";
  }

  let slug = base;
  let suffix = 2;

  while (!(await isSlugAvailable(barber.tenant_id, slug, barber.id))) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  const { error } = await supabaseAdmin
    .from("barbers")
    .update({ slug })
    .eq("id", barber.id);

  if (error) {
    console.error("ensureBarberSlug:", error);
    throw error;
  }

  return slug;
}
