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
