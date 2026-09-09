-- Lifecycle v2 foundation. Additive and safe for current production code:
-- * no deletes of templates, runs, or automations
-- * strategy remains disabled until marketing_lifecycle_settings.enabled = true
-- * existing automations stay at their current is_active value

BEGIN;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS created_via text;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_created_via_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_created_via_check
  CHECK (
    created_via IS NULL
    OR created_via IN ('public', 'dashboard', 'assistant', 'unknown')
  );

COMMENT ON COLUMN public.bookings.created_via IS
  'How the booking was created. Null on historical rows; inferred in lifecycle SQL.';

CREATE TABLE IF NOT EXISTS public.marketing_lifecycle_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  strategy_version integer NOT NULL DEFAULT 2,
  strategy_started_at timestamptz,
  min_hours_between_emails integer NOT NULL DEFAULT 48
    CHECK (min_hours_between_emails BETWEEN 1 AND 168),
  max_emails_per_day integer NOT NULL DEFAULT 1
    CHECK (max_emails_per_day BETWEEN 1 AND 5),
  max_emails_first_7_days integer NOT NULL DEFAULT 3
    CHECK (max_emails_first_7_days BETWEEN 1 AND 20),
  max_emails_30_days integer NOT NULL DEFAULT 5
    CHECK (max_emails_30_days BETWEEN 1 AND 30),
  allow_existing_zero_booking_cohort boolean NOT NULL DEFAULT false,
  test_contact_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.marketing_lifecycle_settings (id, enabled, notes)
VALUES (
  1,
  false,
  'Lifecycle v2 is off until a controlled staging test enables it.'
)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.marketing_lifecycle_settings_before_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.enabled = true
     AND coalesce(OLD.enabled, false) = false
     AND NEW.strategy_started_at IS NULL THEN
    NEW.strategy_started_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketing_lifecycle_settings_before_update
  ON public.marketing_lifecycle_settings;
CREATE TRIGGER marketing_lifecycle_settings_before_update
BEFORE UPDATE ON public.marketing_lifecycle_settings
FOR EACH ROW
EXECUTE FUNCTION public.marketing_lifecycle_settings_before_update();

ALTER TABLE public.marketing_lifecycle_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketing_lifecycle_settings_platform_admin_select"
  ON public.marketing_lifecycle_settings;
CREATE POLICY "marketing_lifecycle_settings_platform_admin_select"
ON public.marketing_lifecycle_settings
FOR SELECT TO authenticated
USING ((SELECT public.is_platform_admin()));

DROP POLICY IF EXISTS "marketing_lifecycle_settings_platform_admin_update"
  ON public.marketing_lifecycle_settings;
CREATE POLICY "marketing_lifecycle_settings_platform_admin_update"
ON public.marketing_lifecycle_settings
FOR UPDATE TO authenticated
USING ((SELECT public.is_platform_admin()))
WITH CHECK ((SELECT public.is_platform_admin()));

REVOKE ALL ON public.marketing_lifecycle_settings FROM PUBLIC, anon;
GRANT SELECT, UPDATE ON public.marketing_lifecycle_settings
  TO authenticated, service_role;
GRANT INSERT ON public.marketing_lifecycle_settings TO service_role;

