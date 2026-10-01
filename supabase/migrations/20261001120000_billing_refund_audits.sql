-- Platform-admin audit log for Stripe subscription refunds.
-- Additive only. Salon users have no policies; service_role writes from the server.

CREATE TABLE IF NOT EXISTS public.billing_refund_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  initiated_by_user_id uuid,
  initiated_by_email text,
  source text NOT NULL CHECK (source IN ('admin_api', 'stripe_webhook')),
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_invoice_id text,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  stripe_refund_id text,
  amount integer CHECK (amount IS NULL OR amount >= 0),
  currency text,
  refund_kind text NOT NULL CHECK (refund_kind IN ('full', 'partial')),
  status text NOT NULL CHECK (status IN (
    'pending',
    'refunded',
    'cancel_failed',
    'downgrade_failed',
    'reconciled',
    'failed',
    'action_required',
    'observed_partial',
    'observed_full'
  )),
  reconciliation_status text,
  error_message text,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.billing_refund_audits IS
  'Creator-only audit of Stripe subscription refunds. No card data.';

CREATE INDEX IF NOT EXISTS billing_refund_audits_tenant_created_idx
  ON public.billing_refund_audits (tenant_id, created_at DESC);

-- One in-flight or completed full refund per invoice. Failed attempts stay for history.
CREATE UNIQUE INDEX IF NOT EXISTS billing_refund_audits_full_invoice_uidx
  ON public.billing_refund_audits (stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL
    AND refund_kind = 'full'
    AND status <> 'failed';

CREATE UNIQUE INDEX IF NOT EXISTS billing_refund_audits_refund_id_uidx
  ON public.billing_refund_audits (stripe_refund_id)
  WHERE stripe_refund_id IS NOT NULL;

ALTER TABLE public.billing_refund_audits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.billing_refund_audits FROM anon, authenticated;
GRANT ALL ON public.billing_refund_audits TO service_role;
