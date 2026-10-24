import { formatReviewDate } from "@/lib/reviews/eligibility";
import type { SalonReviewSummary } from "@/lib/reviews/salonReviews";

function Stars({ rating }: { rating: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className="font-medium">
      {"★".repeat(filled)}
      <span className="text-frz-muted">{"★".repeat(Math.max(0, 5 - filled))}</span>
    </span>
  );
}

export function SalonReviewScore({
  summary,
  salonWide = false,
}: {
  summary: SalonReviewSummary;
  salonWide?: boolean;
}) {
  if (summary.count === 0 || summary.average == null) return null;
  const noun = summary.count === 1 ? "recenzie" : "recenzii";
  return (
    <p className="text-amber-600 mt-2 font-medium">
      ★ {summary.average.toFixed(1)} · {summary.count} {noun}
      {salonWide ? " ale salonului" : ""}
    </p>
  );
}

export default function SalonReviewsPublic({
  summary,
}: {
  summary: SalonReviewSummary;
}) {
  if (summary.reviews.length === 0) return null;

  return (
    <div className="bg-frz-card rounded-2xl border border-frz-line p-6 space-y-4">
      <h2 className="text-2xl font-semibold">Recenzii</h2>
      <ul className="space-y-4">
        {summary.reviews.map((review) => (
          <li
            key={review.id}
            className="border-t border-frz-line/50 pt-4 first:border-0 first:pt-0"
          >
            <p className="font-medium">
              <Stars rating={review.rating} />
              <span className="ml-2 text-frz-ink">{review.author_name}</span>
            </p>
            <p className="text-xs text-frz-muted mt-1">
              {formatReviewDate(review.created_at)}
            </p>
            {review.comment ? (
              <p className="text-frz-muted mt-1 text-sm">{review.comment}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
