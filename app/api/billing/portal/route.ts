import { NextResponse } from "next/server";
import { getCurrentRole } from "@/lib/auth/getCurrentRole";
import { createBillingPortalSession } from "@/lib/billing/upgradeStripeSubscription";
import { getAppUrl } from "@/lib/billing/stripePrices";
import { stripeErrorMessage } from "@/lib/stripe";
import { getActiveTenant } from "@/lib/tenant/getActiveTenant";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST() {
  try {
    const role = await getCurrentRole();
    if (role !== "owner") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const tenant = await getActiveTenant();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: subscription, error } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("tenant_id", tenant.tenant_id)
      .single();

    if (error || !subscription?.stripe_customer_id) {
      return NextResponse.json(
        {
          error:
            "Nu există încă un cont de facturare Stripe. Alege un plan plătit mai întâi.",
        },
        { status: 400 }
      );
    }

    const session = await createBillingPortalSession({
      customerId: subscription.stripe_customer_id,
      returnUrl: `${getAppUrl()}/admin/billing`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Portalul Stripe nu a putut fi deschis." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("billing/portal:", err);
    return NextResponse.json(
      { error: stripeErrorMessage(err) },
      { status: 500 }
    );
  }
}
