"use server";

import { getAdminSession } from "@/lib/auth/getAdminSession";
import {
  canManageSalonReviews,
  type ModerationResult,
} from "@/lib/reviews/moderation";
import {
  reportSalonReview,
  saveOwnerReply,
} from "@/lib/reviews/salonReviewModeration";

async function salonManager(): Promise<
  { ok: true; tenantId: string; userId: string } | { ok: false; message: string }
> {
  const session = await getAdminSession();
  if (!session?.tenantId || !session.user?.id) {
    return { ok: false, message: "Nu ești autentificat." };
  }
  if (!canManageSalonReviews(session.role)) {
    return { ok: false, message: "Doar owner-ul sau managerul pot administra recenziile." };
  }
  return { ok: true, tenantId: session.tenantId, userId: session.user.id };
}

export async function saveReviewReply(
  _prev: ModerationResult | null,
  formData: FormData,
): Promise<ModerationResult> {
  const access = await salonManager();
  if (!access.ok) return access;

  return saveOwnerReply({
    tenantId: access.tenantId,
    userId: access.userId,
    reviewId: String(formData.get("reviewId") ?? ""),
    reply: String(formData.get("reply") ?? ""),
  });
}

export async function reportReview(
  _prev: ModerationResult | null,
  formData: FormData,
): Promise<ModerationResult> {
  const access = await salonManager();
  if (!access.ok) return access;

  return reportSalonReview({
    tenantId: access.tenantId,
    userId: access.userId,
    reviewId: String(formData.get("reviewId") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });
}
