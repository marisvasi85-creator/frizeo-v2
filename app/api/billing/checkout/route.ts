import { NextResponse } from "next/server";
import { getCurrentRole } from "@/lib/auth/getCurrentRole";
import {
  createOrReuseStripeCustomer,
  createSubscriptionCheckout,
} from "@/lib/billing/stripeCheckout";
import { PLAN_SLUGS, type PlanSlug } from "@/lib/billing/plans";
import { getAppUrl, getStripePriceId } from "@/lib/billing/stripePrices";
import { syncStripeSubscription } from "@/lib/billing/syncStripeSubscription";
import { getStripe, stripeErrorMessage } from "@/lib/stripe";
import { getActiveTenant } from "@/lib/tenant/getActiveTenant";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const CHECKOUT_PLANS: PlanSlug[] = [PLAN_SLUGS.PRO, PLAN_SLUGS.PRO_PLUS];

export async function POST(req: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY?.trim()) {
      return NextResponse.json(
        { error: "Plățile online nu sunt configurate." },
        { status: 503 }
      );
    }

    const role = await getCurrentRole();
    if (role !== "owner") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const tenant = await getActiveTenant();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { planId } = body as { planId?: string };

    if (!planId) {
      return NextResponse.json({ error: "Missing planId" }, { status: 400 });
    }

    const { data: targetPlan, error: planError } = await supabaseAdmin
      .from("plans")
      .select("id, slug, name")
      .eq("id", planId)
      .single();

    if (planError || !targetPlan) {
      return NextResponse.json({ error: "Plan invalid" }, { status: 400 });
    }

    const planSlug = targetPlan.slug as PlanSlug;

    if (!CHECKOUT_PLANS.includes(planSlug)) {
      return NextResponse.json(
        { error: "Acest plan nu poate fi achiziționat online." },
        { status: 400 }
      );
    }

    const stripePriceId = getStripePriceId(planSlug);
    if (!stripePriceId) {
      return NextResponse.json(
        { error: "Preț Stripe negăsit pentru plan." },
        { status: 500 }
      );
    }

    const { data: subscription, error: subError } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("tenant_id", tenant.tenant_id)
      .single();

    if (subError || !subscription) {
      return NextResponse.json(
        { error: "Abonament negăsit." },
        { status: 404 }
      );
    }

    const appUrl = getAppUrl();
    const successUrl = `${appUrl}/admin/billing?checkout=success`;
    const cancelUrl = `${appUrl}/admin/billing?checkout=canceled`;
    const metadata = {
      tenant_id: tenant.tenant_id,
      plan_id: targetPlan.id,
      plan_slug: planSlug,
    };

    const stripe = getStripe();

    if (subscription.stripe_subscription_id) {
      const stripeSub = await stripe.subscriptions.retrieve(
        subscription.stripe_subscription_id
      );

      if (
        stripeSub.status === "active" ||
        stripeSub.status === "trialing" ||
        stripeSub.status === "past_due"
      ) {
        const itemId = stripeSub.items.data[0]?.id;

        if (!itemId) {
          return NextResponse.json(
            { error: "Abonament Stripe invalid." },
            { status: 500 }
          );
        }

        const updated = await stripe.subscriptions.update(stripeSub.id, {
          items: [{ id: itemId, price: stripePriceId }],
          proration_behavior: "create_prorations",
          metadata,
        });

        await syncStripeSubscription(updated, tenant.tenant_id);

        return NextResponse.json({
          success: true,
          url: successUrl,
        });
      }
    }

    const customerId = await createOrReuseStripeCustomer({
      customerId: subscription.stripe_customer_id as string | null,
      email: user.email,
      name: tenant.name,
      tenantId: tenant.tenant_id,
    });

    if (customerId !== subscription.stripe_customer_id) {
      const { error: customerSaveError } = await supabaseAdmin
        .from("subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("tenant_id", tenant.tenant_id);

      if (customerSaveError) {
        console.error("stripe_customer_id save:", customerSaveError);
        return NextResponse.json(
          {
            error:
              "Nu s-a putut salva clientul Stripe. Verifică migrarea SQL din Supabase.",
          },
          { status: 500 }
        );
      }
    }

    const session = await createSubscriptionCheckout({
      stripePriceId,
      customerId,
      customerEmail: user.email,
      successUrl,
      cancelUrl,
      metadata,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Nu s-a putut deschide plata." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("billing/checkout:", err);
    return NextResponse.json(
      { error: stripeErrorMessage(err) },
      { status: 500 }
    );
  }
}
