-- Frizeo Email (Phase 7): conversion tracking & attribution.
-- Additive marketing_* only. Does not alter booking/auth/Stripe business tables.

BEGIN;

CREATE TABLE IF NOT EXISTS public.marketing_attribution_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_kind text NOT NULL
    CHECK (source_kind IN ('campaign', 'automation')),
  campaign_id uuid REFERENCES public.marketing_campaigns (id) ON DELETE SET NULL,
  automation_id uuid REFERENCES public.marketing_automations (id) ON DELETE SET NULL,
  recipient_id uuid REFERENCES public.marketing_campaign_recipients (id) ON DELETE SET NULL,
  automation_run_id uuid REFERENCES public.marketing_automation_runs (id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.marketing_contacts (id) ON DELETE SET NULL,
  destination_url text NOT NULL,
  utm_campaign text,
  is_test boolean NOT NULL DEFAULT false,
  clicked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketing_attribution_links_source_chk CHECK (
    (source_kind = 'campaign' AND campaign_id IS NOT NULL)
    OR (source_kind = 'automation' AND automation_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS marketing_attribution_links_campaign_id_idx
  ON public.marketing_attribution_links (campaign_id)
  WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketing_attribution_links_automation_id_idx
  ON public.marketing_attribution_links (automation_id)
  WHERE automation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketing_attribution_links_created_at_idx
  ON public.marketing_attribution_links (created_at DESC);
CREATE INDEX IF NOT EXISTS marketing_attribution_links_clicked_at_idx
  ON public.marketing_attribution_links (clicked_at DESC)
  WHERE clicked_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.marketing_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversion_type text NOT NULL
    CHECK (conversion_type IN ('signup', 'trial_started', 'subscription_started')),
  attribution_role text NOT NULL
    CHECK (attribution_role IN ('acquisition', 'lifecycle')),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES public.tenants (id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.marketing_contacts (id) ON DELETE SET NULL,
  attribution_link_id uuid REFERENCES public.marketing_attribution_links (id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.marketing_campaigns (id) ON DELETE SET NULL,
  automation_id uuid REFERENCES public.marketing_automations (id) ON DELETE SET NULL,
  plan_id uuid REFERENCES public.plans (id) ON DELETE SET NULL,
  plan_slug text,
  amount numeric(12, 2),
  currency text,
  billing_interval text,
  mrr_amount numeric(12, 2),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketing_conversions_idempotency_key_key UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS marketing_conversions_campaign_id_idx
  ON public.marketing_conversions (campaign_id)
  WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketing_conversions_automation_id_idx
  ON public.marketing_conversions (automation_id)
  WHERE automation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketing_conversions_type_occurred_idx
  ON public.marketing_conversions (conversion_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS marketing_conversions_tenant_id_idx
  ON public.marketing_conversions (tenant_id)
  WHERE tenant_id IS NOT NULL;

ALTER TABLE public.marketing_attribution_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_conversions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketing_attribution_links_platform_admin_select"
  ON public.marketing_attribution_links;
CREATE POLICY "marketing_attribution_links_platform_admin_select"
ON public.marketing_attribution_links
FOR SELECT
TO authenticated
USING ((SELECT public.is_platform_admin()));

DROP POLICY IF EXISTS "marketing_conversions_platform_admin_select"
  ON public.marketing_conversions;
CREATE POLICY "marketing_conversions_platform_admin_select"
ON public.marketing_conversions
FOR SELECT
TO authenticated
USING ((SELECT public.is_platform_admin()));

REVOKE ALL ON TABLE public.marketing_attribution_links FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.marketing_conversions FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.marketing_attribution_links TO authenticated;
GRANT SELECT ON TABLE public.marketing_conversions TO authenticated;
-- Writes only via service_role (Next.js workers / conversion hooks).

COMMENT ON TABLE public.marketing_attribution_links IS
  'Frizeo Email Phase 7: opaque first-party attribution tokens for campaign/automation CTAs.';
COMMENT ON TABLE public.marketing_conversions IS
  'Frizeo Email Phase 7: signup/trial/paid conversions with last-click attribution.';

COMMIT;
