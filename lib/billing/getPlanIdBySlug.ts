import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PlanSlug } from "./plans";

export async function getPlanIdBySlug(slug: PlanSlug): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("plans")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("getPlanIdBySlug:", slug, error);
    return null;
  }

  return data?.id ?? null;
}
