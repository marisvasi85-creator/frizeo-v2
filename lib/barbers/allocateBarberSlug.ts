import { slugify } from "@/lib/utils/slugify";
import { isBarberSlugAvailable } from "@/lib/slugs/slugAvailability";

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
