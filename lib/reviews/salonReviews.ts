import { supabaseAdmin } from "@/lib/supabase/admin";

export type SalonReview = {
  id: string;
  rating: number;
  author_name: string;
  comment: string | null;
  created_at: string;
};

export type SalonReviewSummary = {
  count: number;
  average: number | null;
  reviews: SalonReview[];
};

let reviewsTableCached: boolean | null = null;

export async function hasSalonReviewsTable(): Promise<boolean> {
  if (reviewsTableCached !== null) return reviewsTableCached;
  const { error } = await supabaseAdmin
    .from("salon_reviews")
    .select("id")
    .limit(1);
  reviewsTableCached = !error;
  return reviewsTableCached;
}

export async function getSalonReviewSummary(
  tenantId: string,
  limit = 10
): Promise<SalonReviewSummary> {
  if (!(await hasSalonReviewsTable())) {
    return { count: 0, average: null, reviews: [] };
  }

  const { data, error } = await supabaseAdmin
    .from("salon_reviews")
    .select("id, rating, author_name, comment, created_at")
    .eq("tenant_id", tenantId)
    .eq("approved", true)
    .order("created_at", { ascending: false })
    .limit(Math.max(limit, 50));

  if (error) {
    console.error("getSalonReviewSummary:", error);
    return { count: 0, average: null, reviews: [] };
  }

  const rows = (data || []) as SalonReview[];
  const count = rows.length;
  const average =
    count > 0
      ? Math.round(
          (rows.reduce((sum, r) => sum + Number(r.rating), 0) / count) * 10
        ) / 10
      : null;

  return {
    count,
    average,
    reviews: rows.slice(0, limit),
  };
}
