import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/app/getAppUrl";
import { getCurrentRole } from "@/lib/auth/getCurrentRole";
import { getStripe, stripeErrorMessage } from "@/lib/stripe";
import { getActiveTenant } from "@/lib/tenant/getActiveTenant";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Opens Stripe Customer Portal so the owner can cancel / manage payment method.
 * Requires Customer Portal enabled in Stripe Dashboard (cancel at period end).
 */
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
      .select("stripe_customer_id, stripe_subscription_id, status")
      .eq("tenant_id", tenant.tenant_id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const customerId = subscription?.stripe_customer_id;
    if (!customerId) {
      return NextResponse.json(
        {
          error:
            "Nu există un client Stripe pe acest cont. Scrie-ne la office@frizeo.ro dacă ai nevoie de ajutor.",
        },
        { status: 400 },
      );
    }

    const appUrl = getAppUrl();
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/admin/billing`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Portalul Stripe nu a putut fi deschis." },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("billing/portal:", err);
    return NextResponse.json(
      { error: stripeErrorMessage(err) },
      { status: 500 },
    );
  }
}
