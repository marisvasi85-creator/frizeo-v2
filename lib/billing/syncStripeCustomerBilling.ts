import { getStripe } from "@/lib/stripe";
import type { TenantBillingProfile } from "./billingProfile";

export async function syncStripeCustomerBilling(params: {
  customerId: string;
  email: string;
  profile: TenantBillingProfile;
}) {
  const stripe = getStripe();
  const { customerId, email, profile } = params;

  await stripe.customers.update(customerId, {
    email,
    name: profile.name ?? undefined,
    address: {
      line1: profile.addressLine1 ?? undefined,
      city: profile.city ?? undefined,
      state: profile.county ?? undefined,
      postal_code: profile.postalCode ?? undefined,
      country: profile.country || "RO",
    },
    metadata: {
      billing_type: profile.type ?? "",
      ...(profile.regCom ? { reg_com: profile.regCom } : {}),
    },
  });

  const existingTaxIds = await stripe.customers.listTaxIds(customerId, { limit: 20 });

  for (const taxId of existingTaxIds.data) {
    await stripe.customers.deleteTaxId(customerId, taxId.id);
  }

  if (profile.type === "company" && profile.cui) {
    await stripe.customers.createTaxId(customerId, {
      type: "ro_tin",
      value: profile.cui,
    });
  }
}
