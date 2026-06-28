import { NextResponse } from "next/server";
import { getCurrentRole } from "@/lib/auth/getCurrentRole";
import {
  createSubscriptionCheckout,
  resolveStripeCustomer,
} from "@/lib/billing/stripeCheckout";
import {
  changeSubscriptionPlan,
  getOpenInvoicePayUrl,
  retrieveActiveStripeSubscription,
} from "@/lib/billing/changeSubscriptionPlan";
import { PLAN_SLUGS, isPlanDowngrade, type PlanSlug } from "@/lib/billing/plans";
import { getAppUrl, getStripePriceId } from "@/lib/billing/stripePrices";
import { stripeErrorMessage } from "@/lib/stripe";
import { isTenantBillingProfileComplete } from "@/lib/billing/getTenantBillingProfile";
import { getActiveTenant } from "@/lib/tenant/getActiveTenant";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const CHECKOUT_PLANS: PlanSlug[] = [PLAN_SLUGS.PRO, PLAN_SLUGS.PRO_PLUS];

const ACTIVE_STRIPE_STATUSES = new Set(["active", "trialing"]);

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

    const billingComplete = await isTenantBillingProfileComplete(
      tenant.tenant_id
    );

    if (!billingComplete) {
      return NextResponse.json(
        {
          error:
            "Completează datele de facturare înainte de a plăti.",
        },
        { status: 400 }
      );
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
        {
          error:
            "Price ID Stripe lipsă. Adaugă STRIPE_PRICE_PRO și STRIPE_PRICE_PRO_PLUS în Vercel.",
        },
        { status: 500 }
      );
    }

    const { data: subscription, error: subError } = await supabaseAdmin
      .from("subscriptions")
      .select("*, plans(slug)")
      .eq("tenant_id", tenant.tenant_id)
      .single();

    if (subError || !subscription) {
      return NextResponse.json(
        { error: "Abonament negăsit." },
        { status: 404 }
      );
    }

    const currentPlanSlug = (
      subscription.plans as { slug?: string } | null
    )?.slug;

    const isAppTrial =
      subscription.status === "trialing" && !subscription.stripe_subscription_id;

    if (!isAppTrial && isPlanDowngrade(currentPlanSlug, planSlug)) {
      return NextResponse.json(
        { error: "Beneficiezi deja de un plan mai mare." },
        { status: 400 }
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

    const existingStripeSub = subscription.stripe_subscription_id
      ? await retrieveActiveStripeSubscription(subscription.stripe_subscription_id)
      : null;

    if (existingStripeSub?.status === "past_due") {
      const payUrl = await getOpenInvoicePayUrl(existingStripeSub.id);
      if (payUrl) {
        return NextResponse.json({ url: payUrl });
      }

      return NextResponse.json(
        { error: "Există o plată restantă. Contactează-ne dacă ai nevoie de ajutor." },
        { status: 402 }
      );
    }

    if (
      existingStripeSub &&
      ACTIVE_STRIPE_STATUSES.has(existingStripeSub.status) &&
      !isAppTrial
    ) {
      const currentPriceId = existingStripeSub.items.data[0]?.price.id;

      if (currentPriceId === stripePriceId) {
        return NextResponse.json(
          { error: "Ești deja pe acest plan." },
          { status: 400 }
        );
      }

      const itemId = existingStripeSub.items.data[0]?.id;
      if (!itemId) {
        return NextResponse.json(
          { error: "Abonament Stripe invalid." },
          { status: 500 }
        );
      }

      const result = await changeSubscriptionPlan({
        subscriptionId: existingStripeSub.id,
        itemId,
        stripePriceId,
        metadata,
        tenantId: tenant.tenant_id,
      });

      if (!result.ok) {
        return NextResponse.json(
          {
            error: result.error,
            ...(result.payUrl ? { url: result.payUrl } : {}),
          },
          { status: 402 }
        );
      }

      return NextResponse.json({ success: true });
    }

    if (subscription.stripe_subscription_id && !existingStripeSub) {
      await supabaseAdmin
        .from("subscriptions")
        .update({ stripe_subscription_id: null })
        .eq("tenant_id", tenant.tenant_id);
    }

    const { customerId, clearedStaleId } = await resolveStripeCustomer({
      customerId: subscription.stripe_customer_id as string | null,
      email: user.email,
      name: tenant.name,
      tenantId: tenant.tenant_id,
    });

    if (customerId !== subscription.stripe_customer_id || clearedStaleId) {
      const { error: customerSaveError } = await supabaseAdmin
        .from("subscriptions")
        .update({
          stripe_customer_id: customerId,
          ...(clearedStaleId ? { stripe_subscription_id: null } : {}),
        })
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
