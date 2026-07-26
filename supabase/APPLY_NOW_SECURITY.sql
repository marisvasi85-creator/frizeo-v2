-- Frizeo: apply ALL remaining security hardening in one shot
-- Paste into Supabase SQL Editor → Run
-- Order: 20260707 (P0/P1 + rate limit) then 20260726 (legacy cleanup + RPC)

-- ========== BEGIN 20260707_tenant_security_hardening.sql ==========
-- Close tenant privilege-escalation paths and add server-side rate limiting.
-- Application provisioning and invitations already use service_role.

BEGIN;

-- Users must never be able to create their own tenant membership directly.
DROP POLICY IF EXISTS "tenant_users_insert_self" ON public.tenant_users;
DROP POLICY IF EXISTS "tenant_users_same_tenant" ON public.tenant_users;
REVOKE INSERT, UPDATE, DELETE ON public.tenant_users FROM anon, authenticated;

-- Tenant creation is an application provisioning operation performed through
-- service_role, never directly from a browser.
DROP POLICY IF EXISTS "tenants_insert_authenticated" ON public.tenants;
DROP POLICY IF EXISTS "Allow insert tenants" ON public.tenants;
REVOKE INSERT, DELETE ON public.tenants FROM anon, authenticated;

-- An active-tenant preference may only point to one of the user's memberships.
ALTER TABLE public.user_active_tenant ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_active_tenant_own"
  ON public.user_active_tenant;
DROP POLICY IF EXISTS "user_active_tenant_select_own"
  ON public.user_active_tenant;
DROP POLICY IF EXISTS "user_active_tenant_insert_own"
  ON public.user_active_tenant;
DROP POLICY IF EXISTS "user_active_tenant_update_own"
  ON public.user_active_tenant;

CREATE POLICY "user_active_tenant_select_own"
ON public.user_active_tenant
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "user_active_tenant_insert_own"
ON public.user_active_tenant
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
      AND tu.tenant_id = user_active_tenant.tenant_id
  )
);

CREATE POLICY "user_active_tenant_update_own"
ON public.user_active_tenant
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
      AND tu.tenant_id = user_active_tenant.tenant_id
  )
);

-- Tenant owners/managers may read all bookings. Barbers may only read and
-- update bookings assigned to their own barber identity.
DROP POLICY IF EXISTS "bookings_tenant_read" ON public.bookings;
DROP POLICY IF EXISTS "bookings_tenant_update" ON public.bookings;

CREATE POLICY "bookings_tenant_read"
ON public.bookings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
      AND tu.tenant_id = bookings.tenant_id
      AND tu.role IN ('owner', 'manager')
  )
  OR EXISTS (
    SELECT 1
    FROM public.barbers b
    WHERE b.user_id = auth.uid()
      AND b.id = bookings.barber_id
      AND b.tenant_id = bookings.tenant_id
  )
);

CREATE POLICY "bookings_tenant_update"
ON public.bookings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
      AND tu.tenant_id = bookings.tenant_id
      AND tu.role IN ('owner', 'manager')
  )
  OR EXISTS (
    SELECT 1
    FROM public.barbers b
    WHERE b.user_id = auth.uid()
      AND b.id = bookings.barber_id
      AND b.tenant_id = bookings.tenant_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
      AND tu.tenant_id = bookings.tenant_id
      AND tu.role IN ('owner', 'manager')
  )
  OR EXISTS (
    SELECT 1
    FROM public.barbers b
    WHERE b.user_id = auth.uid()
      AND b.id = bookings.barber_id
      AND b.tenant_id = bookings.tenant_id
  )
);

-- Everyone in the tenant may read notification preferences, but only
-- owners/managers may change them.
DROP POLICY IF EXISTS "notification_settings_tenant_read"
  ON public.notification_settings;
DROP POLICY IF EXISTS "notification_settings_tenant_write"
  ON public.notification_settings;

CREATE POLICY "notification_settings_tenant_read"
ON public.notification_settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
      AND tu.tenant_id = notification_settings.tenant_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.barbers b
    WHERE b.user_id = auth.uid()
      AND b.tenant_id = notification_settings.tenant_id
  )
);

