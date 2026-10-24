import { zonedDateTimeToUtcMs } from "@/lib/bookings/bookingTimezone";

export type ReviewRecord = {
  id: string;
  tenantId: string;
  rating: number;
  authorName: string;
  comment: string | null;
  createdAt: string;
  approved: boolean;
  bookingStatus: string | null;
  barberName: string | null;
};

export type PublicReviewSummary = {
  count: number;
  average: number | null;
  reviews: ReviewRecord[];
};

export function isCancelledBookingStatus(
  status: string | null | undefined,
): boolean {
  return status === "cancelled";
}

/** A review is public only for its own salon, when approved, and when the visit was not cancelled. */
export function isPublicSalonReview(
  review: ReviewRecord,
  tenantId: string,
): boolean {
  return (
    review.tenantId === tenantId &&
    review.approved &&
    !isCancelledBookingStatus(review.bookingStatus)
  );
}

export function hasBookingEnded(
  date: string,
  endTime: string,
  now: Date = new Date(),
): boolean {
  return now.getTime() >= zonedDateTimeToUtcMs(date, endTime);
}

export function canClientLeaveReview(
  booking: {
    status: string | null;
    date: string | null;
    end_time: string | null;
  },
  now: Date = new Date(),
): { ok: true } | { ok: false; message: string } {
  if (isCancelledBookingStatus(booking.status)) {
    return {
      ok: false,
      message: "Nu poți lăsa recenzie pentru o programare anulată.",
    };
  }

  if (
    !booking.date ||
    !booking.end_time ||
    !hasBookingEnded(booking.date, booking.end_time, now)
  ) {
    return {
      ok: false,
      message: "Poți lăsa recenzia după încheierea programării.",
    };
  }

  return { ok: true };
}

export function summarizePublicReviews(
  rows: ReviewRecord[],
  tenantId: string,
  limit: number,
): PublicReviewSummary {
  const eligible = rows
    .filter((review) => isPublicSalonReview(review, tenantId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const count = eligible.length;
  const average =
    count > 0
      ? Math.round(
          (eligible.reduce((sum, review) => sum + Number(review.rating), 0) /
            count) *
            10,
        ) / 10
      : null;

  return {
    count,
    average,
    reviews: eligible.slice(0, Math.max(0, limit)),
  };
}

export function formatReviewDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ro-RO", {
    timeZone: "Europe/Bucharest",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
