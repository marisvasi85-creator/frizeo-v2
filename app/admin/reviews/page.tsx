import { redirect } from "next/navigation";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import { canViewSalonReviews } from "@/app/admin/components/adminNav";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import { listSalonReviewsForAdmin } from "@/lib/reviews/salonReviews";
import SalonReviewsDashboard from "./SalonReviewsDashboard";

export default async function SalonReviewsPage() {
  const session = await getAdminSession();

  if (!session?.tenantId) {
    redirect("/login");
  }

  if (!canViewSalonReviews(session.role)) {
    redirect("/admin/dashboard");
  }

  const { ok, summary, visible, hidden } = await listSalonReviewsForAdmin(
    session.tenantId,
  );

  return (
    <div className="space-y-6 min-w-0">
      <AdminPageHeader
        title="Recenzii salon"
        subtitle={
          session.tenantName
            ? `Recenziile clienților pentru ${session.tenantName}. Testimonialele despre Frizeo sunt o pagină separată.`
            : "Recenziile clienților pentru salonul tău."
        }
      />
      {ok ? (
        <SalonReviewsDashboard
          summary={summary}
          visible={visible}
          hidden={hidden}
        />
      ) : (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Recenziile nu au putut fi încărcate. Reîncearcă în câteva momente.
        </p>
      )}
    </div>
  );
}
