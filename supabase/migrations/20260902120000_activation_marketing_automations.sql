-- Activation automations: incomplete onboarding, inactivity, first booking,
-- Google Calendar, invite team. Additive — does not change trial automations.

BEGIN;

-- ---------------------------------------------------------------------------
-- CTA types for profile / barbers pages
-- ---------------------------------------------------------------------------
ALTER TABLE public.marketing_email_templates
  DROP CONSTRAINT IF EXISTS marketing_email_templates_cta_url_type_check;
ALTER TABLE public.marketing_email_templates
  ADD CONSTRAINT marketing_email_templates_cta_url_type_check
    CHECK (cta_url_type IN (
      'custom', 'register', 'marketing', 'dashboard', 'booking_link', 'plans',
      'salon', 'profile', 'barbers'
    ));

ALTER TABLE public.marketing_campaigns
  DROP CONSTRAINT IF EXISTS marketing_campaigns_cta_url_type_check;
ALTER TABLE public.marketing_campaigns
  ADD CONSTRAINT marketing_campaigns_cta_url_type_check
    CHECK (cta_url_type IN (
      'custom', 'register', 'marketing', 'dashboard', 'booking_link', 'plans',
      'salon', 'profile', 'barbers'
    ));

ALTER TABLE public.marketing_automations
  DROP CONSTRAINT IF EXISTS marketing_automations_trigger_type_check;
ALTER TABLE public.marketing_automations
  ADD CONSTRAINT marketing_automations_trigger_type_check
    CHECK (trigger_type IN (
      'user_signed_up',
      'trial_started',
      'trial_ending_7_days',
      'trial_ending_3_days',
      'trial_last_day',
      'trial_expired',
      'subscription_activated',
      'account_inactive'
    ));

