-- Stripe: ID-uri customer / subscription pe abonamentul salonului
-- Rulează în Supabase SQL Editor.

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id
  ON subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id
  ON subscriptions (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
