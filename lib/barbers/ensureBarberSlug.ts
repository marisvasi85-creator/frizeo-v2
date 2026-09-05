import { supabaseAdmin } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils/slugify";
import { isBarberSlugAvailable } from "@/lib/slugs/slugAvailability";

type BarberSlugInput = {
  id: string;
  tenant_id: string;
  display_name: string | null;
  slug: string | null;
};

export async function ensureBarberSlug(barber: BarberSlugInput): Promise<string> {
  // Never rewrite an existing slug on page load. Explicit customization
  // (updateBarberBookingSlug) records redirects so old links stay valid.
  if (barber.slug) {
    return barber.slug;
  }

  let base = slugify(barber.display_name || "frizer");
  if (!base) {
    base = "frizer";
  }

  let slug = base;
  let suffix = 2;

  while (!(await isBarberSlugAvailable(barber.tenant_id, slug, barber.id))) {
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
