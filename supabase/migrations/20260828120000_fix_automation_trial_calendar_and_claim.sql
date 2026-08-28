-- Automations: Bucharest calendar dates for trial countdown, latest-subscription
-- join on claim (no duplicate sends), and discovery that skips already-created runs.

BEGIN;

CREATE OR REPLACE FUNCTION public.marketing_bucharest_date(p_ts timestamptz)
RETURNS date
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_ts IS NULL THEN NULL
    ELSE timezone('Europe/Bucharest', p_ts)::date
  END;
$$;

REVOKE ALL ON FUNCTION public.marketing_bucharest_date(timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_bucharest_date(timestamptz)
  TO service_role;

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
          AND (
            NOT coalesce((v_automation.conditions ->> 'require_incomplete_salon_address')::boolean, false)
            OR (
              contact.tenant_id IS NOT NULL
              AND NOT public.is_tenant_salon_address_complete(contact.tenant_id)
            )
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.marketing_automation_runs existing
            WHERE existing.automation_id = v_automation.id
              AND existing.trigger_reference =
                'signup:' || coalesce(contact.user_id::text, contact.id::text)
          )
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
          public.marketing_bucharest_date(subscription.trial_ends_at) AS trial_end_date,
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
          AND NOT EXISTS (
            SELECT 1
            FROM public.marketing_automation_runs existing
            WHERE existing.automation_id = v_automation.id
              AND existing.trigger_reference =
                'trial_tips:' || subscription.id::text || ':' ||
                  subscription.trial_ends_at::date::text
          )
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
          public.marketing_bucharest_date(subscription.trial_ends_at) AS trial_end_date,
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
              AND public.marketing_bucharest_date(subscription.trial_ends_at) = v_today + 7
            )
            OR (
              v_automation.trigger_type = 'trial_ending_3_days'
              AND public.marketing_bucharest_date(subscription.trial_ends_at) = v_today + 3
            )
            OR (
              v_automation.trigger_type = 'trial_last_day'
              AND public.marketing_bucharest_date(subscription.trial_ends_at) = v_today
            )
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.marketing_automation_runs existing
            WHERE existing.automation_id = v_automation.id
              AND existing.trigger_reference = CASE v_automation.trigger_type
                WHEN 'trial_ending_7_days' THEN
                  'trial_d7:' || subscription.id::text || ':' ||
                    subscription.trial_ends_at::date::text
                WHEN 'trial_ending_3_days' THEN
                  'trial_d3:' || subscription.id::text || ':' ||
                    subscription.trial_ends_at::date::text
                ELSE
                  'trial_d0:' || subscription.id::text || ':' ||
                    subscription.trial_ends_at::date::text
              END
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
          AND public.marketing_bucharest_date(subscription.trial_ends_at) < v_today
          AND coalesce(subscription.stripe_subscription_id, '') = ''
          AND coalesce(subscription.status, '') <> 'active'
          AND (
            (
              v_automation.automation_key = 'trial_expired'
              AND public.marketing_bucharest_date(subscription.trial_ends_at) <= v_today - 1
            )
            OR (
              v_automation.automation_key = 'trial_expired_7_days'
              AND public.marketing_bucharest_date(subscription.trial_ends_at) <= v_today - 7
            )
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.marketing_automation_runs existing
            WHERE existing.automation_id = v_automation.id
              AND existing.trigger_reference = CASE
                WHEN v_automation.automation_key = 'trial_expired_7_days' THEN
                  'trial_winback:' || subscription.id::text || ':' ||
                    subscription.trial_ends_at::date::text
                ELSE
                  'trial_expired:' || subscription.id::text || ':' ||
                    subscription.trial_ends_at::date::text
              END
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
          AND NOT EXISTS (
            SELECT 1
            FROM public.marketing_automation_runs existing
            WHERE existing.automation_id = v_automation.id
              AND existing.trigger_reference = 'sub_active:' || subscription.id::text
          )
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
    public.marketing_bucharest_date(subscription.trial_ends_at)
  FROM claimed
  JOIN public.marketing_automations automation
    ON automation.id = claimed.automation_id
  JOIN public.marketing_email_templates template
    ON template.id = automation.template_id
  JOIN public.marketing_contacts contact
    ON contact.id = claimed.contact_id
  LEFT JOIN LATERAL (
    SELECT latest.trial_ends_at
    FROM public.subscriptions latest
    WHERE latest.tenant_id = claimed.tenant_id
    ORDER BY latest.created_at DESC NULLS LAST
    LIMIT 1
  ) subscription ON true
  LEFT JOIN persist_tokens ON persist_tokens.contact_id = claimed.contact_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_marketing_automation_run_batch(integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_marketing_automation_run_batch(integer, integer, integer)
  TO service_role;

COMMIT;
