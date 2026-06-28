import { NextResponse } from "next/server";
import { getCurrentRole } from "@/lib/auth/getCurrentRole";
import {
  createSubscriptionCheckout,
  resolveStripeCustomer,
  retrieveActiveStripeSubscription,
} from "@/lib/billing/stripeCheckout";
import { PLAN_SLUGS, type PlanSlug } from "@/lib/billing/plans";
import { getAppUrl, getStripePriceId } from "@/lib/billing/stripePrices";
import { upgradeStripeSubscription } from "@/lib/billing/upgradeStripeSubscription";
import { stripeErrorMessage } from "@/lib/stripe";
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

    const isAppTrial = subscription.status === "trialing";

    const existingStripeSub = subscription.stripe_subscription_id
      ? await retrieveActiveStripeSubscription(subscription.stripe_subscription_id)
      : null;

    const userEmail = user.email;
    const tenantId = tenant.tenant_id;
    const tenantName = tenant.name;

    async function ensureCustomerId(): Promise<string | NextResponse> {
      const { customerId, clearedStaleId } = await resolveStripeCustomer({
        customerId: subscription.stripe_customer_id as string | null,
        email: userEmail,
        name: tenantName,
        tenantId,
      });

      if (customerId !== subscription.stripe_customer_id || clearedStaleId) {
        const { error: customerSaveError } = await supabaseAdmin
          .from("subscriptions")
          .update({
            stripe_customer_id: customerId,
            ...(clearedStaleId ? { stripe_subscription_id: null } : {}),
          })
          .eq("tenant_id", tenantId);

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

      return customerId;
    }

    if (subscription.stripe_subscription_id && !isAppTrial) {
      const stripeSub = existingStripeSub;

      if (!stripeSub) {
        await supabaseAdmin
          .from("subscriptions")
          .update({ stripe_subscription_id: null })
          .eq("tenant_id", tenant.tenant_id);
      } else if (
        stripeSub.status === "active" ||
        stripeSub.status === "trialing"
      ) {
        const itemId = stripeSub.items.data[0]?.id;

        if (!itemId) {
          return NextResponse.json(
            { error: "Abonament Stripe invalid." },
            { status: 500 }
          );
        }

        const result = await upgradeStripeSubscription({
          subscriptionId: stripeSub.id,
          itemId,
          stripePriceId,
          metadata,
          tenantId: tenant.tenant_id,
        });

        if (!result.ok) {
          return NextResponse.json(
            {
              error: result.error,
              ...(result.authUrl ? { url: result.authUrl } : {}),
            },
            { status: 402 }
          );
        }

        return NextResponse.json({
          success: true,
          planChanged: true,
        });
      } else if (stripeSub.status === "past_due") {
        return NextResponse.json(
          {
            error:
              "Există o plată restantă. Actualizează cardul din „Gestionează facturarea” înainte de a schimba planul.",
          },
          { status: 402 }
        );
      }
    }

    const customerId = await ensureCustomerId();
    if (customerId instanceof NextResponse) return customerId;

    const session = await createSubscriptionCheckout({
      stripePriceId,
      customerId,
      customerEmail: userEmail,
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