CREATE TABLE IF NOT EXISTS public.tenant_lifecycle_state (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants (id) ON DELETE CASCADE,
  strategy_version integer NOT NULL DEFAULT 2,
  stage text NOT NULL,
  next_best_action text NOT NULL DEFAULT 'none',
  stage_entered_at timestamptz NOT NULL DEFAULT now(),
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  onboarding_completed_at timestamptz,
  first_booking_at timestamptz,
  first_online_booking_at timestamptz,
  last_booking_at timestamptz,
  last_activity_at timestamptz,
  recorded_bookings integer NOT NULL DEFAULT 0,
  completed_bookings integer NOT NULL DEFAULT 0,
  online_bookings integer NOT NULL DEFAULT 0,
  manual_bookings integer NOT NULL DEFAULT 0,
  bookings_last_7d integer NOT NULL DEFAULT 0,
  bookings_last_30d integer NOT NULL DEFAULT 0,
  monthly_bookings integer NOT NULL DEFAULT 0,
  google_calendar_connected boolean NOT NULL DEFAULT false,
  active_barber_count integer NOT NULL DEFAULT 0,
  last_automation_key text,
  last_automation_sent_at timestamptz,
  next_eligible_at timestamptz,
  outreach_status text NOT NULL DEFAULT 'none'
    CHECK (outreach_status IN (
      'none', 'needs_activation', 'contacted', 'waiting', 'done'
    )),
  unused_reason text,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenant_lifecycle_state_stage_idx
  ON public.tenant_lifecycle_state (stage, updated_at DESC);
CREATE INDEX IF NOT EXISTS tenant_lifecycle_state_outreach_idx
  ON public.tenant_lifecycle_state (outreach_status, stage);

ALTER TABLE public.tenant_lifecycle_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_lifecycle_state_platform_admin_select"
  ON public.tenant_lifecycle_state;
CREATE POLICY "tenant_lifecycle_state_platform_admin_select"
ON public.tenant_lifecycle_state
FOR SELECT TO authenticated
USING ((SELECT public.is_platform_admin()));

DROP POLICY IF EXISTS "tenant_lifecycle_state_platform_admin_update"
  ON public.tenant_lifecycle_state;
CREATE POLICY "tenant_lifecycle_state_platform_admin_update"
ON public.tenant_lifecycle_state
FOR UPDATE TO authenticated
USING ((SELECT public.is_platform_admin()))
WITH CHECK ((SELECT public.is_platform_admin()));

REVOKE ALL ON public.tenant_lifecycle_state FROM PUBLIC, anon;
GRANT SELECT, UPDATE ON public.tenant_lifecycle_state
  TO authenticated, service_role;
GRANT INSERT, DELETE ON public.tenant_lifecycle_state TO service_role;

ALTER TABLE public.marketing_automations
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 50
    CHECK (priority BETWEEN 1 AND 100);

CREATE OR REPLACE FUNCTION public.marketing_lifecycle_strategy_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce((
    SELECT settings.enabled
    FROM public.marketing_lifecycle_settings settings
    WHERE settings.id = 1
  ), false);
$$;

REVOKE ALL ON FUNCTION public.marketing_lifecycle_strategy_enabled()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_lifecycle_strategy_enabled()
  TO service_role;

CREATE OR REPLACE FUNCTION public.marketing_lifecycle_settings_row()
RETURNS public.marketing_lifecycle_settings
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT settings.*
  FROM public.marketing_lifecycle_settings settings
  WHERE settings.id = 1;
$$;

REVOKE ALL ON FUNCTION public.marketing_lifecycle_settings_row()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_lifecycle_settings_row()
  TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.is_booking_created_online(
  p_created_via text,
  p_expires_at timestamptz
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_created_via = 'public' THEN true
    WHEN p_created_via IN ('dashboard', 'assistant') THEN false
    WHEN p_expires_at IS NOT NULL THEN true
    ELSE false
  END;
$$;

REVOKE ALL ON FUNCTION public.is_booking_created_online(text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_booking_created_online(text, timestamptz)
  TO service_role;

CREATE OR REPLACE FUNCTION public.compute_tenant_lifecycle_snapshot(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_onboarding boolean := false;
  v_recorded integer := 0;
  v_completed integer := 0;
  v_online integer := 0;
  v_manual integer := 0;
  v_last7 integer := 0;
  v_last30 integer := 0;
  v_monthly integer := 0;
  v_first_booking timestamptz;
  v_first_online timestamptz;
  v_last_booking timestamptz;
  v_last_activity timestamptz;
  v_google boolean := false;
  v_barbers integer := 0;
  v_seats boolean := false;
  v_subscription public.subscriptions%ROWTYPE;
  v_is_paid boolean := false;
  v_is_trialing boolean := false;
  v_trial_expired boolean := false;
  v_trial_ends_in integer;
  v_idle_activity numeric;
  v_idle_booking numeric;
  v_idle numeric;
  v_today date := timezone('Europe/Bucharest', now())::date;
  v_month_start date := date_trunc('month', timezone('Europe/Bucharest', now()))::date;
  v_stage text;
  v_nba text;
  v_owner uuid;
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'skip_reason', 'no_tenant');
  END IF;

  v_onboarding := public.is_tenant_onboarding_complete(p_tenant_id);
  v_google := public.is_tenant_google_calendar_connected(p_tenant_id);
  v_seats := public.tenant_has_barber_seats_available(p_tenant_id);

  SELECT count(*)::integer INTO v_barbers
  FROM public.barbers barber
  WHERE barber.tenant_id = p_tenant_id
    AND barber.active = true;

  SELECT
    count(*) FILTER (
      WHERE booking.status NOT IN ('cancelled', 'pending')
    )::integer,
    count(*) FILTER (
      WHERE booking.status = 'confirmed'
        AND booking.date < v_today
    )::integer,
    count(*) FILTER (
      WHERE booking.status NOT IN ('cancelled', 'pending')
        AND public.is_booking_created_online(booking.created_via, booking.expires_at)
    )::integer,
    count(*) FILTER (
      WHERE booking.status NOT IN ('cancelled', 'pending')
        AND NOT public.is_booking_created_online(booking.created_via, booking.expires_at)
    )::integer,
    count(*) FILTER (
      WHERE booking.status NOT IN ('cancelled', 'pending')
        AND booking.created_at >= now() - interval '7 days'
    )::integer,
    count(*) FILTER (
      WHERE booking.status NOT IN ('cancelled', 'pending')
        AND booking.created_at >= now() - interval '30 days'
    )::integer,
    count(*) FILTER (
      WHERE booking.status NOT IN ('cancelled', 'pending')
        AND booking.date >= v_month_start
    )::integer,
    min(booking.created_at) FILTER (
      WHERE booking.status NOT IN ('cancelled', 'pending')
    ),
    min(booking.created_at) FILTER (
      WHERE booking.status NOT IN ('cancelled', 'pending')
        AND public.is_booking_created_online(booking.created_via, booking.expires_at)
    ),
    max(booking.created_at) FILTER (
      WHERE booking.status NOT IN ('cancelled', 'pending')
    )
  INTO
    v_recorded, v_completed, v_online, v_manual,
    v_last7, v_last30, v_monthly,
    v_first_booking, v_first_online, v_last_booking
  FROM public.bookings booking
  WHERE booking.tenant_id = p_tenant_id;

  SELECT tenant_user.user_id INTO v_owner
  FROM public.tenant_users tenant_user
  WHERE tenant_user.tenant_id = p_tenant_id
  ORDER BY tenant_user.created_at ASC NULLS LAST
  LIMIT 1;

  v_last_activity := v_last_booking;
  IF v_owner IS NOT NULL THEN
    SELECT GREATEST(
      coalesce(v_last_activity, '-infinity'::timestamptz),
      coalesce(auth_user.last_sign_in_at, '-infinity'::timestamptz),
      coalesce(auth_user.created_at, '-infinity'::timestamptz)
    )
    INTO v_last_activity
    FROM auth.users auth_user
    WHERE auth_user.id = v_owner;
    IF v_last_activity = '-infinity'::timestamptz THEN
      v_last_activity := NULL;
    END IF;
  END IF;

  SELECT * INTO v_subscription
  FROM public.subscriptions subscription
  WHERE subscription.tenant_id = p_tenant_id
  ORDER BY subscription.created_at DESC NULLS LAST
  LIMIT 1;

  v_is_paid := coalesce(
    v_subscription.status = 'active'
    AND v_subscription.stripe_subscription_id IS NOT NULL,
    false
  );
  v_is_trialing := coalesce(v_subscription.status = 'trialing', false)
    AND v_subscription.trial_ends_at IS NOT NULL
    AND NOT v_is_paid;
  v_trial_expired := (NOT v_is_paid)
    AND v_subscription.trial_ends_at IS NOT NULL
    AND public.marketing_bucharest_date(v_subscription.trial_ends_at) < v_today;
  IF v_subscription.trial_ends_at IS NOT NULL THEN
    v_trial_ends_in := (
      public.marketing_bucharest_date(v_subscription.trial_ends_at) - v_today
    );
  END IF;

  v_idle_activity := CASE
    WHEN v_last_activity IS NULL THEN NULL
    ELSE extract(epoch FROM (now() - v_last_activity)) / 86400.0
  END;
  v_idle_booking := CASE
    WHEN v_last_booking IS NULL THEN NULL
    ELSE extract(epoch FROM (now() - v_last_booking)) / 86400.0
  END;
  v_idle := LEAST(
    coalesce(v_idle_activity, 1e9),
    coalesce(v_idle_booking, 1e9)
  );

  IF v_is_paid THEN
    v_stage := 'subscribed';
  ELSIF v_recorded > 0 AND v_idle >= 45 THEN
    v_stage := 'churned_or_dormant';
  ELSIF v_recorded >= 2 AND v_idle >= 14 THEN
    v_stage := 'at_risk';
  ELSIF v_is_trialing AND v_trial_ends_in IS NOT NULL
        AND v_trial_ends_in >= 0 AND v_trial_ends_in <= 7 THEN
    v_stage := 'trial_ending';
  ELSIF v_trial_expired AND v_recorded > 0 THEN
    v_stage := 'free_active';
  ELSIF NOT v_onboarding THEN
    v_stage := 'signup_incomplete';
  ELSIF v_recorded <= 0 THEN
    v_stage := 'setup_complete_zero_bookings';
  ELSIF v_online <= 0 THEN
    v_stage := 'manual_booking_only';
  ELSIF v_recorded >= 10 AND v_idle < 14 THEN
    v_stage := 'active';
  ELSIF v_recorded BETWEEN 2 AND 9 THEN
    v_stage := 'building_habit';
  ELSE
    v_stage := 'first_online_booking';
  END IF;

  v_nba := CASE v_stage
    WHEN 'signup_incomplete' THEN 'complete_onboarding'
    WHEN 'setup_complete_zero_bookings' THEN 'add_first_manual_booking'
    WHEN 'manual_booking_only' THEN 'share_booking_link'
    WHEN 'first_online_booking' THEN
      CASE
        WHEN v_recorded >= 2 AND NOT v_google THEN 'connect_google_calendar'
        ELSE 'google_visibility'
      END
    WHEN 'building_habit' THEN
      CASE
        WHEN v_barbers >= 2 AND v_seats THEN 'invite_team'
        WHEN v_recorded >= 2 AND NOT v_google THEN 'connect_google_calendar'
        WHEN v_completed >= 10 THEN 'request_review'
        ELSE 'none'
      END
    WHEN 'active' THEN
      CASE
        WHEN v_monthly >= 64 THEN 'analyze_upgrade'
        WHEN v_completed >= 10 THEN 'request_review'
        ELSE 'none'
      END
    WHEN 'at_risk' THEN 'return_to_app'
    WHEN 'trial_ending' THEN
      CASE
        WHEN v_recorded <= 0 THEN 'ask_problem'
        WHEN v_monthly >= 64 THEN 'analyze_upgrade'
        ELSE 'continue_on_free'
      END
    WHEN 'free_active' THEN
      CASE
        WHEN v_monthly >= 64 THEN 'analyze_upgrade'
        ELSE 'continue_on_free'
      END
    WHEN 'churned_or_dormant' THEN 'return_to_app'
    ELSE 'none'
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'tenant_id', p_tenant_id,
    'stage', v_stage,
    'next_best_action', v_nba,
    'onboarding_complete', v_onboarding,
    'recorded_bookings', v_recorded,
    'completed_bookings', v_completed,
    'online_bookings', v_online,
    'manual_bookings', v_manual,
    'bookings_last_7d', v_last7,
    'bookings_last_30d', v_last30,
    'monthly_bookings', v_monthly,
    'first_booking_at', v_first_booking,
    'first_online_booking_at', v_first_online,
    'last_booking_at', v_last_booking,
    'last_activity_at', v_last_activity,
    'google_calendar_connected', v_google,
    'active_barber_count', v_barbers,
    'has_barber_seats_available', v_seats,
    'is_paid', v_is_paid,
    'is_trialing', v_is_trialing,
    'trial_expired', v_trial_expired,
    'trial_ends_in_days', v_trial_ends_in
  );
END;
$$;

REVOKE ALL ON FUNCTION public.compute_tenant_lifecycle_snapshot(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_tenant_lifecycle_snapshot(uuid)
  TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.refresh_tenant_lifecycle_state(p_tenant_id uuid)
RETURNS public.tenant_lifecycle_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_snap jsonb;
  v_existing public.tenant_lifecycle_state%ROWTYPE;
  v_row public.tenant_lifecycle_state%ROWTYPE;
  v_settings public.marketing_lifecycle_settings%ROWTYPE;
  v_stage text;
  v_entered timestamptz;
  v_enrolled timestamptz;
BEGIN
  v_settings := public.marketing_lifecycle_settings_row();
  v_snap := public.compute_tenant_lifecycle_snapshot(p_tenant_id);
  IF coalesce((v_snap ->> 'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'lifecycle_snapshot_failed';
  END IF;

  SELECT * INTO v_existing
  FROM public.tenant_lifecycle_state state
  WHERE state.tenant_id = p_tenant_id;

  v_stage := v_snap ->> 'stage';
  IF v_existing.tenant_id IS NULL THEN
    v_entered := now();
    v_enrolled := now();
  ELSIF v_existing.stage IS DISTINCT FROM v_stage THEN
    v_entered := now();
    v_enrolled := v_existing.enrolled_at;
  ELSE
    v_entered := v_existing.stage_entered_at;
    v_enrolled := v_existing.enrolled_at;
  END IF;

  INSERT INTO public.tenant_lifecycle_state (
    tenant_id, strategy_version, stage, next_best_action, stage_entered_at,
    enrolled_at, onboarding_completed_at, first_booking_at,
    first_online_booking_at, last_booking_at, last_activity_at,
    recorded_bookings, completed_bookings, online_bookings, manual_bookings,
    bookings_last_7d, bookings_last_30d, monthly_bookings,
    google_calendar_connected, active_barber_count, outreach_status,
    unused_reason, last_automation_key, last_automation_sent_at,
    next_eligible_at, metrics, updated_at
  )
  VALUES (
    p_tenant_id,
    coalesce(v_settings.strategy_version, 2),
    v_stage,
    v_snap ->> 'next_best_action',
    v_entered,
    v_enrolled,
    CASE
      WHEN (v_snap ->> 'onboarding_complete')::boolean THEN coalesce(
        v_existing.onboarding_completed_at,
        now()
      )
      ELSE v_existing.onboarding_completed_at
    END,
    nullif(v_snap ->> 'first_booking_at', '')::timestamptz,
    nullif(v_snap ->> 'first_online_booking_at', '')::timestamptz,
    nullif(v_snap ->> 'last_booking_at', '')::timestamptz,
    nullif(v_snap ->> 'last_activity_at', '')::timestamptz,
    coalesce((v_snap ->> 'recorded_bookings')::integer, 0),
    coalesce((v_snap ->> 'completed_bookings')::integer, 0),
    coalesce((v_snap ->> 'online_bookings')::integer, 0),
    coalesce((v_snap ->> 'manual_bookings')::integer, 0),
    coalesce((v_snap ->> 'bookings_last_7d')::integer, 0),
    coalesce((v_snap ->> 'bookings_last_30d')::integer, 0),
    coalesce((v_snap ->> 'monthly_bookings')::integer, 0),
    coalesce((v_snap ->> 'google_calendar_connected')::boolean, false),
    coalesce((v_snap ->> 'active_barber_count')::integer, 0),
    coalesce(v_existing.outreach_status, 'none'),
    v_existing.unused_reason,
    v_existing.last_automation_key,
    v_existing.last_automation_sent_at,
    CASE
      WHEN v_existing.last_automation_sent_at IS NULL THEN now()
      ELSE v_existing.last_automation_sent_at
        + make_interval(hours => coalesce(v_settings.min_hours_between_emails, 48))
    END,
    v_snap,
    now()
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    strategy_version = EXCLUDED.strategy_version,
    stage = EXCLUDED.stage,
    next_best_action = EXCLUDED.next_best_action,
    stage_entered_at = EXCLUDED.stage_entered_at,
    enrolled_at = tenant_lifecycle_state.enrolled_at,
    onboarding_completed_at = EXCLUDED.onboarding_completed_at,
    first_booking_at = EXCLUDED.first_booking_at,
    first_online_booking_at = EXCLUDED.first_online_booking_at,
    last_booking_at = EXCLUDED.last_booking_at,
    last_activity_at = EXCLUDED.last_activity_at,
    recorded_bookings = EXCLUDED.recorded_bookings,
    completed_bookings = EXCLUDED.completed_bookings,
    online_bookings = EXCLUDED.online_bookings,
    manual_bookings = EXCLUDED.manual_bookings,
    bookings_last_7d = EXCLUDED.bookings_last_7d,
    bookings_last_30d = EXCLUDED.bookings_last_30d,
    monthly_bookings = EXCLUDED.monthly_bookings,
    google_calendar_connected = EXCLUDED.google_calendar_connected,
    active_barber_count = EXCLUDED.active_barber_count,
    next_eligible_at = EXCLUDED.next_eligible_at,
    metrics = EXCLUDED.metrics,
    updated_at = now()
  RETURNING * INTO v_row;

  IF v_row.stage = 'setup_complete_zero_bookings'
     AND v_row.enrolled_at <= now() - interval '4 days'
     AND v_row.outreach_status = 'none' THEN
    UPDATE public.tenant_lifecycle_state
    SET outreach_status = 'needs_activation',
        updated_at = now()
    WHERE tenant_id = p_tenant_id
      AND outreach_status = 'none'
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_tenant_lifecycle_state(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_tenant_lifecycle_state(uuid)
  TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.marketing_lifecycle_frequency_ok(
  p_contact_id uuid,
  p_automation_key text
)
RETURNS TABLE (ok boolean, skip_reason text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_settings public.marketing_lifecycle_settings%ROWTYPE;
  v_contact public.marketing_contacts%ROWTYPE;
  v_latest timestamptz;
  v_today integer;
  v_week integer;
  v_month integer;
BEGIN
  IF p_automation_key = 'subscription_activated' THEN
    RETURN QUERY SELECT true, NULL::text;
    RETURN;
  END IF;

  v_settings := public.marketing_lifecycle_settings_row();
  SELECT * INTO v_contact
  FROM public.marketing_contacts contact
  WHERE contact.id = p_contact_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'contact_missing_or_deleted';
    RETURN;
  END IF;

  SELECT max(run.sent_at) INTO v_latest
  FROM public.marketing_automation_runs run
  JOIN public.marketing_automations automation
    ON automation.id = run.automation_id
  WHERE run.contact_id = p_contact_id
    AND run.is_test = false
    AND run.status = 'sent'
    AND run.sent_at IS NOT NULL
    AND automation.automation_key <> 'subscription_activated';

  IF v_latest IS NOT NULL
     AND v_latest > now()
       - make_interval(hours => coalesce(v_settings.min_hours_between_emails, 48)) THEN
    RETURN QUERY SELECT false, 'frequency_min_gap';
    RETURN;
  END IF;

  SELECT count(*)::integer INTO v_today
  FROM public.marketing_automation_runs run
  JOIN public.marketing_automations automation
    ON automation.id = run.automation_id
  WHERE run.contact_id = p_contact_id
    AND run.is_test = false
    AND run.status = 'sent'
    AND run.sent_at >= date_trunc('day', timezone('Europe/Bucharest', now()))
      AT TIME ZONE 'Europe/Bucharest'
    AND automation.automation_key <> 'subscription_activated';

  IF v_today >= coalesce(v_settings.max_emails_per_day, 1) THEN
    RETURN QUERY SELECT false, 'frequency_daily_cap';
    RETURN;
  END IF;

  IF v_contact.created_at >= now() - interval '7 days' THEN
    SELECT count(*)::integer INTO v_week
    FROM public.marketing_automation_runs run
    JOIN public.marketing_automations automation
      ON automation.id = run.automation_id
    WHERE run.contact_id = p_contact_id
      AND run.is_test = false
      AND run.status = 'sent'
      AND run.sent_at >= v_contact.created_at
      AND automation.automation_key <> 'subscription_activated';
    IF v_week >= coalesce(v_settings.max_emails_first_7_days, 3) THEN
      RETURN QUERY SELECT false, 'frequency_first_7_days';
      RETURN;
    END IF;
  END IF;

  SELECT count(*)::integer INTO v_month
  FROM public.marketing_automation_runs run
  JOIN public.marketing_automations automation
    ON automation.id = run.automation_id
  WHERE run.contact_id = p_contact_id
    AND run.is_test = false
    AND run.status = 'sent'
    AND run.sent_at >= now() - interval '30 days'
    AND automation.automation_key <> 'subscription_activated';

  IF v_month >= coalesce(v_settings.max_emails_30_days, 5) THEN
    RETURN QUERY SELECT false, 'frequency_30_days';
    RETURN;
  END IF;

  RETURN QUERY SELECT true, NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.marketing_lifecycle_frequency_ok(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_lifecycle_frequency_ok(uuid, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.marketing_lifecycle_funnel()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_signup integer := 0;
  v_setup integer := 0;
  v_first72 integer := 0;
  v_online integer := 0;
  v_five integer := 0;
  v_w1 integer := 0;
  v_w2 integer := 0;
  v_d30 integer := 0;
  v_paid integer := 0;
BEGIN
  SELECT count(*)::integer INTO v_signup FROM public.tenants;

  SELECT count(*)::integer INTO v_setup
  FROM public.tenants tenant
  WHERE public.is_tenant_onboarding_complete(tenant.id);

  SELECT count(*)::integer INTO v_first72
  FROM public.tenant_lifecycle_state state
  JOIN public.tenants tenant ON tenant.id = state.tenant_id
  WHERE state.first_booking_at IS NOT NULL
    AND state.first_booking_at <= tenant.created_at + interval '72 hours';

  SELECT count(*)::integer INTO v_online
  FROM public.tenant_lifecycle_state state
  WHERE state.first_online_booking_at IS NOT NULL;

  SELECT count(*)::integer INTO v_five
  FROM public.tenant_lifecycle_state state
  WHERE state.recorded_bookings >= 5;

  SELECT count(*)::integer INTO v_w1
  FROM public.tenant_lifecycle_state state
  WHERE state.bookings_last_7d >= 1
    AND state.enrolled_at <= now();

  SELECT count(*)::integer INTO v_w2
  FROM public.tenant_lifecycle_state state
  WHERE state.bookings_last_7d >= 1
    AND state.recorded_bookings >= 2
    AND state.last_booking_at >= now() - interval '7 days'
    AND state.first_booking_at <= now() - interval '7 days';

  SELECT count(*)::integer INTO v_d30
  FROM public.tenant_lifecycle_state state
  JOIN public.tenants tenant ON tenant.id = state.tenant_id
  WHERE tenant.created_at <= now() - interval '30 days'
    AND state.last_activity_at >= now() - interval '14 days';

  SELECT count(*)::integer INTO v_paid
  FROM public.tenant_lifecycle_state state
  WHERE state.stage = 'subscribed';

  RETURN jsonb_build_object(
    'signup', v_signup,
    'setup_complete', v_setup,
    'first_booking_72h', v_first72,
    'first_online_booking', v_online,
    'five_bookings', v_five,
    'active_week_1', v_w1,
    'active_week_2', v_w2,
    'active_after_30d', v_d30,
    'subscribed', v_paid
  );
END;
$$;

REVOKE ALL ON FUNCTION public.marketing_lifecycle_funnel()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketing_lifecycle_funnel()
  TO service_role, authenticated;

COMMIT;
