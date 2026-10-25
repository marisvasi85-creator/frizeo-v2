export const OWNER_REPLY_MAX = 1000;
export const REPORT_REASON_MIN = 10;
export const REPORT_REASON_MAX = 500;

export type ReviewReportStatus = "open" | "hidden" | "reactivated";

export type ModerationResult = { ok: true } | { ok: false; message: string };

export function normalizeOwnerReply(
  value: string,
): { ok: true; reply: string | null } | { ok: false; message: string } {
  const reply = value.trim();
  if (!reply) return { ok: true, reply: null };
  if (reply.length > OWNER_REPLY_MAX) {
    return { ok: false, message: "Răspunsul poate avea cel mult 1000 de caractere." };
  }
  return { ok: true, reply };
}

export function normalizeReportReason(
  value: string,
): { ok: true; reason: string } | { ok: false; message: string } {
  const reason = value.trim();
  if (reason.length < REPORT_REASON_MIN) {
    return {
      ok: false,
      message: "Descrie pe scurt de ce recenzia este abuzivă.",
    };
  }
  if (reason.length > REPORT_REASON_MAX) {
    return { ok: false, message: "Motivul poate avea cel mult 500 de caractere." };
  }
  return { ok: true, reason };
}

export function canManageSalonReviews(role: string | null): boolean {
  return role === "owner" || role === "manager";
}

/** Hide is allowed only for an open abuse report, never because of the rating. */
export function canHideReportedReview(reportStatus: string | null): boolean {
  return reportStatus === "open";
}

export function canReactivateReportedReview(reportStatus: string | null): boolean {
  return reportStatus === "hidden";
}
