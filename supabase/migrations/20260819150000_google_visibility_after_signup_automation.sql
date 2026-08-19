-- Google visibility automation: incomplete salon address after signup (Phase 6 extension).
-- Adds system template, paused automation, salon CTA type, and address completeness checks.

BEGIN;

ALTER TABLE public.marketing_email_templates
  DROP CONSTRAINT IF EXISTS marketing_email_templates_cta_url_type_check;
ALTER TABLE public.marketing_email_templates
  ADD CONSTRAINT marketing_email_templates_cta_url_type_check
  CHECK (cta_url_type IN (
    'custom', 'register', 'marketing', 'dashboard', 'booking_link', 'plans', 'salon'
  ));

ALTER TABLE public.marketing_campaigns
  DROP CONSTRAINT IF EXISTS marketing_campaigns_cta_url_type_check;
ALTER TABLE public.marketing_campaigns
  ADD CONSTRAINT marketing_campaigns_cta_url_type_check
  CHECK (cta_url_type IN (
    'custom', 'register', 'marketing', 'dashboard', 'booking_link', 'plans', 'salon'
  ));

CREATE OR REPLACE FUNCTION public.is_tenant_salon_address_complete(p_tenant_id uuid)
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
      AND (
        coalesce(trim(tenant.location_maps_url), '') <> ''
        OR (
          tenant.location_latitude IS NOT NULL
          AND tenant.location_longitude IS NOT NULL
        )
        OR coalesce(trim(tenant.location_address_line), trim(tenant.address), '') <> ''
        OR coalesce(trim(tenant.location_city), '') <> ''
        OR coalesce(trim(tenant.location_county), '') <> ''
        OR coalesce(trim(tenant.location_postal_code), '') <> ''
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_tenant_salon_address_complete(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_salon_address_complete(uuid)
  TO service_role;

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

  RETURN QUERY SELECT true, NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.marketing_automation_condition_ok(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_automation_condition_ok(uuid, jsonb)
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


INSERT INTO public.marketing_email_templates (
  template_key, name, category, subject, preview_text, heading, body_text,
  image_url, cta_text, cta_url, cta_url_type, recommended_audience,
  automation_key, footer_text, is_system_template, is_default
)
VALUES (
  'google_visibility',
  'Vizibilitate Google',
  'lifecycle',
  'Fă-ți salonul vizibil pe Google 🔎',
  'Completează adresa și ajută clienții din zona ta să te găsească mai ușor.',
  'Clienții te pot găsi și direct pe Google',
  E'Completează adresa salonului/frizeriei în Frizeo, iar pagina ta publică poate fi indexată de Google și afișată în rezultatele de căutare.

Astfel, un client care caută un frizer sau un salon în zona ta poate descoperi pagina ta Frizeo și se poate programa direct online.',
  null,
  'Completează adresa',
  null,
  'salon',
  'registered_users',
  'GOOGLE_VISIBILITY_AFTER_SIGNUP',
  'Frizeo · Programări online pentru frizeri și saloane. Indexarea și poziția în rezultatele Google depind de Google și nu pot fi garantate.',
  true,
  false
)
ON CONFLICT (template_key) WHERE template_key IS NOT NULL DO NOTHING;

INSERT INTO public.marketing_automations (
  automation_key, name, description, trigger_type, delay_minutes,
  template_id, conditions, is_system, is_active
)
SELECT
  'google_visibility_after_signup',
  'Google visibility after signup',
  'Reminder la 3 zile după signup dacă adresa salonului nu este completată.',
  'user_signed_up',
  4320,
  template.id,
  '{"require_eligible":true,"require_registered":true,"require_incomplete_salon_address":true}'::jsonb,
  true,
  false
FROM public.marketing_email_templates template
WHERE template.template_key = 'google_visibility'
  AND template.is_system_template = true
ON CONFLICT (automation_key) DO NOTHING;

COMMIT;