CREATE POLICY "notification_settings_tenant_write"
ON public.notification_settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
      AND tu.tenant_id = notification_settings.tenant_id
      AND tu.role IN ('owner', 'manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
      AND tu.tenant_id = notification_settings.tenant_id
      AND tu.role IN ('owner', 'manager')
  )
);

-- Atomic, database-backed rate limits for serverless Route Handlers.
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  bucket text NOT NULL,
  identifier_hash text NOT NULL,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  PRIMARY KEY (bucket, identifier_hash)
);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.api_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_api_rate_limit(
  p_bucket text,
  p_identifier_hash text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resulting_count integer;
BEGIN
  IF p_limit < 1 OR p_window_seconds < 1 THEN
    RETURN false;
  END IF;

  INSERT INTO public.api_rate_limits (
    bucket,
    identifier_hash,
    window_started_at,
    request_count
  )
  VALUES (p_bucket, p_identifier_hash, now(), 1)
  ON CONFLICT (bucket, identifier_hash)
  DO UPDATE SET
    window_started_at = CASE
      WHEN api_rate_limits.window_started_at
        <= now() - make_interval(secs => p_window_seconds)
      THEN now()
      ELSE api_rate_limits.window_started_at
    END,
    request_count = CASE
      WHEN api_rate_limits.window_started_at
        <= now() - make_interval(secs => p_window_seconds)
      THEN 1
      ELSE api_rate_limits.request_count + 1
    END
  RETURNING request_count INTO resulting_count;

  RETURN resulting_count <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_api_rate_limit(
  text, text, integer, integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_api_rate_limit(
  text, text, integer, integer
) TO service_role;

COMMIT;

-- ========== BEGIN 20260726_rls_legacy_cleanup_and_rpc.sql ==========
-- Close residual RLS OR-gaps left after 20260707 and harden booking RPC.
-- Idempotent: safe to re-run in Supabase SQL Editor.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Re-assert P0: no browser-writable tenant membership / tenant create
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "tenant_users_insert_self" ON public.tenant_users;
DROP POLICY IF EXISTS "tenant_users_same_tenant" ON public.tenant_users;
REVOKE INSERT, UPDATE, DELETE ON public.tenant_users FROM anon, authenticated;

DROP POLICY IF EXISTS "tenants_insert_authenticated" ON public.tenants;
DROP POLICY IF EXISTS "Allow insert tenants" ON public.tenants;
REVOKE INSERT, DELETE ON public.tenants FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Drop ALL overlapping booking policies, then recreate a minimal set
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bookings'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.bookings', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Owners/managers: all bookings in their tenant.
-- Barbers: only rows for their own barber_id.
CREATE POLICY "bookings_tenant_read"
ON public.bookings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
      AND tu.tenant_id = bookings.tenant_id
      AND tu.role IN ('owner', 'manager')
  )
  OR EXISTS (
    SELECT 1
    FROM public.barbers b
    WHERE b.user_id = auth.uid()
      AND b.id = bookings.barber_id
      AND b.tenant_id = bookings.tenant_id
  )
);

CREATE POLICY "bookings_tenant_update"
ON public.bookings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
      AND tu.tenant_id = bookings.tenant_id
      AND tu.role IN ('owner', 'manager')
  )
  OR EXISTS (
    SELECT 1
    FROM public.barbers b
    WHERE b.user_id = auth.uid()
      AND b.id = bookings.barber_id
      AND b.tenant_id = bookings.tenant_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
      AND tu.tenant_id = bookings.tenant_id
      AND tu.role IN ('owner', 'manager')
  )
  OR EXISTS (
    SELECT 1
    FROM public.barbers b
    WHERE b.user_id = auth.uid()
      AND b.id = bookings.barber_id
      AND b.tenant_id = bookings.tenant_id
  )
);

-- Writes that create/cancel bookings go through Next.js service_role APIs.
REVOKE INSERT, DELETE ON public.bookings FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) notification_settings: drop role-less write policies
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_settings'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.notification_settings',
      pol.policyname
    );
  END LOOP;
END $$;

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_settings_tenant_read"
ON public.notification_settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
      AND tu.tenant_id = notification_settings.tenant_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.barbers b
    WHERE b.user_id = auth.uid()
      AND b.tenant_id = notification_settings.tenant_id
  )
);

