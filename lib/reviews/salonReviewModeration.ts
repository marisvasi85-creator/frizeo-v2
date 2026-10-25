import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  canHideReportedReview,
  canReactivateReportedReview,
  normalizeOwnerReply,
  normalizeReportReason,
  type ModerationResult,
  type ReviewReportStatus,
} from "@/lib/reviews/moderation";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ReviewReportQueueItem = {
  id: string;
  reviewId: string;
  tenantId: string;
  tenantName: string;
  status: "open" | "hidden";
  reason: string;
  createdAt: string;
  rating: number;
  authorName: string;
  comment: string | null;
  ownerReply: string | null;
};

function invalidId(): ModerationResult {
  return { ok: false, message: "Recenzia nu a putut fi identificată." };
}

export async function saveOwnerReply(input: {
  tenantId: string;
  userId: string;
  reviewId: string;
  reply: string;
}): Promise<ModerationResult> {
  if (!UUID.test(input.reviewId) || !UUID.test(input.tenantId)) return invalidId();

  const parsed = normalizeOwnerReply(input.reply);
  if (!parsed.ok) return parsed;

  const { data, error } = await supabaseAdmin
    .from("salon_reviews")
    .update({
      owner_reply: parsed.reply,
      owner_reply_at: parsed.reply ? new Date().toISOString() : null,
      owner_reply_by: parsed.reply ? input.userId : null,
    })
    .eq("id", input.reviewId)
    .eq("tenant_id", input.tenantId)
    .select("id, tenant_id");

  if (error) {
    console.error("saveOwnerReply:", error);
    return { ok: false, message: "Răspunsul nu a putut fi salvat." };
  }

  const saved = (data ?? []).find(
    (row) => row.id === input.reviewId && row.tenant_id === input.tenantId,
  );
  if (!saved) {
    return { ok: false, message: "Recenzia nu aparține acestui salon." };
  }

  await revalidateSalonReviewPages(input.tenantId);
  return { ok: true };
}

