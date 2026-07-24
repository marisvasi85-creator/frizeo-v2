import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureBookingClientTokens } from "@/lib/bookings/ensureBookingClientTokens";
import { hasSalonReviewsTable } from "@/lib/reviews/salonReviews";

/** Lightweight meta for confirmed page (review link). */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id lipsă" }, { status: 400 });
  }

  if (!(await hasSalonReviewsTable())) {
    return NextResponse.json({ reviewUrl: null });
  }

  const tokens = await ensureBookingClientTokens(id);
  if (!tokens?.cancel_token) {
    return NextResponse.json({ reviewUrl: null });
  }

  const { data: existing } = await supabaseAdmin
    .from("salon_reviews")
    .select("id")
    .eq("booking_id", id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ reviewUrl: null });
  }

  return NextResponse.json({
    reviewUrl: `/review/${tokens.cancel_token}`,
  });
}
