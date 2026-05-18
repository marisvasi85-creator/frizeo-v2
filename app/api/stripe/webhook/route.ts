import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { createSupabasePublicClient } from "@/lib/supabase/public";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

export async function POST(req: Request) {
  const body = await req.text();
  const sig = (await headers()).get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("Webhook signature error:", err.message);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  const supabase = createSupabasePublicClient();

  try {
    // 🔥 1. CHECKOUT COMPLETAT
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;
      const tenantId = session.metadata?.tenant_id;

      if (!tenantId) {
        console.error("Missing tenant_id in metadata");
        return NextResponse.json({ ok: true });
      }

      // 🔥 ia subscription din Stripe
      const subscription = await stripe.subscriptions.retrieve(
        subscriptionId
      );

      const priceId = subscription.items.data[0].price.id;

      // 🔥 map price → plan din DB
      const { data: plan } = await supabase
        .from("plans")
        .select("id")
        .eq("stripe_price_id", priceId)
        .single();

      if (!plan) {
        console.error("Plan not found for price:", priceId);
        return NextResponse.json({ ok: true });
      }

      // 🔥 UPSERT subscription
      await supabase.from("subscriptions").upsert({
        tenant_id: tenantId,
        plan_id: plan.id,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        status: "active",
      });

      console.log("Subscription activated");
    }

    // 🔥 2. SUBSCRIPTION UPDATE
    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;

      await supabase
        .from("subscriptions")
        .update({
          status: sub.status,
        })
        .eq("stripe_subscription_id", sub.id);

      console.log("Subscription updated:", sub.status);
    }

    // 🔥 3. SUBSCRIPTION DELETED (CANCEL)
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;

      await supabase
        .from("subscriptions")
        .update({
          status: "cancelled",
        })
        .eq("stripe_subscription_id", sub.id);

      console.log("Subscription cancelled");
    }

    return NextResponse.json({ received: true });

  } catch (err) {
    console.error("Webhook error:", err);
    return new NextResponse("Webhook handler failed", { status: 500 });
  }
}