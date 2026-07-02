import {
  isBillingProfileComplete,
  rowToBillingProfile,
  type TenantBillingRow,
} from "@/lib/billing/billingProfile";
import { supabaseAdmin } from "@/lib/supabase/admin";
import BillingProfileForm from "./BillingProfileForm";
import FiscalInvoicesList from "./FiscalInvoicesList";

const BILLING_COLUMNS =
  "billing_type, billing_name, billing_cui, billing_reg_com, billing_address_line1, billing_city, billing_county, billing_postal_code, billing_country";

export async function BillingProfileSection({ tenantId }: { tenantId: string }) {
  const { data } = await supabaseAdmin
    .from("tenants")
    .select(BILLING_COLUMNS)
    .eq("id", tenantId)
    .single();

  const profileComplete = isBillingProfileComplete(
    rowToBillingProfile((data ?? null) as TenantBillingRow | null),
  );

  return (
    <>
      <BillingProfileForm initialComplete={profileComplete} />
      <FiscalInvoicesList tenantId={tenantId} />
    </>
  );
}
