import { supabaseAdmin } from "@/lib/supabase/admin";

let cached: boolean | null = null;

export async function hasSlugRedirectsMigration(): Promise<boolean> {
  if (cached !== null) return cached;

  const { error } = await supabaseAdmin
    .from("slug_redirects")
    .select("id")
    .limit(1);

  cached = !error;
  return cached;
}
