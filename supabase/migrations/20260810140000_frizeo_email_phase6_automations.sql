-- Frizeo Email (Phase 6): system automations + persistent runs.
-- Additive / scoped exclusively to marketing_* objects.
-- All seeded system automations are PAUSED (is_active = false).

BEGIN;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_key text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  trigger_type text NOT NULL CHECK (trigger_type IN (
    'user_signed_up',
    'trial_started',
    'trial_ending_7_days',
    'trial_ending_3_days',
    'trial_last_day',
    'trial_expired',
    'subscription_activated'
  )),
  delay_minutes integer NOT NULL DEFAULT 0
    CHECK (delay_minutes >= 0 AND delay_minutes <= 60 * 24 * 60),
  template_id uuid NOT NULL
    REFERENCES public.marketing_email_templates (id) ON DELETE RESTRICT,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(conditions) = 'object'),
  is_system boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketing_automations_key_key UNIQUE (automation_key),
  CONSTRAINT marketing_automations_name_key UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS marketing_automations_active_trigger_idx
  ON public.marketing_automations (is_active, trigger_type)
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.marketing_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL
    REFERENCES public.marketing_automations (id) ON DELETE CASCADE,
  contact_id uuid NOT NULL
    REFERENCES public.marketing_contacts (id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES public.tenants (id) ON DELETE SET NULL,
  trigger_key text NOT NULL,
  trigger_reference text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'pending', 'scheduled', 'processing', 'sent', 'skipped', 'failed', 'cancelled'
  )),
  scheduled_for timestamptz NOT NULL,
  started_at timestamptz,
  sent_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz,
  claimed_at timestamptz,
  claim_token uuid,
  provider text,
  provider_message_id text,
  unsubscribe_token text,
  skip_reason text,
  last_error text,
  is_test boolean NOT NULL DEFAULT false,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz,
  last_event_type text,
  last_event_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketing_automation_runs_idempotency_key
    UNIQUE (automation_id, trigger_reference),
  CONSTRAINT marketing_automation_runs_provider_message_key
    UNIQUE (provider, provider_message_id)
);

CREATE INDEX IF NOT EXISTS marketing_automation_runs_due_idx
  ON public.marketing_automation_runs (status, scheduled_for, next_attempt_at)
  WHERE status IN ('pending', 'scheduled', 'processing');
