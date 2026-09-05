import { slugify } from "@/lib/utils/slugify";
import { isTenantSlugAvailable } from "@/lib/slugs/slugAvailability";

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
