import { NextResponse } from "next/server";
import { getCurrentRole } from "@/lib/auth/getCurrentRole";
import {
  getOpenInvoicePayUrl,
  retrieveActiveStripeSubscription,
} from "@/lib/billing/changeSubscriptionPlan";
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
      .select("stripe_subscription_id, status")
      .eq("tenant_id", tenant.tenant_id)
      .single();

    if (error || !subscription?.stripe_subscription_id) {
      return NextResponse.json(
        { error: "Nu există o plată restantă." },
        { status: 400 }
      );
    }

    const stripeSub = await retrieveActiveStripeSubscription(
      subscription.stripe_subscription_id
    );

    if (!stripeSub || stripeSub.status !== "past_due") {
      return NextResponse.json(
        { error: "Nu există o plată restantă." },
        { status: 400 }
      );
    }

    const url = await getOpenInvoicePayUrl(stripeSub.id);
    if (!url) {
      return NextResponse.json(
        { error: "Plata nu a putut fi deschisă." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url });
  } catch (err) {
    console.error("billing/pay-invoice:", err);
    return NextResponse.json(
      { error: stripeErrorMessage(err) },
      { status: 500 }
    );
  }
}
