import AdminCard from "@/app/admin/components/AdminCard";
import EmptyState from "@/app/admin/components/EmptyState";
import { formatReviewDate } from "@/lib/reviews/eligibility";
import type {
  SalonReviewAdminItem,
  SalonReviewSummary,
} from "@/lib/reviews/salonReviews";

function Stars({ rating }: { rating: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className="text-amber-500" aria-label={`${filled} din 5`}>
      {"★".repeat(filled)}
      <span className="text-frz-line">{"★".repeat(Math.max(0, 5 - filled))}</span>
    </span>
  );
}

function ReviewCard({
  review,
  note,
}: {
  review: {
    id: string;
    rating: number;
    authorName: string;
    comment: string | null;
    createdAt: string;
    barberName: string | null;
  };
  note?: string;
}) {
  return (
    <article className="rounded-2xl border border-frz-line bg-frz-card p-4 md:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Stars rating={review.rating} />
            <span className="font-semibold text-frz-ink break-words">
              {review.authorName}
            </span>
          </div>
          <p className="text-sm text-frz-muted mt-1">
            {formatReviewDate(review.createdAt)}
            {review.barberName ? ` · ${review.barberName}` : ""}
          </p>
        </div>
        <p className="text-sm font-medium text-frz-ink">{review.rating}/5</p>
      </div>
      {review.comment ? (
        <p className="text-sm text-frz-ink mt-3 whitespace-pre-wrap break-words">
          {review.comment}
        </p>
      ) : (
        <p className="text-sm text-frz-muted mt-3">Fără comentariu</p>
      )}
      {note ? <p className="text-xs text-amber-800 mt-3">{note}</p> : null}
    </article>
  );
}

function hiddenNote(reason: SalonReviewAdminItem["hiddenReason"]): string {
  if (reason === "cancelled") {
    return "Nu apare pe pagina publică: programarea a fost anulată.";
  }
  if (reason === "unlinked") {
    return "Nu apare pe pagina publică: programarea nu aparține acestui salon.";
  }
  return "Nu apare pe pagina publică: recenzia nu este aprobată.";
}

export default function SalonReviewsDashboard({
  summary,
  visible,
  hidden,
}: {
  summary: SalonReviewSummary;
  visible: SalonReviewAdminItem[];
  hidden: SalonReviewAdminItem[];
}) {
  return (
    <div className="space-y-6 min-w-0">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AdminCard padding="sm">
          <div className="text-frz-ink/60 text-sm">Rating mediu</div>
          <div className="text-2xl font-semibold mt-1">
            {summary.average == null ? "—" : summary.average.toFixed(1)}
          </div>
        </AdminCard>
        <AdminCard padding="sm">
          <div className="text-frz-ink/60 text-sm">Recenzii publice</div>
          <div className="text-2xl font-semibold mt-1">{summary.count}</div>
        </AdminCard>
      </div>

      {visible.length === 0 ? (
        <EmptyState>
          Încă nu există recenzii publice pentru acest salon. Clienții pot lăsa
          o recenzie după încheierea programării.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {visible.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}

      {hidden.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-frz-ink">
            Nu apar pe pagina publică
          </h2>
          {hidden.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              note={hiddenNote(review.hiddenReason)}
            />
          ))}
        </section>
      )}
    </div>
  );
}
