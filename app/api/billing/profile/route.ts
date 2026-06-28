import { NextResponse } from "next/server";
import {
  billingProfileToDbUpdate,
  validateBillingProfileInput,
} from "@/lib/billing/billingProfile";
import { getTenantBillingProfile } from "@/lib/billing/getTenantBillingProfile";
import { resolveStripeCustomer } from "@/lib/billing/stripeCheckout";
import { syncStripeCustomerBilling } from "@/lib/billing/syncStripeCustomerBilling";
import { isAuthError, requireTenantAccess } from "@/lib/auth/requireTenantAccess";
import { getActiveTenant } from "@/lib/tenant/getActiveTenant";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await requireTenantAccess(["owner"]);

    if (isAuthError(auth)) {
      return auth;
    }

    const profile = await getTenantBillingProfile(auth.tenantId);

    return NextResponse.json({ profile });
  } catch (err) {
    console.error("billing/profile GET:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await requireTenantAccess(["owner"]);

    if (isAuthError(auth)) {
      return auth;
    }

    const body = await req.json();
    const validated = validateBillingProfileInput(body);

    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const { error: updateError } = await supabaseAdmin
      .from("tenants")
      .update(billingProfileToDbUpdate(validated.profile))
      .eq("id", auth.tenantId);

    if (updateError) {
      console.error("billing/profile save:", updateError);
      return NextResponse.json(
        { error: "Nu s-au putut salva datele de facturare." },
        { status: 500 }
      );
    }

    const tenant = await getActiveTenant();
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.email && process.env.STRIPE_SECRET_KEY?.trim()) {
      try {
        const { data: sub } = await supabaseAdmin
          .from("subscriptions")
          .select("stripe_customer_id")
          .eq("tenant_id", auth.tenantId)
          .single();

        const { customerId } = await resolveStripeCustomer({
          customerId: (sub?.stripe_customer_id as string | null) ?? null,
          email: user.email,
          name: tenant?.name ?? validated.profile.name ?? "Salon",
          tenantId: auth.tenantId,
        });

        await syncStripeCustomerBilling({
          customerId,
          email: user.email,
          profile: validated.profile,
        });

        if (customerId !== sub?.stripe_customer_id) {
          await supabaseAdmin
            .from("subscriptions")
            .update({ stripe_customer_id: customerId })
            .eq("tenant_id", auth.tenantId);
        }
      } catch (stripeErr) {
        console.error("billing/profile stripe sync:", stripeErr);
      }
    }

    return NextResponse.json({ profile: validated.profile });
  } catch (err) {
    console.error("billing/profile PUT:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
