-- Lifecycle v2: stage-aware discover/claim/revalidation.
-- When marketing_lifecycle_settings.enabled is false, discover keeps the
-- previous day-based paths. v2 gates apply only after explicit enable.

BEGIN;

CREATE OR REPLACE FUNCTION public.discover_lifecycle_v2_runs(
  p_automation public.marketing_automations,
  p_limit integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_settings public.marketing_lifecycle_settings%ROWTYPE;
  v_inserted integer := 0;
  v_delay integer;
  v_anchor timestamptz;
  v_due timestamptz;
  v_ref text;
  v_state public.tenant_lifecycle_state%ROWTYPE;
  v_contact public.marketing_contacts%ROWTYPE;
  v_stages jsonb;
  v_nba_required text;
  v_cond record;
  v_freq record;
BEGIN
  IF NOT public.marketing_lifecycle_strategy_enabled() THEN
    RETURN 0;
  END IF;

  v_settings := public.marketing_lifecycle_settings_row();
  v_delay := coalesce(
    nullif(p_automation.conditions ->> 'delay_minutes_v2', '')::integer,
    p_automation.delay_minutes
  );
  v_stages := coalesce(p_automation.conditions -> 'required_stages', '[]'::jsonb);
  v_nba_required := nullif(p_automation.conditions ->> 'required_next_best_action', '');

  FOR v_contact IN
    SELECT contact.*
    FROM public.marketing_contacts contact
    WHERE contact.deleted_at IS NULL
      AND contact.user_id IS NOT NULL
      AND contact.tenant_id IS NOT NULL
      AND contact.id = public.marketing_primary_contact_id(contact.tenant_id)
      AND (
        coalesce(cardinality(v_settings.test_contact_ids), 0) = 0
        OR contact.id = ANY (v_settings.test_contact_ids)
      )
    ORDER BY contact.created_at DESC
    LIMIT greatest(1, least(coalesce(p_limit, 200), 500))
  LOOP
    v_state := public.refresh_tenant_lifecycle_state(v_contact.tenant_id);

    IF jsonb_array_length(v_stages) > 0
       AND NOT (v_stages @> jsonb_build_array(to_jsonb(v_state.stage))) THEN
      CONTINUE;
    END IF;

    IF v_nba_required IS NOT NULL
       AND v_state.next_best_action IS DISTINCT FROM v_nba_required THEN
      CONTINUE;
    END IF;

    IF v_state.stage = 'setup_complete_zero_bookings'
       AND NOT v_settings.allow_existing_zero_booking_cohort
       AND v_settings.strategy_started_at IS NOT NULL
       AND p_automation.automation_key IN (
         'no_first_booking',
         'zero_bookings_activation',
         'zero_bookings_help',
         'zero_bookings_survey'
       )
       AND EXISTS (
         SELECT 1 FROM public.tenants tenant
         WHERE tenant.id = v_contact.tenant_id
           AND tenant.created_at < v_settings.strategy_started_at
       ) THEN
      CONTINUE;
    END IF;

    SELECT * INTO v_cond
    FROM public.marketing_automation_condition_ok(
      v_contact.id,
      p_automation.conditions
    );
    IF NOT v_cond.ok THEN
      CONTINUE;
    END IF;

    v_anchor := CASE coalesce(p_automation.conditions ->> 'lifecycle_anchor', 'signup')
      WHEN 'stage_entered_at' THEN v_state.stage_entered_at
      WHEN 'first_booking_at' THEN v_state.first_booking_at
      WHEN 'first_online_booking_at' THEN v_state.first_online_booking_at
      WHEN 'last_activity_at' THEN v_state.last_activity_at
      ELSE v_contact.created_at
    END;

    IF v_anchor IS NULL THEN
      CONTINUE;
    END IF;

    v_due := v_anchor + make_interval(mins => v_delay);

    IF v_delay > 0 AND v_due < v_state.enrolled_at THEN
      CONTINUE;
    END IF;
    IF v_delay = 0 AND v_contact.created_at < v_state.enrolled_at
       AND coalesce(p_automation.conditions ->> 'lifecycle_anchor', 'signup') = 'signup' THEN
      CONTINUE;
    END IF;

    v_ref := CASE p_automation.trigger_type
      WHEN 'user_signed_up' THEN
        'signup:' || coalesce(v_contact.user_id::text, v_contact.id::text)
      WHEN 'account_inactive' THEN
        'inactive:' || v_contact.id::text || ':' ||
          to_char(timezone('Europe/Bucharest', now()), 'YYYY-MM')
      WHEN 'min_bookings' THEN
        'min_bookings:' || v_contact.tenant_id::text
      ELSE
        'v2:' || v_settings.strategy_version::text || ':' ||
          p_automation.automation_key || ':' || v_contact.tenant_id::text
    END;

    IF EXISTS (
      SELECT 1 FROM public.marketing_automation_runs existing
      WHERE existing.automation_id = p_automation.id
        AND existing.trigger_reference = v_ref
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.marketing_automation_runs (
      automation_id, contact_id, user_id, tenant_id,
      trigger_key, trigger_reference, status, scheduled_for
    )
    VALUES (
      p_automation.id,
      v_contact.id,
      v_contact.user_id,
      v_contact.tenant_id,
      p_automation.trigger_type,
      v_ref,
      'scheduled',
      CASE
        WHEN v_due < now() AND v_due >= v_state.enrolled_at THEN now()
        ELSE v_due
      END
    )
    ON CONFLICT (automation_id, trigger_reference) DO NOTHING;

    IF FOUND THEN
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.discover_lifecycle_v2_runs(public.marketing_automations, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discover_lifecycle_v2_runs(public.marketing_automations, integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.marketing_automation_condition_ok(
  p_contact_id uuid,
  p_conditions jsonb
)
RETURNS TABLE (ok boolean, skip_reason text)
LANGUAGE plpgsql
VOLATILE
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
  v_min_bookings integer := nullif(v_conditions ->> 'min_bookings', '')::integer;
  v_min_online_bookings integer := nullif(v_conditions ->> 'min_online_bookings', '')::integer;
  v_max_online_bookings integer := nullif(v_conditions ->> 'max_online_bookings', '')::integer;
  v_min_completed_bookings integer := nullif(v_conditions ->> 'min_completed_bookings', '')::integer;
  v_min_active_barbers integer := nullif(v_conditions ->> 'min_active_barbers', '')::integer;
  v_require_incomplete_salon_address boolean := coalesce((v_conditions ->> 'require_incomplete_salon_address')::boolean, false);
  v_require_primary_contact boolean := coalesce((v_conditions ->> 'require_primary_contact')::boolean, false);
  v_require_onboarding_incomplete boolean := coalesce((v_conditions ->> 'require_onboarding_incomplete')::boolean, false);
  v_require_onboarding_complete boolean := coalesce((v_conditions ->> 'require_onboarding_complete')::boolean, false);
  v_require_google_calendar_disconnected boolean := coalesce((v_conditions ->> 'require_google_calendar_disconnected')::boolean, false);
  v_require_pro_plus boolean := coalesce((v_conditions ->> 'require_pro_plus')::boolean, false);
  v_require_barber_seats_available boolean := coalesce((v_conditions ->> 'require_barber_seats_available')::boolean, false);
  v_require_account_active boolean := coalesce((v_conditions ->> 'require_account_active')::boolean, false);
  v_min_inactive integer := nullif(v_conditions ->> 'min_inactive_days', '')::integer;
  v_contact public.marketing_contacts%ROWTYPE;
  v_subscription public.subscriptions%ROWTYPE;
  v_bookings integer := 0;
  v_recorded_bookings integer := 0;
  v_is_paid boolean := false;
  v_last_activity timestamptz;
  v_state public.tenant_lifecycle_state%ROWTYPE;
  v_freq record;
  v_automation_key text := nullif(v_conditions ->> 'automation_key', '');
  v_required_stages jsonb := coalesce(v_conditions -> 'required_stages', '[]'::jsonb);
  v_nba_required text := nullif(v_conditions ->> 'required_next_best_action', '');
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

    SELECT count(*)::integer INTO v_recorded_bookings
    FROM public.bookings booking
    WHERE booking.tenant_id = v_contact.tenant_id
      AND booking.status <> 'cancelled';
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

  IF v_min_bookings IS NOT NULL THEN
    IF v_contact.tenant_id IS NULL THEN
      RETURN QUERY SELECT false, 'no_tenant';
      RETURN;
    END IF;
    IF v_recorded_bookings < v_min_bookings THEN
      RETURN QUERY SELECT false, 'bookings_below_threshold';
      RETURN;
    END IF;
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

  IF coalesce((v_conditions ->> 'lifecycle_v2')::boolean, false)
     AND public.marketing_lifecycle_strategy_enabled() THEN
    IF v_contact.tenant_id IS NULL THEN
      RETURN QUERY SELECT false, 'no_tenant';
      RETURN;
    END IF;

    v_state := public.refresh_tenant_lifecycle_state(v_contact.tenant_id);

    IF jsonb_array_length(v_required_stages) > 0
       AND NOT (v_required_stages @> jsonb_build_array(to_jsonb(v_state.stage))) THEN
      RETURN QUERY SELECT false, 'lifecycle_stage_mismatch';
      RETURN;
    END IF;

    IF v_nba_required IS NOT NULL
       AND v_state.next_best_action IS DISTINCT FROM v_nba_required THEN
      RETURN QUERY SELECT false, 'objective_already_met';
      RETURN;
    END IF;

    IF v_min_online_bookings IS NOT NULL
       AND v_state.online_bookings < v_min_online_bookings THEN
      RETURN QUERY SELECT false, 'online_bookings_below_threshold';
      RETURN;
    END IF;

    IF v_max_online_bookings IS NOT NULL
       AND v_state.online_bookings > v_max_online_bookings THEN
      RETURN QUERY SELECT false, 'online_bookings_exceeded';
      RETURN;
    END IF;

    IF v_min_completed_bookings IS NOT NULL
       AND v_state.completed_bookings < v_min_completed_bookings THEN
      RETURN QUERY SELECT false, 'completed_bookings_below_threshold';
      RETURN;
    END IF;

    IF v_min_active_barbers IS NOT NULL
       AND v_state.active_barber_count < v_min_active_barbers THEN
      RETURN QUERY SELECT false, 'not_multi_barber';
      RETURN;
    END IF;

    IF coalesce((v_conditions ->> 'require_prior_activity')::boolean, false)
       AND v_state.recorded_bookings <= 0 THEN
      RETURN QUERY SELECT false, 'never_activated';
      RETURN;
    END IF;

    SELECT * INTO v_freq
    FROM public.marketing_lifecycle_frequency_ok(
      p_contact_id,
      coalesce(v_automation_key, '')
    );
    IF NOT v_freq.ok THEN
      RETURN QUERY SELECT false, v_freq.skip_reason;
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
    IF coalesce((v_automation.conditions ->> 'lifecycle_v2')::boolean, false)
       AND public.marketing_lifecycle_strategy_enabled() THEN
      v_inserted := v_inserted
        + public.discover_lifecycle_v2_runs(v_automation, v_limit);
      CONTINUE;
    END IF;

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
      AND (
        automation.automation_key IN (
          'incomplete_onboarding_after_signup',
          'inactive_account',
          'no_first_booking',
          'google_calendar_after_signup',
          'invite_team_after_signup',
          'review_after_10_bookings'
        )
        OR (
          public.marketing_lifecycle_strategy_enabled()
          AND coalesce((automation.conditions ->> 'lifecycle_v2')::boolean, false)
        )
      )
  )
  UPDATE public.marketing_automation_runs run
  SET status = 'skipped',
      skip_reason = to_skip.skip_reason,
      completed_at = coalesce(run.completed_at, now())
  FROM to_skip
  WHERE run.id = to_skip.run_id;

  IF public.marketing_lifecycle_strategy_enabled() THEN
    WITH ranked AS (
      SELECT
        run.id AS run_id,
        row_number() OVER (
          PARTITION BY run.contact_id
          ORDER BY automation.priority ASC,
            coalesce(run.next_attempt_at, run.scheduled_for) ASC
        ) AS rn
      FROM public.marketing_automation_runs run
      JOIN public.marketing_automations automation
        ON automation.id = run.automation_id
      WHERE run.is_test = false
        AND run.status IN ('pending', 'scheduled')
        AND run.claimed_at IS NULL
        AND run.scheduled_for <= now()
        AND automation.is_active = true
        AND coalesce((automation.conditions ->> 'lifecycle_v2')::boolean, false)
        AND automation.automation_key <> 'subscription_activated'
    )
    UPDATE public.marketing_automation_runs run
    SET status = 'skipped',
        skip_reason = 'lower_priority',
        completed_at = coalesce(run.completed_at, now())
    FROM ranked
    WHERE run.id = ranked.run_id
      AND ranked.rn > 1;
  END IF;

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
    ORDER BY
      automation.priority ASC,
      coalesce(run.next_attempt_at, run.scheduled_for),
      run.created_at
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
    automation.conditions || jsonb_build_object('automation_key', automation.automation_key),
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