CREATE POLICY "notification_settings_tenant_write"
ON public.notification_settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
      AND tu.tenant_id = notification_settings.tenant_id
      AND tu.role IN ('owner', 'manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
      AND tu.tenant_id = notification_settings.tenant_id
      AND tu.role IN ('owner', 'manager')
  )
);

-- ---------------------------------------------------------------------------
-- 4) Harden create_booking_safe_v2: compute end from service duration
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_booking_safe_v2(
  p_barber_id uuid,
  p_barber_service_id uuid,
  p_date date,
  p_start time without time zone,
  p_end time without time zone,
  p_client_name text,
  p_client_phone text,
  p_client_email text,
  p_reschedule_count integer DEFAULT 0,
  p_exclude_booking_id uuid DEFAULT NULL::uuid
)
RETURNS bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_booking bookings;
  v_tenant_id uuid;
  v_duration integer;
  v_end time without time zone;
BEGIN
  SELECT b.tenant_id
  INTO v_tenant_id
  FROM public.barbers b
  WHERE b.id = p_barber_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Barber has no tenant';
  END IF;

  SELECT s.duration
  INTO v_duration
  FROM public.barber_services s
  WHERE s.id = p_barber_service_id
    AND s.barber_id = p_barber_id
    AND s.tenant_id = v_tenant_id
    AND coalesce(s.active, true) = true;

  IF v_duration IS NULL OR v_duration < 1 THEN
    RAISE EXCEPTION 'Invalid barber service';
  END IF;

  -- Ignore client-supplied p_end; duration is authoritative.
  v_end := (p_start + make_interval(mins => v_duration))::time;

  IF EXISTS (
    SELECT 1
    FROM public.bookings
    WHERE barber_id = p_barber_id
      AND date = p_date
      AND start_time < v_end
      AND end_time > p_start
      AND status != 'cancelled'
      AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id)
  ) THEN
    RAISE EXCEPTION 'Slot already booked';
  END IF;

  INSERT INTO public.bookings (
    barber_id,
    tenant_id,
    barber_service_id,
    date,
    start_time,
    end_time,
    client_name,
    client_phone,
    client_email,
    status,
    cancel_token,
    reschedule_token,
    reschedule_count,
    created_at
  )
  VALUES (
    p_barber_id,
    v_tenant_id,
    p_barber_service_id,
    p_date,
    p_start,
    v_end,
    p_client_name,
    p_client_phone,
    p_client_email,
    'confirmed',
    gen_random_uuid(),
    gen_random_uuid(),
    p_reschedule_count,
    now()
  )
  RETURNING * INTO new_booking;

  RETURN new_booking;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_booking_safe_v2(
  uuid, uuid, date, time, time, text, text, text, integer, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_safe_v2(
  uuid, uuid, date, time, time, text, text, text, integer, uuid
) TO service_role;

COMMIT;

-- ========== BEGIN 20260726_user_active_tenant_legacy_cleanup.sql ==========
-- Remove legacy user_active_tenant policies that allowed pointing at any tenant.
-- Keep only membership-scoped policies. Also tighten bookings table grants.

BEGIN;

DROP POLICY IF EXISTS "read own active tenant" ON public.user_active_tenant;
DROP POLICY IF EXISTS "update own active tenant" ON public.user_active_tenant;
DROP POLICY IF EXISTS "upsert own active tenant" ON public.user_active_tenant;

DROP POLICY IF EXISTS "user_active_tenant_select_own" ON public.user_active_tenant;
DROP POLICY IF EXISTS "user_active_tenant_insert_own" ON public.user_active_tenant;
DROP POLICY IF EXISTS "user_active_tenant_update_own" ON public.user_active_tenant;

ALTER TABLE public.user_active_tenant ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_active_tenant_select_own"
ON public.user_active_tenant
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "user_active_tenant_insert_own"
ON public.user_active_tenant
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
      AND tu.tenant_id = user_active_tenant.tenant_id
  )
);

CREATE POLICY "user_active_tenant_update_own"
ON public.user_active_tenant
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
      AND tu.tenant_id = user_active_tenant.tenant_id
  )
);

REVOKE ALL ON public.bookings FROM PUBLIC;
REVOKE ALL ON public.bookings FROM anon;
GRANT SELECT, UPDATE ON public.bookings TO authenticated;

COMMIT;
