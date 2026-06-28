import type Stripe from "stripe";
import { billingProfileToDbUpdate } from "@/lib/billing/billingProfile";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

function taxIdTypeToBillingType(
  type: Stripe.TaxId.Type | undefined
): "individual" | "company" | null {
  if (type === "ro_tin") return "company";
  return null;
}

/** Salvează în DB datele PF/PJ colectate în Stripe Checkout (pentru SmartBill). */
export async function syncTenantBillingFromStripeCustomer(
  tenantId: string,
  customerId: string
) {
  const stripe = getStripe();
  const customer = await stripe.customers.retrieve(customerId);

  if (customer.deleted) return;

  const { data: taxIds } = await stripe.customers.listTaxIds(customerId, {
    limit: 5,
  });

  const roTax = taxIds.find((t) => t.type === "ro_tin");
  const billingType =
    taxIdTypeToBillingType(roTax?.type) ??
    (roTax ? "company" : "individual");

  const update = billingProfileToDbUpdate({
    type: billingType,
    name: customer.name ?? null,
    cui: roTax?.value ?? null,
    regCom: null,
    addressLine1: customer.address?.line1 ?? null,
    city: customer.address?.city ?? null,
    county: customer.address?.state ?? null,
    postalCode: customer.address?.postal_code ?? null,
    country: customer.address?.country ?? "RO",
  });

  const { error } = await supabaseAdmin
    .from("tenants")
    .update(update)
    .eq("id", tenantId);

  if (error) {
    console.error("syncTenantBillingFromStripeCustomer:", error);
  }
}
