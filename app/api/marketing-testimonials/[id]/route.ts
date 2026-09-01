import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlatformCreator } from "@/lib/auth/requirePlatformCreator";
import { isMarketingTestimonialsEnabled } from "@/lib/marketing-testimonials/config";
import type { MarketingTestimonialStatus } from "@/lib/marketing-testimonials/types";

type RouteContext = { params: Promise<{ id: string }> };

const ALLOWED_STATUSES = new Set<MarketingTestimonialStatus>([
  "approved",
  "rejected",
]);

export async function PATCH(req: Request, context: RouteContext) {
  if (!isMarketingTestimonialsEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const auth = await requirePlatformCreator();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Date invalide." }, { status: 400 });
  }

  const status = body.status?.trim() as MarketingTestimonialStatus | undefined;
  if (!status || !ALLOWED_STATUSES.has(status)) {
    return NextResponse.json(
      { error: "Status invalid. Folosește approved sau rejected." },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("frizeo_marketing_testimonials")
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.userId,
    })
    .eq("id", id)
    .select("id, status")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Nu s-a putut actualiza recenzia." },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json({ error: "Recenzia nu există." }, { status: 404 });
  }

  return NextResponse.json({ success: true, status: data.status });
}
