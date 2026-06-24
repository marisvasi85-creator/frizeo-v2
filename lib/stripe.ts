import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();

  if (!key) {
    throw new Error("STRIPE_SECRET_KEY lipsește din configurare.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(key, {
      apiVersion: "2026-04-22.dahlia",
    });
  }

  return stripeClient;
}

export function stripeErrorMessage(err: unknown): string {
  if (err instanceof Stripe.errors.StripeError) {
    return err.message;
  }

  if (err instanceof Error) {
    return err.message;
  }

  return "Eroare necunoscută la plată.";
}
