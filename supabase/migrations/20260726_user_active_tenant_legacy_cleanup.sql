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
