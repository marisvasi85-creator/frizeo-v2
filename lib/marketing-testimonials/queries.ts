import { supabaseAdmin } from "@/lib/supabase/admin";
import type { MarketingTestimonial } from "./types";

export async function hasMarketingTestimonialsTable(): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("frizeo_marketing_testimonials")
    .select("id")
    .limit(1);

  if (!error) return true;
  if (error.code === "42P01" || error.message.includes("does not exist")) {
    return false;
  }
  throw error;
}

export async function listApprovedMarketingTestimonials(
  limit = 12,
): Promise<MarketingTestimonial[]> {
  const { data, error } = await supabaseAdmin
    .from("frizeo_marketing_testimonials")
    .select(
      "id, rating, author_name, salon_name, city, user_type, body, photo_url, display_consent, status, created_at, reviewed_at",
    )
    .eq("status", "approved")
    .eq("display_consent", true)
    .order("reviewed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }

  return (data ?? []) as MarketingTestimonial[];
}

export async function listMarketingTestimonialsForAdmin(): Promise<
  MarketingTestimonial[]
> {
  const { data, error } = await supabaseAdmin
    .from("frizeo_marketing_testimonials")
    .select(
      "id, rating, author_name, salon_name, city, user_type, body, photo_url, display_consent, status, created_at, reviewed_at",
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as MarketingTestimonial[];
}
