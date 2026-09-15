import { supabaseAdmin } from "@/lib/supabase/admin";
import type { MarketingTestimonial } from "./types";

function isMissingTestimonialsTableError(error: {
  code?: string | null;
  message?: string | null;
} | null | undefined): boolean {
  if (!error) return false;
  const code = (error.code ?? "").toUpperCase();
  if (code === "42P01" || code === "PGRST205") return true;
  const message = (error.message ?? "").toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    message.includes("schema cache")
  );
}

export async function hasMarketingTestimonialsTable(): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("frizeo_marketing_testimonials")
    .select("id")
    .limit(1);

  if (!error) return true;
  if (isMissingTestimonialsTableError(error)) return false;
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
    if (isMissingTestimonialsTableError(error)) return [];
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
