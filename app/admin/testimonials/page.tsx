import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { isPlatformCreatorEmail } from "@/lib/auth/requirePlatformCreator";
import { isMarketingTestimonialsEnabled } from "@/lib/marketing-testimonials/config";
import {
  hasMarketingTestimonialsTable,
  listMarketingTestimonialsForAdmin,
} from "@/lib/marketing-testimonials/queries";
import TestimonialsAdminClient from "./TestimonialsAdminClient";

export default async function TestimonialsAdminPage() {
  if (!isMarketingTestimonialsEnabled()) {
    redirect("/admin/dashboard");
  }

  const user = await getAuthUser();
  if (!user || !isPlatformCreatorEmail(user.email)) {
    redirect("/admin/dashboard");
  }

  if (!(await hasMarketingTestimonialsTable())) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Rulează migrarea{" "}
        <code>20260901120000_frizeo_marketing_testimonials.sql</code> pe
        staging.
      </div>
    );
  }

  const items = await listMarketingTestimonialsForAdmin();

  return <TestimonialsAdminClient initialItems={items} />;
}
