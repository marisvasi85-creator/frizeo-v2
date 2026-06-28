import {
  isBillingProfileComplete,
  rowToBillingProfile,
  type TenantBillingProfile,
  type TenantBillingRow,
} from "@/lib/billing/billingProfile";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BILLING_COLUMNS =
  "billing_type, billing_name, billing_cui, billing_reg_com, billing_address_line1, billing_city, billing_county, billing_postal_code, billing_country";

export async function getTenantBillingProfile(
  tenantId: string
): Promise<TenantBillingProfile | null> {
  const { data, error } = await supabaseAdmin
    .from("tenants")
    .select(BILLING_COLUMNS)
    .eq("id", tenantId)
    .single();

  if (error || !data) {
    return null;
  }

  return rowToBillingProfile(data as TenantBillingRow);
}

export async function isTenantBillingProfileComplete(
  tenantId: string
): Promise<boolean> {
  const profile = await getTenantBillingProfile(tenantId);
  return isBillingProfileComplete(profile);
}