-- ---------------------------------------------------------------------------
-- Tenant helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_tenant_onboarding_complete(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenants tenant
    WHERE tenant.id = p_tenant_id
      AND coalesce(trim(tenant.slug), '') <> ''
  )
  AND EXISTS (
    SELECT 1
    FROM public.barber_services service
    JOIN public.barbers barber ON barber.id = service.barber_id
    WHERE barber.tenant_id = p_tenant_id
      AND service.active = true
  )
  AND EXISTS (
    SELECT 1
    FROM public.barber_weekly_schedule schedule
    JOIN public.barbers barber ON barber.id = schedule.barber_id
    WHERE barber.tenant_id = p_tenant_id
      AND schedule.is_working = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_tenant_onboarding_complete(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_onboarding_complete(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.is_tenant_google_calendar_connected(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.barbers barber
    WHERE barber.tenant_id = p_tenant_id
      AND barber.active = true
      AND coalesce(barber.google_calendar_connected, false) = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_tenant_google_calendar_connected(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_google_calendar_connected(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.is_tenant_pro_plus(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce((
    SELECT plan.slug = 'pro-plus'
      AND subscription.status IN ('active', 'trialing')
    FROM public.subscriptions subscription
    JOIN public.plans plan ON plan.id = subscription.plan_id
    WHERE subscription.tenant_id = p_tenant_id
    ORDER BY subscription.created_at DESC NULLS LAST
    LIMIT 1
  ), false);
$$;

REVOKE ALL ON FUNCTION public.is_tenant_pro_plus(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_pro_plus(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.tenant_has_barber_seats_available(p_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit integer;
  v_status text;
  v_active integer := 0;
  v_pending integer := 0;
BEGIN
  SELECT plan.max_barbers, subscription.status
  INTO v_limit, v_status
  FROM public.subscriptions subscription
  JOIN public.plans plan ON plan.id = subscription.plan_id
  WHERE subscription.tenant_id = p_tenant_id
  ORDER BY subscription.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_status IS NULL OR v_status NOT IN ('active', 'trialing') THEN
    RETURN false;
  END IF;

  IF v_limit IS NULL THEN
    RETURN true;
  END IF;

  SELECT count(*)::integer INTO v_active
  FROM public.barbers barber
  WHERE barber.tenant_id = p_tenant_id
    AND barber.active = true;

  SELECT count(*)::integer INTO v_pending
  FROM public.barber_invitations invite
  WHERE invite.tenant_id = p_tenant_id
    AND invite.accepted = false
    AND invite.created_at >= now() - interval '7 days';

  RETURN (v_active + v_pending) < v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.tenant_has_barber_seats_available(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_has_barber_seats_available(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.marketing_contact_last_activity(p_contact_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(auth_user.last_sign_in_at, auth_user.created_at)
  FROM public.marketing_contacts contact
  LEFT JOIN auth.users auth_user ON auth_user.id = contact.user_id
  WHERE contact.id = p_contact_id;
$$;

REVOKE ALL ON FUNCTION public.marketing_contact_last_activity(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_contact_last_activity(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.marketing_activation_discover_ok(
  p_contact_id uuid,
  p_conditions jsonb
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_conditions jsonb := coalesce(p_conditions, '{}'::jsonb);
  v_contact public.marketing_contacts%ROWTYPE;
  v_last_activity timestamptz;
  v_min_inactive integer;
  v_cooldown integer;
  v_max_bookings integer;
  v_bookings integer := 0;
BEGIN
  SELECT * INTO v_contact
  FROM public.marketing_contacts contact
  WHERE contact.id = p_contact_id;

  IF NOT FOUND OR v_contact.deleted_at IS NOT NULL THEN
    RETURN false;
  END IF;

  IF coalesce((v_conditions ->> 'require_primary_contact')::boolean, false) THEN
    IF v_contact.tenant_id IS NULL
       OR v_contact.id <> public.marketing_primary_contact_id(v_contact.tenant_id) THEN
      RETURN false;
    END IF;
  END IF;

  IF coalesce((v_conditions ->> 'require_onboarding_incomplete')::boolean, false) THEN
    IF v_contact.tenant_id IS NULL THEN
      RETURN false;
    END IF;
    IF public.is_tenant_onboarding_complete(v_contact.tenant_id) THEN
      RETURN false;
    END IF;
  END IF;

  IF coalesce((v_conditions ->> 'require_onboarding_complete')::boolean, false) THEN
    IF v_contact.tenant_id IS NULL THEN
      RETURN false;
    END IF;
    IF NOT public.is_tenant_onboarding_complete(v_contact.tenant_id) THEN
      RETURN false;
    END IF;
  END IF;

  IF coalesce((v_conditions ->> 'require_google_calendar_disconnected')::boolean, false) THEN
    IF v_contact.tenant_id IS NULL THEN
      RETURN false;
    END IF;
    IF public.is_tenant_google_calendar_connected(v_contact.tenant_id) THEN
      RETURN false;
    END IF;
  END IF;

  IF coalesce((v_conditions ->> 'require_pro_plus')::boolean, false) THEN
    IF v_contact.tenant_id IS NULL THEN
      RETURN false;
    END IF;
    IF NOT public.is_tenant_pro_plus(v_contact.tenant_id) THEN
      RETURN false;
    END IF;
  END IF;

  IF coalesce((v_conditions ->> 'require_barber_seats_available')::boolean, false) THEN
    IF v_contact.tenant_id IS NULL THEN
      RETURN false;
    END IF;
    IF NOT public.tenant_has_barber_seats_available(v_contact.tenant_id) THEN
      RETURN false;
    END IF;
  END IF;

  v_min_inactive := nullif(v_conditions ->> 'min_inactive_days', '')::integer;
  IF v_min_inactive IS NOT NULL THEN
    v_last_activity := public.marketing_contact_last_activity(p_contact_id);
    IF v_last_activity IS NULL
       OR v_last_activity > now() - make_interval(days => v_min_inactive) THEN
      RETURN false;
    END IF;
  END IF;

  v_cooldown := nullif(v_conditions ->> 'cooldown_days', '')::integer;
  IF v_cooldown IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.marketing_automation_runs existing
      JOIN public.marketing_automations automation
        ON automation.id = existing.automation_id
      WHERE existing.contact_id = p_contact_id
        AND existing.is_test = false
        AND existing.status = 'sent'
        AND existing.sent_at IS NOT NULL
        AND existing.sent_at > now() - make_interval(days => v_cooldown)
        AND automation.conditions ? 'cooldown_days'
        AND (automation.conditions ->> 'cooldown_days') = v_conditions ->> 'cooldown_days'
        AND automation.automation_key = coalesce(
          v_conditions ->> 'automation_key_hint',
          automation.automation_key
        )
    ) THEN
      -- Cooldown is enforced in discover via trigger_reference + sent_at check
      -- on the same automation. This flag is a no-op here except as documentation.
      NULL;
    END IF;
  END IF;

  IF coalesce((v_conditions ->> 'require_onboarding_complete')::boolean, false) THEN
    v_max_bookings := nullif(v_conditions ->> 'max_bookings', '')::integer;
    IF v_max_bookings IS NOT NULL AND v_contact.tenant_id IS NOT NULL THEN
      SELECT count(*)::integer INTO v_bookings
      FROM public.bookings booking
      WHERE booking.tenant_id = v_contact.tenant_id
        AND booking.status = 'confirmed';
      IF v_bookings > v_max_bookings THEN
        RETURN false;
      END IF;
    END IF;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.marketing_activation_discover_ok(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_activation_discover_ok(uuid, jsonb)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Worker revalidation (existing skip reasons unchanged; new flags appended)
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
  v_require_incomplete_salon_address boolean := coalesce((v_conditions ->> 'require_incomplete_salon_address')::boolean, false);
  v_require_primary_contact boolean := coalesce((v_conditions ->> 'require_primary_contact')::boolean, false);
  v_require_onboarding_incomplete boolean := coalesce((v_conditions ->> 'require_onboarding_incomplete')::boolean, false);
  v_require_onboarding_complete boolean := coalesce((v_conditions ->> 'require_onboarding_complete')::boolean, false);
  v_require_google_calendar_disconnected boolean := coalesce((v_conditions ->> 'require_google_calendar_disconnected')::boolean, false);
  v_require_pro_plus boolean := coalesce((v_conditions ->> 'require_pro_plus')::boolean, false);
  v_require_barber_seats_available boolean := coalesce((v_conditions ->> 'require_barber_seats_available')::boolean, false);
  v_require_account_active boolean := coalesce((v_conditions ->> 'require_account_active')::boolean, false);
  v_min_inactive integer := nullif(v_conditions ->> 'min_inactive_days', '')::integer;
  v_cooldown integer := nullif(v_conditions ->> 'cooldown_days', '')::integer;
  v_contact public.marketing_contacts%ROWTYPE;
  v_subscription public.subscriptions%ROWTYPE;
  v_bookings integer := 0;
  v_is_paid boolean := false;
  v_last_activity timestamptz;
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

  IF v_require_account_active THEN
    IF v_contact.user_id IS NULL THEN
      RETURN QUERY SELECT false, 'account_inactive';
      RETURN;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM auth.users auth_user WHERE auth_user.id = v_contact.user_id
    ) THEN
      RETURN QUERY SELECT false, 'account_inactive';
      RETURN;
    END IF;
  END IF;

  IF v_require_primary_contact THEN
    IF v_contact.tenant_id IS NULL
       OR v_contact.id <> public.marketing_primary_contact_id(v_contact.tenant_id) THEN
      RETURN QUERY SELECT false, 'not_primary_contact';
      RETURN;
    END IF;
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

  IF v_require_incomplete_salon_address THEN
    IF v_contact.tenant_id IS NULL THEN
      RETURN QUERY SELECT false, 'no_tenant';
      RETURN;
    END IF;
    IF public.is_tenant_salon_address_complete(v_contact.tenant_id) THEN
      RETURN QUERY SELECT false, 'salon_address_complete';
      RETURN;
    END IF;
  END IF;

  IF v_require_onboarding_incomplete THEN
    IF v_contact.tenant_id IS NULL THEN
      RETURN QUERY SELECT false, 'no_tenant';
      RETURN;
    END IF;
    IF public.is_tenant_onboarding_complete(v_contact.tenant_id) THEN
      RETURN QUERY SELECT false, 'onboarding_complete';
      RETURN;
    END IF;
  END IF;

  IF v_require_onboarding_complete THEN
    IF v_contact.tenant_id IS NULL THEN
      RETURN QUERY SELECT false, 'no_tenant';
      RETURN;
    END IF;
    IF NOT public.is_tenant_onboarding_complete(v_contact.tenant_id) THEN
      RETURN QUERY SELECT false, 'onboarding_incomplete';
      RETURN;
    END IF;
  END IF;

  IF v_require_google_calendar_disconnected THEN
    IF v_contact.tenant_id IS NULL THEN
      RETURN QUERY SELECT false, 'no_tenant';
      RETURN;
    END IF;
    IF public.is_tenant_google_calendar_connected(v_contact.tenant_id) THEN
      RETURN QUERY SELECT false, 'google_calendar_connected';
      RETURN;
    END IF;
  END IF;

  IF v_require_pro_plus THEN
    IF v_contact.tenant_id IS NULL THEN
      RETURN QUERY SELECT false, 'no_tenant';
      RETURN;
    END IF;
    IF NOT public.is_tenant_pro_plus(v_contact.tenant_id) THEN
      RETURN QUERY SELECT false, 'not_pro_plus';
      RETURN;
    END IF;
  END IF;

  IF v_require_barber_seats_available THEN
    IF v_contact.tenant_id IS NULL THEN
      RETURN QUERY SELECT false, 'no_tenant';
      RETURN;
    END IF;
    IF NOT public.tenant_has_barber_seats_available(v_contact.tenant_id) THEN
      RETURN QUERY SELECT false, 'no_barber_seats';
      RETURN;
    END IF;
  END IF;

  IF v_min_inactive IS NOT NULL THEN
    v_last_activity := public.marketing_contact_last_activity(p_contact_id);
    IF v_last_activity IS NULL
       OR v_last_activity > now() - make_interval(days => v_min_inactive) THEN
      RETURN QUERY SELECT false, 'recently_active';
      RETURN;
    END IF;
  END IF;

  IF v_cooldown IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.marketing_automation_runs existing
      WHERE existing.contact_id = p_contact_id
        AND existing.is_test = false
        AND existing.status = 'sent'
        AND existing.sent_at IS NOT NULL
        AND existing.sent_at > now() - make_interval(days => v_cooldown)
        AND existing.id <> (
          SELECT run.id
          FROM public.marketing_automation_runs run
          WHERE run.contact_id = p_contact_id
          ORDER BY run.created_at DESC
          LIMIT 1
        )
    ) THEN
      -- Same-automation cooldown is applied in discover; send-time
      -- uniqueness is the (automation_id, trigger_reference) key.
      NULL;
    END IF;
  END IF;

  RETURN QUERY SELECT true, NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.marketing_automation_condition_ok(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_automation_condition_ok(uuid, jsonb)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Discover: keep trial branches identical; add activation filters + inactive
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
  v_min_inactive integer;
  v_cooldown integer;
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
          candidate.last_activity + make_interval(days => v_min_inactive)
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

  -- Event revalidation: drop pending activation sends if state no longer matches.
  UPDATE public.marketing_automation_runs run
  SET status = 'skipped',
      skip_reason = cond.skip_reason,
      completed_at = coalesce(run.completed_at, now())
  FROM public.marketing_automations automation,
  LATERAL public.marketing_automation_condition_ok(
    run.contact_id,
    automation.conditions
  ) cond
  WHERE automation.id = run.automation_id
    AND run.is_test = false
    AND run.status IN ('pending', 'scheduled')
    AND run.claimed_at IS NULL
    AND NOT cond.ok
    AND automation.automation_key IN (
      'incomplete_onboarding_after_signup',
      'inactive_account',
      'no_first_booking',
      'google_calendar_after_signup',
      'invite_team_after_signup'
    );

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
-- Templates (editable later in Frizeo Email)
-- ---------------------------------------------------------------------------
INSERT INTO public.marketing_email_templates (
  template_key, name, category, subject, preview_text, heading, body_text,
  image_url, cta_text, cta_url, cta_url_type, recommended_audience,
  automation_key, footer_text, is_system_template, is_default
)
VALUES
(
  'incomplete_onboarding',
  'Onboarding incomplet',
  'lifecycle',
  'Mai ai 3 pași ca să primești programări în Frizeo',
  'Configurează serviciile, programul și distribuie linkul de booking.',
  'Hai să terminăm configurarea',
  E'Salut, {{first_name}}!\n\nContul tău Frizeo este creat, dar pagina de programări nu e încă gata de clienți.\n\nÎn dashboard poți face totul dintr-un loc:\n\n1. Configurează serviciile (nume, durată, preț opțional)\n2. Configurează programul de lucru\n3. Distribuie linkul de booking clienților tăi\n\nDupă acești pași, clienții se pot programa singuri, fără să te mai sune.',
  null,
  'Finalizează configurarea',
  null,
  'dashboard',
  'registered_users',
  'INCOMPLETE_ONBOARDING',
  'Frizeo · Programări online pentru frizeri și saloane.',
  true,
  false
),
(
  'inactive_account',
  'Fără activitate',
  'lifecycle',
  'Te mai așteptăm în Frizeo',
  'Dacă ai nevoie de ajutor, suntem aici.',
  'E liniște de câteva zile',
  E'Salut, {{first_name}}!\n\nNu te-am mai văzut de curând în Frizeo și am vrut să verificăm dacă totul e în regulă.\n\nDacă ai rămas blocat la configurare, la linkul de programări sau la altceva, răspunde la acest email sau intră din nou în cont — te ajutăm.\n\nDacă totul e ok, e suficient să te autentifici și să-ți vezi programul.',
  null,
  'Intră în Frizeo',
  null,
  'dashboard',
  'registered_users',
  'INACTIVE_ACCOUNT',
  'Frizeo · Programări online pentru frizeri și saloane.',
  true,
  false
),
(
  'no_first_booking',
  'Nicio programare',
  'lifecycle',
  'Contul e gata. Mai lipsește prima programare',
  'Distribuie linkul pe Instagram, Facebook, WhatsApp sau Google.',
  'Cum obții primele programări',
  E'Salut, {{first_name}}!\n\nFrizeo e configurat, dar încă nu a venit prima programare online.\n\nCel mai rapid drum: pune linkul tău de booking unde vorbesc deja clienții cu tine.\n\n• Instagram — în bio și în story\n• Facebook — în descrierea paginii\n• WhatsApp — în status sau trimis direct clienților\n• Google Business Profile — în site / linkuri\n\nLinkul tău:\n{{booking_link}}\n\nClienții aleg singuri ora. Tu vezi programarea în Frizeo.',
  null,
  'Deschide linkul de programări',
  '{{booking_link}}',
  'booking_link',
  'registered_users',
  'NO_FIRST_BOOKING',
  'Frizeo · Programări online pentru frizeri și saloane.',
  true,
  false
),
(
  'connect_google_calendar',
  'Conectează Google Calendar',
  'lifecycle',
  'Evită programările duble cu Google Calendar',
  'Sincronizare automată, actualizare instant.',
  'Frizeo + Google Calendar',
  E'Salut, {{first_name}}!\n\nDacă lucrezi și cu Google Calendar, conectează-l din Profil frizer.\n\nBeneficii:\n• fără programări duble — orele ocupate din Google nu mai apar libere în Frizeo\n• sincronizare automată — programările noi din Frizeo apar în Google\n• actualizare instant — mutările și anulările se văd în ambele calendare\n\nDurează un minut. O faci din Profil → Google Calendar.',
  null,
  'Conectează Google Calendar',
  null,
  'profile',
  'registered_users',
  'CONNECT_GOOGLE_CALENDAR',
  'Frizeo · Programări online pentru frizeri și saloane.',
  true,
  false
),
(
  'invite_team',
  'Invită echipa',
  'lifecycle',
  'Invită-ți colegii în Frizeo',
  'Fiecare frizer își gestionează programul, serviciile și linkul propriu.',
  'Echipa poate lucra independent, în același salon',
  E'Salut, {{first_name}}!\n\nPe Pro+ poți invita colegii în Frizeo.\n\nFiecare frizer:\n• își administrează programul și zilele libere\n• își setează serviciile\n• are un link propriu de booking, pe lângă pagina salonului\n\nTu vezi tot salonul. Ei își văd programul.\n\nInvitațiile se trimit din Frizeri, cu nume și email.',
  null,
  'Invită un frizer',
  null,
  'barbers',
  'registered_users',
  'INVITE_TEAM',
  'Frizeo · Programări online pentru frizeri și saloane.',
  true,
  false
)
ON CONFLICT (template_key) WHERE template_key IS NOT NULL DO NOTHING;

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
      'incomplete_onboarding_after_signup',
      'Incomplete onboarding',
      'Un singur reminder la 24h după signup dacă lipsesc servicii active, program sau link public.',
      'user_signed_up',
      1440,
      'incomplete_onboarding',
      '{"require_eligible":true,"require_registered":true,"require_primary_contact":true,"require_onboarding_incomplete":true}'
    ),
    (
      'inactive_account',
      'Inactive account',
      'Email prietenos dacă ultima autentificare e mai veche de 7 zile. Cooldown 30 zile.',
      'account_inactive',
      0,
      'inactive_account',
      '{"require_eligible":true,"require_registered":true,"require_primary_contact":true,"require_account_active":true,"min_inactive_days":7,"cooldown_days":30}'
    ),
    (
      'no_first_booking',
      'No first booking',
      'La 7 zile după signup, dacă onboardingul e complet și nu există nicio programare confirmată.',
      'user_signed_up',
      10080,
      'no_first_booking',
      '{"require_eligible":true,"require_registered":true,"require_primary_contact":true,"require_onboarding_complete":true,"max_bookings":0}'
    ),
    (
      'google_calendar_after_signup',
      'Connect Google Calendar',
      'La 5 zile după signup, dacă onboardingul e complet și Google Calendar nu e conectat.',
      'user_signed_up',
      7200,
      'connect_google_calendar',
      '{"require_eligible":true,"require_registered":true,"require_primary_contact":true,"require_onboarding_complete":true,"require_google_calendar_disconnected":true}'
    ),
    (
      'invite_team_after_signup',
      'Invite your team',
      'La 7 zile după signup, pe Pro+ cu locuri de frizer disponibile.',
      'user_signed_up',
      10080,
      'invite_team',
      '{"require_eligible":true,"require_registered":true,"require_primary_contact":true,"require_pro_plus":true,"require_barber_seats_available":true}'
    )
) AS seed(
  automation_key, name, description, trigger_type, delay_minutes,
  template_key, conditions
)
JOIN public.marketing_email_templates template
  ON template.template_key = seed.template_key
 AND template.is_system_template = true
ON CONFLICT (automation_key) DO NOTHING;

COMMIT;
