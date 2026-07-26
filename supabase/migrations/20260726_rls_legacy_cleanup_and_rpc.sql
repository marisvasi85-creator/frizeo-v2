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
