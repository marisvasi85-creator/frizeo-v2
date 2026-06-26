-- Fix circular RLS on tenant_users: users must read their own membership rows.

BEGIN;

DROP POLICY IF EXISTS "tenant_users_read_own" ON public.tenant_users;

CREATE POLICY "tenant_users_read_own"
ON public.tenant_users
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

COMMIT;
