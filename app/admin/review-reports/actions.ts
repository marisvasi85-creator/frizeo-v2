"use server";

import { getAuthUser } from "@/lib/auth/getAuthUser";
import { isPlatformCreatorEmail } from "@/lib/auth/requirePlatformCreator";
import type { ModerationResult } from "@/lib/reviews/moderation";
import { resolveReportedReview } from "@/lib/reviews/salonReviewModeration";

async function creator(): Promise<
  { ok: true; userId: string } | { ok: false; message: string }
> {
  const user = await getAuthUser();
  if (!user || !isPlatformCreatorEmail(user.email)) {
    return { ok: false, message: "Doar Platform Creator poate analiza raportările." };
  }
  return { ok: true, userId: user.id };
}

export async function hideReportedReview(
  _prev: ModerationResult | null,
  formData: FormData,
): Promise<ModerationResult> {
  const access = await creator();
  if (!access.ok) return access;
  return resolveReportedReview({
    reportId: String(formData.get("reportId") ?? ""),
    userId: access.userId,
    action: "hide",
  });
}

export async function reactivateReportedReview(
  _prev: ModerationResult | null,
  formData: FormData,
): Promise<ModerationResult> {
  const access = await creator();
  if (!access.ok) return access;
  return resolveReportedReview({
    reportId: String(formData.get("reportId") ?? ""),
    userId: access.userId,
    action: "reactivate",
  });
}
