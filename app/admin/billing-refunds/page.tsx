import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { isPlatformCreatorEmail } from "@/lib/auth/requirePlatformCreator";
import AdminPageHeader from "../components/AdminPageHeader";
import BillingRefundsClient from "./BillingRefundsClient";

export default async function BillingRefundsPage() {
  const user = await getAuthUser();
  if (!user || !isPlatformCreatorEmail(user.email)) {
    redirect("/admin/dashboard");
  }

  return (
    <div className="space-y-6 min-w-0">
      <div className="inline-flex items-center gap-2 text-xs text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-full">
        Creator only · refund Stripe, niciodată din contul salonului
      </div>
      <AdminPageHeader
        title="Refund abonament Stripe"
        subtitle="Returnează integral ultima plată de abonament și trece salonul pe Free. Anularea din portal rămâne separată și nu returnează banii."
      />
      <BillingRefundsClient />
    </div>
  );
}