export async function reportSalonReview(input: {
  tenantId: string;
  userId: string;
  reviewId: string;
  reason: string;
}): Promise<ModerationResult> {
  if (!UUID.test(input.reviewId) || !UUID.test(input.tenantId)) return invalidId();

  const parsed = normalizeReportReason(input.reason);
  if (!parsed.ok) return parsed;

  const { data: review, error: reviewError } = await supabaseAdmin
    .from("salon_reviews")
    .select("id, tenant_id")
    .eq("id", input.reviewId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();

  if (reviewError || !review || review.tenant_id !== input.tenantId) {
    return { ok: false, message: "Recenzia nu aparține acestui salon." };
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("salon_review_reports")
    .select("id")
    .eq("review_id", input.reviewId)
    .eq("tenant_id", input.tenantId)
    .eq("status", "open")
    .maybeSingle();

  if (existingError) {
    console.error("reportSalonReview existing:", existingError);
    return { ok: false, message: "Raportarea nu a putut fi trimisă." };
  }
  if (existing) {
    return { ok: false, message: "Recenzia este deja raportată." };
  }

  const { error } = await supabaseAdmin.from("salon_review_reports").insert({
    review_id: input.reviewId,
    tenant_id: input.tenantId,
    reported_by: input.userId,
    reason: parsed.reason,
    status: "open",
  });

  if (error) {
    console.error("reportSalonReview:", error);
    return { ok: false, message: "Raportarea nu a putut fi trimisă." };
  }

  await revalidateSalonReviewPages(input.tenantId);
  return { ok: true };
}

export async function listReviewReportsForCreator(): Promise<
  ReviewReportQueueItem[] | null
> {
  const { data: reports, error } = await supabaseAdmin
    .from("salon_review_reports")
    .select("id, review_id, tenant_id, reason, status, created_at")
    .in("status", ["open", "hidden"])
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("listReviewReportsForCreator:", error);
    return null;
  }

  const rows = (reports ?? []).filter(
    (report) => report.status === "open" || report.status === "hidden",
  );
  if (rows.length === 0) return [];

  const reviewIds = [...new Set(rows.map((report) => report.review_id as string))];
  const tenantIds = [...new Set(rows.map((report) => report.tenant_id as string))];

  const [{ data: reviews, error: reviewError }, { data: tenants, error: tenantError }] =
    await Promise.all([
      supabaseAdmin
        .from("salon_reviews")
        .select("id, tenant_id, rating, author_name, comment, owner_reply")
        .in("id", reviewIds),
      supabaseAdmin.from("tenants").select("id, name").in("id", tenantIds),
    ]);

  if (reviewError || tenantError) {
    console.error("listReviewReportsForCreator join:", reviewError ?? tenantError);
    return null;
  }

  const reviewById = new Map(
    (reviews ?? []).map((review) => [review.id as string, review]),
  );
  const tenantName = new Map(
    (tenants ?? []).map((tenant) => [
      tenant.id as string,
      (typeof tenant.name === "string" && tenant.name.trim()) || "Salon",
    ]),
  );

  return rows.flatMap((report) => {
    const review = reviewById.get(report.review_id as string);
    if (!review || review.tenant_id !== report.tenant_id) return [];
    const status = report.status as ReviewReportStatus;
    if (status !== "open" && status !== "hidden") return [];
    return [
      {
        id: report.id as string,
        reviewId: review.id as string,
        tenantId: report.tenant_id as string,
        tenantName: tenantName.get(report.tenant_id as string) ?? "Salon",
        status,
        reason: report.reason as string,
        createdAt: report.created_at as string,
        rating: Number(review.rating),
        authorName: review.author_name as string,
        comment: (review.comment as string | null) ?? null,
        ownerReply: (review.owner_reply as string | null) ?? null,
      },
    ];
  });
}

export async function resolveReportedReview(input: {
  reportId: string;
  userId: string;
  action: "hide" | "reactivate";
}): Promise<ModerationResult> {
  if (!UUID.test(input.reportId)) return invalidId();

  const { data: report, error } = await supabaseAdmin
    .from("salon_review_reports")
    .select("id, review_id, tenant_id, status")
    .eq("id", input.reportId)
    .maybeSingle();

  if (error || !report) {
    return { ok: false, message: "Raportarea nu a fost găsită." };
  }

  const allowed =
    input.action === "hide"
      ? canHideReportedReview(report.status as string)
      : canReactivateReportedReview(report.status as string);
  if (!allowed) {
    return {
      ok: false,
      message:
        input.action === "hide"
          ? "Poți ascunde doar o recenzie raportată, aflată în analiză."
          : "Poți reactiva doar o recenzie ascunsă după raportare.",
    };
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("salon_reviews")
    .update({ approved: input.action === "reactivate" })
    .eq("id", report.review_id)
    .eq("tenant_id", report.tenant_id)
    .select("id, tenant_id");

  const saved = (updated ?? []).find(
    (row) => row.id === report.review_id && row.tenant_id === report.tenant_id,
  );
  if (updateError || !saved) {
    console.error("resolveReportedReview review:", updateError);
    return { ok: false, message: "Recenzia nu a putut fi actualizată." };
  }

  const nextStatus = input.action === "hide" ? "hidden" : "reactivated";
  const { error: reportError } = await supabaseAdmin
    .from("salon_review_reports")
    .update({
      status: nextStatus,
      resolved_at: new Date().toISOString(),
      resolved_by: input.userId,
    })
    .eq("id", report.id)
    .eq("tenant_id", report.tenant_id)
    .eq("status", report.status);

  if (reportError) {
    console.error("resolveReportedReview report:", reportError);
    return { ok: false, message: "Raportarea nu a putut fi închisă." };
  }

  await revalidateSalonReviewPages(report.tenant_id as string);
  return { ok: true };
}

async function revalidateSalonReviewPages(tenantId: string) {
  revalidatePath("/admin/reviews");
  revalidatePath("/admin/review-reports");

  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("slug")
    .eq("id", tenantId)
    .maybeSingle();

  const { data: barbers } = await supabaseAdmin
    .from("barbers")
    .select("id, slug")
    .eq("tenant_id", tenantId);

  if (typeof tenant?.slug === "string" && tenant.slug) {
    revalidatePath(`/booking/salon/${tenant.slug}`);
  }

  for (const barber of barbers ?? []) {
    if (
      typeof tenant?.slug === "string" &&
      tenant.slug &&
      typeof barber.slug === "string" &&
      barber.slug
    ) {
      revalidatePath(`/booking/salon/${tenant.slug}/${barber.slug}`);
    }
    if (typeof barber.id === "string") {
      revalidatePath(`/booking/${barber.id}`);
    }
  }
}
