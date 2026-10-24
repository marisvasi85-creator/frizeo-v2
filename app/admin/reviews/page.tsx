import { redirect } from "next/navigation";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import { listSalonReviewsForAdmin } from "@/lib/reviews/salonReviews";
import SalonReviewsDashboard from "./SalonReviewsDashboard";

export default async function SalonReviewsPage() {
  const session = await getAdminSession();

  if (!session?.tenantId) {
    redirect("/login");
  }

  if (session.role !== "owner" && session.role !== "manager") {
    redirect("/admin/dashboard");
  }

  const { summary, visible, hidden } = await listSalonReviewsForAdmin(
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
      <SalonReviewsDashboard
        summary={summary}
        visible={visible}
        hidden={hidden}
      />
    </div>
  );
}
