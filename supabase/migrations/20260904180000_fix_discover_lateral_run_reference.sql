-- Fix discover_marketing_automation_runs crashing with:
--   invalid reference to FROM-clause entry for table "run"
-- 20260904120000 reintroduced UPDATE ... FROM LATERAL referencing the
-- target alias after the review_after_10_bookings automation. Cron-job.org
-- disabled Email Automations after 26 consecutive 500s.

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
  v_min_inactive integer;
  v_cooldown integer;
  v_min_bookings integer;
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
          AND public.marketing_activation_discover_ok(
            contact.id,
            v_automation.conditions
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

    ELSIF v_automation.trigger_type = 'account_inactive' THEN
      v_min_inactive := coalesce(
        nullif(v_automation.conditions ->> 'min_inactive_days', '')::integer,
        7
      );
      v_cooldown := coalesce(
        nullif(v_automation.conditions ->> 'cooldown_days', '')::integer,
        30
      );
      WITH candidates AS (
        SELECT
          contact.id AS contact_id,
          contact.user_id,
          contact.tenant_id,
          public.marketing_contact_last_activity(contact.id) AS last_activity,
          'inactive:' || contact.id::text || ':' ||
            to_char(timezone('Europe/Bucharest', now()), 'YYYY-MM')
            AS trigger_reference
        FROM public.marketing_contacts contact
        WHERE contact.deleted_at IS NULL
          AND contact.user_id IS NOT NULL
          AND public.marketing_activation_discover_ok(
            contact.id,
            v_automation.conditions
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.marketing_automation_runs existing
            WHERE existing.automation_id = v_automation.id
              AND existing.contact_id = contact.id
              AND existing.is_test = false
              AND existing.status = 'sent'
              AND existing.sent_at > now() - make_interval(days => v_cooldown)
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.marketing_automation_runs existing
            WHERE existing.automation_id = v_automation.id
              AND existing.trigger_reference =
                'inactive:' || contact.id::text || ':' ||
                  to_char(timezone('Europe/Bucharest', now()), 'YYYY-MM')
          )
        ORDER BY public.marketing_contact_last_activity(contact.id) ASC NULLS LAST
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
          coalesce(candidate.last_activity, now())
            + make_interval(days => v_min_inactive)
        FROM candidates candidate
        WHERE candidate.last_activity IS NOT NULL
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
          'trial_tips:' || subscription.id::text || ':' ||
            subscription.trial_ends_at::date::text AS trigger_reference
        FROM public.marketing_contacts contact
        JOIN public.subscriptions subscription
          ON subscription.tenant_id = contact.tenant_id
        WHERE contact.deleted_at IS NULL
          AND contact.tenant_id IS NOT NULL
          AND contact.id = public.marketing_primary_contact_id(contact.tenant_id)
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
          (
            public.marketing_bucharest_date(subscription.trial_ends_at)
            - CASE v_automation.trigger_type
                WHEN 'trial_ending_7_days' THEN 7
                WHEN 'trial_ending_3_days' THEN 3
                ELSE 0
              END
          ) AS send_on,
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
          AND contact.id = public.marketing_primary_contact_id(contact.tenant_id)
          AND subscription.status = 'trialing'
          AND subscription.trial_ends_at IS NOT NULL
          AND coalesce(subscription.stripe_subscription_id, '') = ''
          AND (
            (
              v_automation.trigger_type = 'trial_ending_7_days'
              AND public.marketing_bucharest_date(subscription.trial_ends_at) >= v_today + 4
            )
            OR (
              v_automation.trigger_type = 'trial_ending_3_days'
              AND public.marketing_bucharest_date(subscription.trial_ends_at) >= v_today + 1
            )
            OR (
              v_automation.trigger_type = 'trial_last_day'
              AND public.marketing_bucharest_date(subscription.trial_ends_at) >= v_today
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
          timezone('Europe/Bucharest', candidate.send_on::timestamp)
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
          AND contact.id = public.marketing_primary_contact_id(contact.tenant_id)
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
          AND contact.id = public.marketing_primary_contact_id(contact.tenant_id)
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

    ELSIF v_automation.trigger_type = 'min_bookings' THEN
      v_min_bookings := coalesce(
        nullif(v_automation.conditions ->> 'min_bookings', '')::integer,
        10
      );
      WITH candidates AS (
        SELECT
          contact.id AS contact_id,
          contact.user_id,
          contact.tenant_id,
          'min_bookings:' || contact.tenant_id::text AS trigger_reference
        FROM public.marketing_contacts contact
        WHERE contact.deleted_at IS NULL
          AND contact.user_id IS NOT NULL
          AND contact.tenant_id IS NOT NULL
          AND public.marketing_activation_discover_ok(
            contact.id,
            v_automation.conditions
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.marketing_automation_runs existing
            WHERE existing.automation_id = v_automation.id
              AND existing.trigger_reference =
                'min_bookings:' || contact.tenant_id::text
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
          now() + make_interval(mins => v_automation.delay_minutes)
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

  -- Event revalidation: drop pending activation sends if state no longer matches.
  -- Must use a CTE SELECT: UPDATE ... FROM LATERAL cannot reference the target
  -- table alias ("run") — that raises:
  --   invalid reference to FROM-clause entry for table "run"
  WITH to_skip AS (
    SELECT run.id AS run_id, cond.skip_reason
    FROM public.marketing_automation_runs run
    JOIN public.marketing_automations automation
      ON automation.id = run.automation_id
    CROSS JOIN LATERAL public.marketing_automation_condition_ok(
      run.contact_id,
      automation.conditions
    ) cond
    WHERE run.is_test = false
      AND run.status IN ('pending', 'scheduled')
      AND run.claimed_at IS NULL
      AND automation.is_active = true
      AND NOT cond.ok
      AND automation.automation_key IN (
        'incomplete_onboarding_after_signup',
        'inactive_account',
        'no_first_booking',
        'google_calendar_after_signup',
        'invite_team_after_signup',
        'review_after_10_bookings'
      )
  )
  UPDATE public.marketing_automation_runs run
  SET status = 'skipped',
      skip_reason = to_skip.skip_reason,
      completed_at = coalesce(run.completed_at, now())
  FROM to_skip
  WHERE run.id = to_skip.run_id;

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