CREATE INDEX IF NOT EXISTS marketing_automation_runs_automation_idx
  ON public.marketing_automation_runs (automation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS marketing_automation_runs_contact_idx
  ON public.marketing_automation_runs (contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS marketing_automation_runs_status_idx
  ON public.marketing_automation_runs (status, scheduled_for DESC);
CREATE INDEX IF NOT EXISTS marketing_automation_runs_provider_msg_idx
  ON public.marketing_automation_runs (provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_marketing_automations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketing_automations_set_updated_at
  ON public.marketing_automations;
CREATE TRIGGER marketing_automations_set_updated_at
BEFORE UPDATE ON public.marketing_automations
FOR EACH ROW
EXECUTE FUNCTION public.set_marketing_automations_updated_at();

CREATE OR REPLACE FUNCTION public.set_marketing_automation_runs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketing_automation_runs_set_updated_at
  ON public.marketing_automation_runs;
CREATE TRIGGER marketing_automation_runs_set_updated_at
BEFORE UPDATE ON public.marketing_automation_runs
FOR EACH ROW
EXECUTE FUNCTION public.set_marketing_automation_runs_updated_at();

ALTER TABLE public.marketing_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_automation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketing_automations_platform_admin_select"
  ON public.marketing_automations;
CREATE POLICY "marketing_automations_platform_admin_select"
ON public.marketing_automations
FOR SELECT TO authenticated
USING ((SELECT public.is_platform_admin()));

DROP POLICY IF EXISTS "marketing_automations_platform_admin_update"
  ON public.marketing_automations;
CREATE POLICY "marketing_automations_platform_admin_update"
ON public.marketing_automations
FOR UPDATE TO authenticated
USING ((SELECT public.is_platform_admin()))
WITH CHECK ((SELECT public.is_platform_admin()));

DROP POLICY IF EXISTS "marketing_automation_runs_platform_admin_select"
  ON public.marketing_automation_runs;
CREATE POLICY "marketing_automation_runs_platform_admin_select"
ON public.marketing_automation_runs
FOR SELECT TO authenticated
USING ((SELECT public.is_platform_admin()));

REVOKE ALL ON public.marketing_automations FROM PUBLIC, anon;
REVOKE ALL ON public.marketing_automation_runs FROM PUBLIC, anon;
GRANT SELECT, UPDATE ON public.marketing_automations TO authenticated, service_role;
GRANT SELECT ON public.marketing_automation_runs TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.marketing_automation_runs TO service_role;
GRANT INSERT, DELETE ON public.marketing_automations TO service_role;

-- Link webhook events → automation runs (campaign path unchanged).
ALTER TABLE public.marketing_email_events
  ADD COLUMN IF NOT EXISTS automation_run_id uuid
    REFERENCES public.marketing_automation_runs (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS marketing_email_events_automation_run_idx
  ON public.marketing_email_events (automation_run_id, event_timestamp DESC)
  WHERE automation_run_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Seed system automations (PAUSED)
-- ---------------------------------------------------------------------------
INSERT INTO public.marketing_automations (
  automation_key, name, description, trigger_type, delay_minutes,
  template_id, conditions, is_system, is_active
)
SELECT
  seed.automation_key,
  seed.name,
  seed.description,
  seed.trigger_type,
  seed.delay_minutes,
  template.id,
  seed.conditions::jsonb,
  true,
  false
FROM (
  VALUES
    (
      'welcome_after_signup',
      'Welcome after signup',
      'Trimite welcome imediat după crearea contului, doar dacă e eligibil marketing.',
      'user_signed_up',
      0,
      'welcome_ready',
      '{"require_eligible":true}'
    ),
    (
      'check_schedule_services_after_signup',
      'Check schedule & services',
      'Reminder după 1 zi: verifică programul și serviciile.',
      'user_signed_up',
      1440,
      'check_schedule_services',
      '{"require_eligible":true,"require_registered":true}'
    ),
    (
      'share_booking_link_after_signup',
      'Share booking link',
      'Reminder după 2 zile: distribuie linkul de programări.',
      'user_signed_up',
      2880,
      'share_booking_link',
      '{"require_eligible":true,"require_registered":true,"max_bookings":0}'
    ),
    (
      'trial_active_tips',
      'Trial active tips',
      'Tips după 7 zile de la startul trialului, dacă trialul e încă activ.',
      'trial_started',
      10080,
      'trial_use_it',
      '{"require_eligible":true,"require_trialing":true,"require_not_paid":true}'
    ),
    (
      'trial_ending_7_days',
      'Trial — 7 days',
      'Reminder când trialul expiră în 7 zile (Europe/Bucharest).',
      'trial_ending_7_days',
      0,
      'trial_7_days',
      '{"require_eligible":true,"require_trialing":true,"require_not_paid":true}'
    ),
    (
      'trial_ending_3_days',
      'Trial — 3 days',
      'Reminder când trialul expiră în 3 zile (Europe/Bucharest).',
      'trial_ending_3_days',
      0,
      'trial_3_days',
      '{"require_eligible":true,"require_trialing":true,"require_not_paid":true}'
    ),
    (
      'trial_last_day',
      'Trial — last day',
      'Reminder în ultima zi de trial.',
      'trial_last_day',
      0,
      'trial_last_day',
      '{"require_eligible":true,"require_not_paid":true}'
    ),
    (
      'trial_expired',
      'Trial expired',
      'Email la 1 zi după expirarea trialului, o singură dată per trial.',
      'trial_expired',
      1440,
      'trial_expired',
      '{"require_eligible":true,"require_not_paid":true}'
    ),
    (
      'trial_expired_7_days',
      'Win-back — 7 days',
      'Win-back la 7 zile după expirarea trialului.',
      'trial_expired',
      10080,
      'winback_7_days',
      '{"require_eligible":true,"require_not_paid":true}'
    ),
    (
      'subscription_activated',
      'Subscription activated',
      'Mesaj opțional după activarea abonamentului plătit (respectă consent).',
      'subscription_activated',
      0,
      'subscription_active',
      '{"require_eligible":true,"require_paid":true}'
    )
) AS seed(
  automation_key, name, description, trigger_type, delay_minutes,
  template_key, conditions
)
JOIN public.marketing_email_templates template
  ON template.template_key = seed.template_key
 AND template.is_system_template = true
ON CONFLICT (automation_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Condition evaluation helper (execution-time)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.marketing_automation_condition_ok(
  p_contact_id uuid,
  p_conditions jsonb
)
RETURNS TABLE (ok boolean, skip_reason text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_conditions jsonb := coalesce(p_conditions, '{}'::jsonb);
  v_require_eligible boolean := coalesce((v_conditions ->> 'require_eligible')::boolean, true);
  v_require_registered boolean := coalesce((v_conditions ->> 'require_registered')::boolean, false);
  v_require_trialing boolean := coalesce((v_conditions ->> 'require_trialing')::boolean, false);
  v_require_not_paid boolean := coalesce((v_conditions ->> 'require_not_paid')::boolean, false);
  v_require_paid boolean := coalesce((v_conditions ->> 'require_paid')::boolean, false);
  v_max_bookings integer := nullif(v_conditions ->> 'max_bookings', '')::integer;
  v_contact public.marketing_contacts%ROWTYPE;
  v_subscription public.subscriptions%ROWTYPE;
  v_bookings integer := 0;
  v_is_paid boolean := false;
BEGIN
  SELECT * INTO v_contact
  FROM public.marketing_contacts contact
  WHERE contact.id = p_contact_id;

  IF NOT FOUND OR v_contact.deleted_at IS NOT NULL THEN
    RETURN QUERY SELECT false, 'contact_missing_or_deleted';
    RETURN;
  END IF;

  IF v_require_eligible AND NOT public.is_marketing_contact_eligible(p_contact_id) THEN
    RETURN QUERY SELECT false, 'not_eligible';
    RETURN;
  END IF;

  IF v_require_registered AND v_contact.user_id IS NULL THEN
    RETURN QUERY SELECT false, 'not_registered';
    RETURN;
  END IF;

  IF v_contact.tenant_id IS NOT NULL THEN
    SELECT * INTO v_subscription
    FROM public.subscriptions subscription
    WHERE subscription.tenant_id = v_contact.tenant_id
    ORDER BY subscription.created_at DESC NULLS LAST
    LIMIT 1;

    v_is_paid := coalesce(
      v_subscription.status = 'active'
      AND v_subscription.stripe_subscription_id IS NOT NULL,
      false
    );

    SELECT count(*)::integer INTO v_bookings
    FROM public.bookings booking
    WHERE booking.tenant_id = v_contact.tenant_id
      AND booking.status = 'confirmed';
  END IF;

  IF v_require_paid AND NOT v_is_paid THEN
    RETURN QUERY SELECT false, 'not_paid';
    RETURN;
  END IF;

  IF v_require_not_paid AND v_is_paid THEN
    RETURN QUERY SELECT false, 'now_paid';
    RETURN;
  END IF;

  IF v_require_trialing THEN
    IF v_subscription.id IS NULL
       OR v_subscription.status <> 'trialing'
       OR v_subscription.trial_ends_at IS NULL THEN
      RETURN QUERY SELECT false, 'trial_not_active';
      RETURN;
    END IF;
  END IF;

  IF v_max_bookings IS NOT NULL AND v_bookings > v_max_bookings THEN
    RETURN QUERY SELECT false, 'bookings_exceeded';
    RETURN;
  END IF;

  RETURN QUERY SELECT true, NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.marketing_automation_condition_ok(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_automation_condition_ok(uuid, jsonb)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Discovery: create scheduled runs for active system automations
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.discover_marketing_automation_runs(
  p_limit integer DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit integer := greatest(1, least(coalesce(p_limit, 200), 500));
  v_today date := timezone('Europe/Bucharest', now())::date;
  v_inserted integer := 0;
  v_automation public.marketing_automations%ROWTYPE;
BEGIN
  FOR v_automation IN
    SELECT *
    FROM public.marketing_automations automation
    WHERE automation.is_active = true
    ORDER BY automation.automation_key
  LOOP
    IF v_automation.trigger_type = 'user_signed_up' THEN
      WITH candidates AS (
        SELECT
          contact.id AS contact_id,
          contact.user_id,
          contact.tenant_id,
          contact.created_at,
          'signup:' || coalesce(contact.user_id::text, contact.id::text)
            AS trigger_reference
        FROM public.marketing_contacts contact
        WHERE contact.deleted_at IS NULL
          AND contact.user_id IS NOT NULL
          AND contact.created_at <= now()
        ORDER BY contact.created_at DESC
        LIMIT v_limit
      ),
      inserted AS (
        INSERT INTO public.marketing_automation_runs (
          automation_id, contact_id, user_id, tenant_id,
          trigger_key, trigger_reference, status, scheduled_for
        )
        SELECT
          v_automation.id,
          candidate.contact_id,
          candidate.user_id,
          candidate.tenant_id,
          v_automation.trigger_type,
          candidate.trigger_reference,
          'scheduled',
          candidate.created_at + make_interval(mins => v_automation.delay_minutes)
        FROM candidates candidate
        ON CONFLICT (automation_id, trigger_reference) DO NOTHING
        RETURNING 1
      )
      SELECT v_inserted + count(*)::integer INTO v_inserted FROM inserted;

    ELSIF v_automation.trigger_type = 'trial_started' THEN
      WITH candidates AS (
        SELECT
          contact.id AS contact_id,
          contact.user_id,
          contact.tenant_id,
          subscription.id AS subscription_id,
          subscription.created_at AS trial_started_at,
          subscription.trial_ends_at::date AS trial_end_date,
          'trial_tips:' || subscription.id::text || ':' ||
            subscription.trial_ends_at::date::text AS trigger_reference
        FROM public.marketing_contacts contact
        JOIN public.subscriptions subscription
          ON subscription.tenant_id = contact.tenant_id
        WHERE contact.deleted_at IS NULL
          AND contact.tenant_id IS NOT NULL
          AND subscription.status = 'trialing'
          AND subscription.trial_ends_at IS NOT NULL
          AND coalesce(subscription.stripe_subscription_id, '') = ''
        ORDER BY subscription.created_at DESC
        LIMIT v_limit
      ),
      inserted AS (
        INSERT INTO public.marketing_automation_runs (
          automation_id, contact_id, user_id, tenant_id,
          trigger_key, trigger_reference, status, scheduled_for
        )
        SELECT
          v_automation.id,
          candidate.contact_id,
          candidate.user_id,
          candidate.tenant_id,
          v_automation.trigger_type,
          candidate.trigger_reference,
          'scheduled',
          candidate.trial_started_at + make_interval(mins => v_automation.delay_minutes)
        FROM candidates candidate
        ON CONFLICT (automation_id, trigger_reference) DO NOTHING
        RETURNING 1
      )
      SELECT v_inserted + count(*)::integer INTO v_inserted FROM inserted;

    ELSIF v_automation.trigger_type IN (
      'trial_ending_7_days', 'trial_ending_3_days', 'trial_last_day'
    ) THEN
      WITH candidates AS (
        SELECT
          contact.id AS contact_id,
          contact.user_id,
          contact.tenant_id,
          subscription.id AS subscription_id,
          subscription.trial_ends_at::date AS trial_end_date,
          CASE v_automation.trigger_type
            WHEN 'trial_ending_7_days' THEN
              'trial_d7:' || subscription.id::text || ':' ||
                subscription.trial_ends_at::date::text
            WHEN 'trial_ending_3_days' THEN
              'trial_d3:' || subscription.id::text || ':' ||
                subscription.trial_ends_at::date::text
            ELSE
              'trial_d0:' || subscription.id::text || ':' ||
                subscription.trial_ends_at::date::text
          END AS trigger_reference
        FROM public.marketing_contacts contact
        JOIN public.subscriptions subscription
          ON subscription.tenant_id = contact.tenant_id
        WHERE contact.deleted_at IS NULL
          AND contact.tenant_id IS NOT NULL
          AND subscription.status = 'trialing'
          AND subscription.trial_ends_at IS NOT NULL
          AND coalesce(subscription.stripe_subscription_id, '') = ''
          AND (
            (
              v_automation.trigger_type = 'trial_ending_7_days'
              AND subscription.trial_ends_at::date = v_today + 7
            )
            OR (
              v_automation.trigger_type = 'trial_ending_3_days'
              AND subscription.trial_ends_at::date = v_today + 3
            )
            OR (
              v_automation.trigger_type = 'trial_last_day'
              AND subscription.trial_ends_at::date = v_today
            )
          )
        LIMIT v_limit
      ),
      inserted AS (
        INSERT INTO public.marketing_automation_runs (
          automation_id, contact_id, user_id, tenant_id,
          trigger_key, trigger_reference, status, scheduled_for
        )
        SELECT
          v_automation.id,
          candidate.contact_id,
          candidate.user_id,
          candidate.tenant_id,
          v_automation.trigger_type,
          candidate.trigger_reference,
          'scheduled',
          timezone('Europe/Bucharest', v_today::timestamp)
        FROM candidates candidate
        ON CONFLICT (automation_id, trigger_reference) DO NOTHING
        RETURNING 1
      )
      SELECT v_inserted + count(*)::integer INTO v_inserted FROM inserted;

    ELSIF v_automation.trigger_type = 'trial_expired' THEN
      WITH candidates AS (
        SELECT
          contact.id AS contact_id,
          contact.user_id,
          contact.tenant_id,
          subscription.id AS subscription_id,
          subscription.trial_ends_at AS trial_ends_at,
          CASE
            WHEN v_automation.automation_key = 'trial_expired_7_days' THEN
              'trial_winback:' || subscription.id::text || ':' ||
                subscription.trial_ends_at::date::text
            ELSE
              'trial_expired:' || subscription.id::text || ':' ||
                subscription.trial_ends_at::date::text
          END AS trigger_reference
        FROM public.marketing_contacts contact
        JOIN public.subscriptions subscription
          ON subscription.tenant_id = contact.tenant_id
        WHERE contact.deleted_at IS NULL
          AND contact.tenant_id IS NOT NULL
          AND subscription.trial_ends_at IS NOT NULL
          AND subscription.trial_ends_at::date < v_today
          AND coalesce(subscription.stripe_subscription_id, '') = ''
          AND coalesce(subscription.status, '') <> 'active'
          AND (
            (
              v_automation.automation_key = 'trial_expired'
              AND subscription.trial_ends_at::date <= v_today - 1
            )
            OR (
              v_automation.automation_key = 'trial_expired_7_days'
              AND subscription.trial_ends_at::date <= v_today - 7
            )
          )
        ORDER BY subscription.trial_ends_at DESC
        LIMIT v_limit
      ),
      inserted AS (
        INSERT INTO public.marketing_automation_runs (
          automation_id, contact_id, user_id, tenant_id,
          trigger_key, trigger_reference, status, scheduled_for
        )
        SELECT
          v_automation.id,
          candidate.contact_id,
          candidate.user_id,
          candidate.tenant_id,
          v_automation.trigger_type,
          candidate.trigger_reference,
          'scheduled',
          candidate.trial_ends_at + make_interval(mins => v_automation.delay_minutes)
        FROM candidates candidate
        ON CONFLICT (automation_id, trigger_reference) DO NOTHING
        RETURNING 1
      )
      SELECT v_inserted + count(*)::integer INTO v_inserted FROM inserted;

    ELSIF v_automation.trigger_type = 'subscription_activated' THEN
      WITH candidates AS (
        SELECT
          contact.id AS contact_id,
          contact.user_id,
          contact.tenant_id,
          subscription.id AS subscription_id,
          coalesce(subscription.updated_at, subscription.created_at, now())
            AS activated_at,
          'sub_active:' || subscription.id::text AS trigger_reference
        FROM public.marketing_contacts contact
        JOIN public.subscriptions subscription
          ON subscription.tenant_id = contact.tenant_id
        WHERE contact.deleted_at IS NULL
          AND contact.tenant_id IS NOT NULL
          AND subscription.status = 'active'
          AND subscription.stripe_subscription_id IS NOT NULL
        ORDER BY coalesce(subscription.updated_at, subscription.created_at) DESC
        LIMIT v_limit
      ),
      inserted AS (
        INSERT INTO public.marketing_automation_runs (
          automation_id, contact_id, user_id, tenant_id,
          trigger_key, trigger_reference, status, scheduled_for
        )
        SELECT
          v_automation.id,
          candidate.contact_id,
          candidate.user_id,
          candidate.tenant_id,
          v_automation.trigger_type,
          candidate.trigger_reference,
          'scheduled',
          candidate.activated_at + make_interval(mins => v_automation.delay_minutes)
        FROM candidates candidate
        ON CONFLICT (automation_id, trigger_reference) DO NOTHING
        RETURNING 1
      )
      SELECT v_inserted + count(*)::integer INTO v_inserted FROM inserted;
    END IF;
  END LOOP;

  -- Cancel future scheduled runs for paused automations (not processing).
  UPDATE public.marketing_automation_runs run
  SET status = 'cancelled',
      cancelled_at = coalesce(run.cancelled_at, now()),
      skip_reason = coalesce(run.skip_reason, 'automation_paused'),
      completed_at = coalesce(run.completed_at, now())
  FROM public.marketing_automations automation
  WHERE automation.id = run.automation_id
    AND automation.is_active = false
    AND run.is_test = false
    AND run.status IN ('pending', 'scheduled')
    AND (run.claimed_at IS NULL);

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'today', v_today
  );
END;
$$;

REVOKE ALL ON FUNCTION public.discover_marketing_automation_runs(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discover_marketing_automation_runs(integer)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Claim due automation runs (concurrency-safe)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_marketing_automation_run_batch(
  p_batch_size integer DEFAULT 5,
  p_lease_seconds integer DEFAULT 600,
  p_max_attempts integer DEFAULT 4
)
RETURNS TABLE (
  run_id uuid,
  automation_id uuid,
  automation_key text,
  contact_id uuid,
  contact_email text,
  first_name text,
  last_name text,
  tenant_id uuid,
  user_id uuid,
  trigger_key text,
  trigger_reference text,
  attempt_count integer,
  claim_token uuid,
  unsubscribe_token text,
  template_id uuid,
  subject text,
  preview_text text,
  heading text,
  body_text text,
  image_url text,
  cta_text text,
  cta_url text,
  footer_text text,
  cta_url_type text,
  conditions jsonb,
  trial_end_date date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_batch integer := greatest(1, least(coalesce(p_batch_size, 5), 10));
  v_lease integer := greatest(60, least(coalesce(p_lease_seconds, 600), 3600));
  v_max integer := greatest(1, least(coalesce(p_max_attempts, 4), 10));
BEGIN
  -- Recover stale processing leases.
  UPDATE public.marketing_automation_runs run
  SET status = CASE
        WHEN run.attempt_count >= v_max THEN 'failed'
        ELSE 'scheduled'
      END,
      next_attempt_at = CASE
        WHEN run.attempt_count >= v_max THEN NULL
        ELSE now()
      END,
      last_error = CASE
        WHEN run.attempt_count >= v_max THEN 'claim_lease_expired'
        ELSE run.last_error
      END,
      completed_at = CASE
        WHEN run.attempt_count >= v_max THEN coalesce(run.completed_at, now())
        ELSE NULL
      END,
      claim_token = NULL,
      claimed_at = NULL
  WHERE run.status = 'processing'
    AND run.claimed_at IS NOT NULL
    AND run.claimed_at < now() - make_interval(secs => v_lease);

  RETURN QUERY
  WITH due AS (
    SELECT run.id
    FROM public.marketing_automation_runs run
    JOIN public.marketing_automations automation
      ON automation.id = run.automation_id
    WHERE run.is_test = false
      AND automation.is_active = true
      AND run.status IN ('pending', 'scheduled')
      AND run.scheduled_for <= now()
      AND coalesce(run.next_attempt_at, run.scheduled_for) <= now()
      AND run.attempt_count < v_max
    ORDER BY coalesce(run.next_attempt_at, run.scheduled_for), run.created_at
    FOR UPDATE OF run SKIP LOCKED
    LIMIT v_batch
  ),
  claimed AS (
    UPDATE public.marketing_automation_runs run
    SET status = 'processing',
        started_at = coalesce(run.started_at, now()),
        claimed_at = now(),
        claim_token = gen_random_uuid(),
        attempt_count = run.attempt_count + 1,
        unsubscribe_token = coalesce(
          run.unsubscribe_token,
          encode(extensions.gen_random_bytes(32), 'hex')
        ),
        next_attempt_at = NULL,
        last_error = NULL
    FROM due
    WHERE run.id = due.id
    RETURNING run.*
  ),
  persist_tokens AS (
    INSERT INTO public.marketing_unsubscribe_tokens AS unsub (contact_id, token_hash)
    SELECT
      claimed.contact_id,
      encode(extensions.digest(claimed.unsubscribe_token, 'sha256'), 'hex')
    FROM claimed
    WHERE claimed.contact_id IS NOT NULL
      AND claimed.unsubscribe_token IS NOT NULL
    ON CONFLICT (token_hash) DO NOTHING
    RETURNING unsub.contact_id
  )
  SELECT
    claimed.id,
    claimed.automation_id,
    automation.automation_key,
    claimed.contact_id,
    contact.email,
    contact.first_name,
    contact.last_name,
    claimed.tenant_id,
    claimed.user_id,
    claimed.trigger_key,
    claimed.trigger_reference,
    claimed.attempt_count,
    claimed.claim_token,
    claimed.unsubscribe_token,
    template.id,
    template.subject,
    template.preview_text,
    template.heading,
    template.body_text,
    template.image_url,
    template.cta_text,
    template.cta_url,
    template.footer_text,
    template.cta_url_type,
    automation.conditions,
    subscription.trial_ends_at::date
  FROM claimed
  JOIN public.marketing_automations automation
    ON automation.id = claimed.automation_id
  JOIN public.marketing_email_templates template
    ON template.id = automation.template_id
  JOIN public.marketing_contacts contact
    ON contact.id = claimed.contact_id
  LEFT JOIN public.subscriptions subscription
    ON subscription.tenant_id = claimed.tenant_id
  LEFT JOIN persist_tokens ON persist_tokens.contact_id = claimed.contact_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_marketing_automation_run_batch(integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_marketing_automation_run_batch(integer, integer, integer)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Record run result
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_marketing_automation_run_result(
  p_run_id uuid,
  p_claim_token uuid,
  p_outcome text,
  p_provider text DEFAULT NULL,
  p_provider_message_id text DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_skip_reason text DEFAULT NULL,
  p_temporary boolean DEFAULT false,
  p_retry_delay_seconds integer DEFAULT 60,
  p_max_attempts integer DEFAULT 4
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_run public.marketing_automation_runs%ROWTYPE;
  v_max integer := greatest(1, least(coalesce(p_max_attempts, 4), 10));
  v_delay integer := greatest(1, least(coalesce(p_retry_delay_seconds, 60), 86400));
BEGIN
  IF p_outcome NOT IN ('sent', 'skipped', 'failed', 'retry') THEN
    RAISE EXCEPTION 'invalid_automation_run_outcome';
  END IF;

  SELECT * INTO v_run
  FROM public.marketing_automation_runs run
  WHERE run.id = p_run_id
    AND run.claim_token = p_claim_token
    AND run.status = 'processing'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF p_outcome = 'sent' THEN
    UPDATE public.marketing_automation_runs
    SET status = 'sent',
        sent_at = now(),
        completed_at = now(),
        provider = coalesce(nullif(trim(p_provider), ''), 'resend'),
        provider_message_id = nullif(trim(p_provider_message_id), ''),
        claim_token = NULL,
        claimed_at = NULL,
        last_error = NULL,
        skip_reason = NULL
    WHERE id = p_run_id;
    RETURN true;
  END IF;

  IF p_outcome = 'skipped' THEN
    UPDATE public.marketing_automation_runs
    SET status = 'skipped',
        completed_at = now(),
        skip_reason = left(coalesce(nullif(trim(p_skip_reason), ''), 'skipped'), 200),
        claim_token = NULL,
        claimed_at = NULL,
        last_error = NULL
    WHERE id = p_run_id;
    RETURN true;
  END IF;

  IF p_outcome = 'retry' AND p_temporary AND v_run.attempt_count < v_max THEN
    UPDATE public.marketing_automation_runs
    SET status = 'scheduled',
        next_attempt_at = now() + make_interval(secs => v_delay),
        last_error = left(coalesce(nullif(trim(p_error_message), ''), 'retry'), 1000),
        claim_token = NULL,
        claimed_at = NULL
    WHERE id = p_run_id;
    RETURN true;
  END IF;

  UPDATE public.marketing_automation_runs
  SET status = 'failed',
      completed_at = now(),
      last_error = left(coalesce(nullif(trim(p_error_message), ''), 'failed'), 1000),
      claim_token = NULL,
      claimed_at = NULL
  WHERE id = p_run_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_marketing_automation_run_result(
  uuid, uuid, text, text, text, text, text, boolean, integer, integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_marketing_automation_run_result(
  uuid, uuid, text, text, text, text, text, boolean, integer, integer
) TO service_role;

-- ---------------------------------------------------------------------------
-- Webhook processor for automation runs (parallel to campaign path)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_marketing_automation_email_event(
  p_provider text,
  p_provider_event_id text,
  p_provider_message_id text,
  p_type text,
  p_event_timestamp timestamptz,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_bounce_type text DEFAULT NULL,
  p_bounce_subtype text DEFAULT NULL,
  p_bounce_reason text DEFAULT NULL,
  p_permanent_bounce boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_run public.marketing_automation_runs%ROWTYPE;
  v_event_id uuid;
  v_safe_metadata jsonb;
BEGIN
  IF p_provider <> 'resend'
     OR p_provider_event_id IS NULL
     OR p_provider_message_id IS NULL
     OR p_type NOT IN (
       'sent', 'delivered', 'delivery_delayed', 'opened', 'clicked',
       'bounced', 'complained', 'failed', 'suppressed'
     )
     OR p_event_timestamp IS NULL THEN
    RAISE EXCEPTION 'invalid_marketing_automation_email_event';
  END IF;

  v_safe_metadata := CASE
    WHEN jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) = 'object'
      THEN coalesce(p_metadata, '{}'::jsonb)
    ELSE '{}'::jsonb
  END;

  SELECT run.* INTO v_run
  FROM public.marketing_automation_runs run
  WHERE run.provider = p_provider
    AND run.provider_message_id = p_provider_message_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'result', 'unmatched',
      'matched', false,
      'duplicate', false
    );
  END IF;

  INSERT INTO public.marketing_email_events (
    provider, provider_event_id, provider_message_id,
    campaign_id, recipient_id, automation_run_id, contact_id,
    type, event_timestamp, metadata
  )
  VALUES (
    p_provider,
    trim(p_provider_event_id),
    trim(p_provider_message_id),
    NULL,
    NULL,
    v_run.id,
    v_run.contact_id,
    p_type,
    p_event_timestamp,
    v_safe_metadata
  )
  ON CONFLICT (provider, provider_event_id) DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object(
      'result', 'duplicate',
      'matched', true,
      'duplicate', true,
      'automation_run_id', v_run.id
    );
  END IF;

  IF p_type = 'delivered' THEN
    UPDATE public.marketing_automation_runs
    SET delivered_at = coalesce(delivered_at, p_event_timestamp)
    WHERE id = v_run.id;
  ELSIF p_type = 'opened' THEN
    UPDATE public.marketing_automation_runs
    SET opened_at = coalesce(opened_at, p_event_timestamp)
    WHERE id = v_run.id;
  ELSIF p_type = 'clicked' THEN
    UPDATE public.marketing_automation_runs
    SET clicked_at = coalesce(clicked_at, p_event_timestamp)
    WHERE id = v_run.id;
  ELSIF p_type = 'bounced' THEN
    UPDATE public.marketing_automation_runs
    SET bounced_at = coalesce(bounced_at, p_event_timestamp),
        last_error = left(coalesce(nullif(trim(p_bounce_reason), ''), 'bounced'), 1000)
    WHERE id = v_run.id;

    IF p_permanent_bounce AND v_run.contact_id IS NOT NULL THEN
      UPDATE public.marketing_contacts contact
      SET status = CASE
            WHEN contact.status IN ('complained', 'unsubscribed') THEN contact.status
            ELSE 'bounced'
          END,
          marketing_consent = false,
          bounced_at = coalesce(contact.bounced_at, p_event_timestamp),
          suppression_reason = left(
            coalesce(nullif(trim(p_bounce_reason), ''), 'permanent_bounce'),
            1000
          )
      WHERE contact.id = v_run.contact_id;
    END IF;
  ELSIF p_type = 'complained' THEN
    UPDATE public.marketing_automation_runs
    SET complained_at = coalesce(complained_at, p_event_timestamp)
    WHERE id = v_run.id;

    IF v_run.contact_id IS NOT NULL THEN
      UPDATE public.marketing_contacts contact
      SET status = 'complained',
          marketing_consent = false,
          complained_at = coalesce(contact.complained_at, p_event_timestamp),
          suppression_reason = 'spam_complaint'
      WHERE contact.id = v_run.contact_id;
    END IF;
  END IF;

  UPDATE public.marketing_automation_runs
  SET last_event_type = CASE
        WHEN last_event_at IS NULL OR p_event_timestamp >= last_event_at
          THEN p_type ELSE last_event_type END,
      last_event_at = CASE
        WHEN last_event_at IS NULL OR p_event_timestamp >= last_event_at
          THEN p_event_timestamp ELSE last_event_at END
  WHERE id = v_run.id;

  RETURN jsonb_build_object(
    'result', 'processed',
    'matched', true,
    'duplicate', false,
    'event_id', v_event_id,
    'automation_run_id', v_run.id,
    'contact_id', v_run.contact_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_marketing_automation_email_event(
  text, text, text, text, timestamptz, jsonb, text, text, text, boolean
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_marketing_automation_email_event(
  text, text, text, text, timestamptz, jsonb, text, text, text, boolean
) TO service_role;

-- Toggle active (platform admin via service role / authenticated RLS update)
CREATE OR REPLACE FUNCTION public.set_marketing_automation_active(
  p_automation_id uuid,
  p_is_active boolean
)
RETURNS public.marketing_automations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.marketing_automations%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.marketing_automations automation
  SET is_active = coalesce(p_is_active, false)
  WHERE automation.id = p_automation_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'automation_not_found';
  END IF;

  IF v_row.is_active = false THEN
    UPDATE public.marketing_automation_runs run
    SET status = 'cancelled',
        cancelled_at = coalesce(run.cancelled_at, now()),
        skip_reason = coalesce(run.skip_reason, 'automation_paused'),
        completed_at = coalesce(run.completed_at, now())
    WHERE run.automation_id = v_row.id
      AND run.is_test = false
      AND run.status IN ('pending', 'scheduled');
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.set_marketing_automation_active(uuid, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_marketing_automation_active(uuid, boolean)
  TO authenticated, service_role;

COMMENT ON TABLE public.marketing_automations IS
  'Frizeo Email system automations (Phase 6). Seeded paused.';
COMMENT ON TABLE public.marketing_automation_runs IS
  'Persistent automation execution state with idempotent trigger_reference.';

COMMIT;
