import { NextResponse } from "next/server";
import { getCurrentRole } from "@/lib/auth/getCurrentRole";
import { ensureStripeCustomerWithBilling } from "@/lib/billing/ensureStripeCustomerWithBilling";
import {
  createBankTransferSubscription,
  createSubscriptionCheckout,
  retrieveActiveStripeSubscription,
  type PaymentMethodChoice,
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
    const { planId, paymentMethod: rawPaymentMethod } = body as {
      planId?: string;
      paymentMethod?: PaymentMethodChoice;
    };

    const paymentMethod: PaymentMethodChoice =
      rawPaymentMethod === "bank_transfer" ? "bank_transfer" : "card";

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
        {
          error:
            "Price ID Stripe lipsă. Adaugă STRIPE_PRICE_PRO și STRIPE_PRICE_PRO_PLUS în Vercel.",
        },
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
    const successUrl = `${appUrl}/admin/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${appUrl}/admin/billing?checkout=canceled`;
    const metadata = {
      tenant_id: tenant.tenant_id,
      plan_id: targetPlan.id,
      plan_slug: planSlug,
    };

    const billingReady = await ensureStripeCustomerWithBilling({
      tenantId: tenant.tenant_id,
      tenantName: tenant.name,
      email: user.email,
    });

    if (!billingReady.ok) {
      return NextResponse.json(
        { error: billingReady.error },
        { status: billingReady.status }
      );
    }

    const customerId = billingReady.customerId;

    const stripe = getStripe();

    const existingStripeSub = subscription.stripe_subscription_id
      ? await retrieveActiveStripeSubscription(subscription.stripe_subscription_id)
      : null;

    const hasActiveStripeSub =
      existingStripeSub &&
      (existingStripeSub.status === "active" ||
        existingStripeSub.status === "trialing" ||
        existingStripeSub.status === "past_due");

    if (paymentMethod === "bank_transfer") {
      if (hasActiveStripeSub) {
        return NextResponse.json(
          {
            error:
              "Transfer bancar disponibil doar la prima activare (de pe Free). Pentru schimbare plan folosește cardul.",
          },
          { status: 400 }
        );
      }

      if (
        existingStripeSub &&
        (existingStripeSub.status === "incomplete" ||
          existingStripeSub.status === "paused")
      ) {
        await stripe.subscriptions.cancel(existingStripeSub.id);
        await supabaseAdmin
          .from("subscriptions")
          .update({ stripe_subscription_id: null })
          .eq("tenant_id", tenant.tenant_id);
      }

      const { subscription: bankSub, invoiceUrl } =
        await createBankTransferSubscription({
          customerId,
          stripePriceId,
          metadata,
        });

      await syncStripeSubscription(bankSub, tenant.tenant_id);

      if (!invoiceUrl) {
        return NextResponse.json(
          {
            error:
              "Factura nu a putut fi generată. Verifică în Stripe că transferul bancar e activat.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        url: invoiceUrl,
        bankTransfer: true,
      });
    }

    if (subscription.stripe_subscription_id) {
      const stripeSub = existingStripeSub;

      if (!stripeSub) {
        await supabaseAdmin
          .from("subscriptions")
          .update({ stripe_subscription_id: null })
          .eq("tenant_id", tenant.tenant_id);
      } else if (
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
