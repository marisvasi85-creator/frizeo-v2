import { redirect } from "next/navigation";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import EmptyState from "@/app/admin/components/EmptyState";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { isPlatformCreatorEmail } from "@/lib/auth/requirePlatformCreator";
import { formatReviewDate } from "@/lib/reviews/eligibility";
import { listReviewReportsForCreator } from "@/lib/reviews/salonReviewModeration";
import ReportDecisionForm from "./ReportDecisionForm";

export default async function ReviewReportsPage() {
  const user = await getAuthUser();
  if (!user || !isPlatformCreatorEmail(user.email)) {
    redirect("/admin/dashboard");
  }

  const reports = await listReviewReportsForCreator();
  const open = reports?.filter((report) => report.status === "open") ?? [];
  const hidden = reports?.filter((report) => report.status === "hidden") ?? [];

  return (
    <div className="space-y-6 min-w-0">
      <AdminPageHeader
        title="Raportări recenzii"
        subtitle="Analizezi doar recenziile raportate. Le poți ascunde sau reactiva. Nu se șterg, iar o notă mică nu este un motiv de ascundere."
      />
      {reports == null ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Raportările nu au putut fi încărcate. Reîncearcă în câteva momente.
        </p>
      ) : reports.length === 0 ? (
        <EmptyState>Nu există raportări de analizat.</EmptyState>
      ) : (
        <div className="space-y-8">
          <ReportSection title="De analizat" reports={open} />
          <ReportSection title="Ascunse după raportare" reports={hidden} />
        </div>
      )}
    </div>
  );
}

function ReportSection({
  title,
  reports,
}: {
  title: string;
  reports: NonNullable<Awaited<ReturnType<typeof listReviewReportsForCreator>>>;
}) {
  if (reports.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-frz-ink">{title}</h2>
      {reports.map((report) => (
        <article
          key={report.id}
          className="rounded-2xl border border-frz-line bg-frz-card p-4 md:p-5 space-y-3"
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="font-semibold text-frz-ink break-words">{report.tenantName}</p>
              <p className="text-sm text-frz-muted">
                {report.authorName} · {report.rating}/5 · {formatReviewDate(report.createdAt)}
              </p>
            </div>
          </div>
          <p className="text-sm text-frz-ink whitespace-pre-wrap break-words">
            {report.comment || "Fără comentariu"}
          </p>
          {report.ownerReply ? (
            <p className="text-sm text-frz-muted whitespace-pre-wrap break-words">
              Răspunsul salonului: {report.ownerReply}
            </p>
          ) : null}
          <p className="text-sm text-amber-900 whitespace-pre-wrap break-words">
            Motiv: {report.reason}
          </p>
          <ReportDecisionForm reportId={report.id} status={report.status} />
        </article>
      ))}
    </section>
  );
}
