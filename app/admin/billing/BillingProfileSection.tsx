import { supabaseAdmin } from "@/lib/supabase/admin";
import FiscalInvoicesList from "./FiscalInvoicesList";

export async function BillingInvoicesSection({
  tenantId,
}: {
  tenantId: string;
}) {
  return <FiscalInvoicesList tenantId={tenantId} />;
}
