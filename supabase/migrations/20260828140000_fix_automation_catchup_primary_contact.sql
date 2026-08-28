-- Schedule trial countdown emails ahead of time (catch-up if cron missed the
-- exact day), send tenant-level automations to the primary contact only, and
-- evaluate marketing segments on Europe/Bucharest calendar dates.

BEGIN;

CREATE OR REPLACE FUNCTION public.marketing_primary_contact_id(p_tenant_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT contact.id
  FROM public.marketing_contacts contact
  LEFT JOIN public.tenant_users tu
    ON tu.tenant_id = contact.tenant_id
   AND tu.user_id = contact.user_id
  WHERE contact.tenant_id = p_tenant_id
    AND contact.deleted_at IS NULL
  ORDER BY
    CASE
      WHEN tu.role = 'owner' THEN 0
      WHEN tu.role = 'manager' THEN 1
      WHEN contact.user_id IS NOT NULL THEN 2
      ELSE 3
    END,
    contact.created_at ASC NULLS LAST,
    contact.id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.marketing_primary_contact_id(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_primary_contact_id(uuid)
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

CREATE OR REPLACE FUNCTION public.marketing_contact_facts()
RETURNS TABLE (
  contact_id uuid,
  email text,
  first_name text,
  last_name text,
  source text,
  contact_status text,
  account_status text,
  subscription_plan text,
  subscription_status text,
  is_paid boolean,
  trial_status text,
  trial_end_date date,
  bookings_count integer,
  bookings_count_bucket text,
  created_at timestamptz,
  last_activity timestamptz,
  activity_status text,
  consent_status boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH business_clock AS (
    SELECT timezone('Europe/Bucharest', now())::date AS today
  ),
  booking_counts AS (
    SELECT booking.tenant_id, count(*)::integer AS bookings_count
    FROM public.bookings booking
    WHERE booking.status = 'confirmed'
      AND booking.tenant_id IS NOT NULL
    GROUP BY booking.tenant_id
  )
  SELECT
    contact.id AS contact_id,
    contact.email,
    contact.first_name,
    contact.last_name,
    contact.source,
    contact.status AS contact_status,
    CASE WHEN contact.user_id IS NULL THEN 'lead' ELSE 'registered' END,
    coalesce(plan.slug, 'none') AS subscription_plan,
    coalesce(subscription.status, 'none') AS subscription_status,
    coalesce(
      subscription.status = 'active'
      AND subscription.stripe_subscription_id IS NOT NULL,
      false
    ) AS is_paid,
    CASE
      WHEN subscription.status <> 'trialing'
           OR subscription.trial_ends_at IS NULL THEN 'none'
      WHEN public.marketing_bucharest_date(subscription.trial_ends_at) < clock.today THEN 'expired'
      WHEN public.marketing_bucharest_date(subscription.trial_ends_at) = clock.today THEN 'last_day'
      WHEN public.marketing_bucharest_date(subscription.trial_ends_at) = clock.today + 3 THEN 'ending_3_days'
      WHEN public.marketing_bucharest_date(subscription.trial_ends_at) = clock.today + 7 THEN 'ending_7_days'
      ELSE 'active'
    END AS trial_status,
    public.marketing_bucharest_date(subscription.trial_ends_at) AS trial_end_date,
    coalesce(booking_count.bookings_count, 0) AS bookings_count,
    CASE
      WHEN coalesce(booking_count.bookings_count, 0) = 0 THEN 'none'
      WHEN booking_count.bookings_count <= 5 THEN '1_5'
      ELSE '6_plus'
    END AS bookings_count_bucket,
    contact.created_at,
    coalesce(auth_user.last_sign_in_at, auth_user.created_at) AS last_activity,
    CASE
      WHEN coalesce(auth_user.last_sign_in_at, auth_user.created_at) IS NULL
        THEN 'unknown'
      WHEN coalesce(auth_user.last_sign_in_at, auth_user.created_at)
        >= now() - interval '7 days' THEN 'recently_active'
      WHEN coalesce(auth_user.last_sign_in_at, auth_user.created_at)
        < now() - interval '14 days' THEN 'inactive_14_days'
      ELSE 'between_7_and_14_days'
    END AS activity_status,
    contact.marketing_consent AS consent_status
  FROM public.marketing_contacts contact
  CROSS JOIN business_clock clock
  LEFT JOIN LATERAL (
    SELECT latest.status, latest.stripe_subscription_id, latest.trial_ends_at, latest.plan_id
    FROM public.subscriptions latest
    WHERE latest.tenant_id = contact.tenant_id
    ORDER BY latest.created_at DESC NULLS LAST
    LIMIT 1
  ) subscription ON true
  LEFT JOIN public.plans plan ON plan.id = subscription.plan_id
  LEFT JOIN booking_counts booking_count
    ON booking_count.tenant_id = contact.tenant_id
  LEFT JOIN auth.users auth_user ON auth_user.id = contact.user_id
  WHERE public.is_marketing_contact_eligible(contact.id);
$$;

COMMIT;
