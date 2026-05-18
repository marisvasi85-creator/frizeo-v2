import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { priceId, tenantId } = await req.json();

  const session = await stripe.checkout.sessions.create({
  mode: "subscription",
  line_items: [
    {
      price: priceId,
      quantity: 1,
    },
  ],
  metadata: {
    tenant_id: tenantId, // 🔥 CRITIC
  },
  success_url: `${process.env.NEXT_PUBLIC_APP_URL}/admin?success=true`,
  cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
});

  return NextResponse.json({ url: session.url });
}