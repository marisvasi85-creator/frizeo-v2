-- Staging/production-safe helpers so a logged-in user can finish their own
-- account deletion when the app cannot use a matching service_role key.
-- claim_own still requires scheduled_for <= now(); staging QA uses a separate
-- RPC applied only on the staging database.

CREATE OR REPLACE FUNCTION public.claim_own_account_deletion(p_id uuid)
RETURNS SETOF public.account_deletion_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  RETURN QUERY
  UPDATE public.account_deletion_requests req
  SET status = 'processing',
      claimed_at = now(),
      claim_token = gen_random_uuid(),
      attempt_count = req.attempt_count + 1,
      failure_reason = NULL
  WHERE req.id = p_id
    AND req.user_id = auth.uid()
    AND req.status = 'pending'
    AND req.scheduled_for <= now()
  RETURNING req.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_own_account_deletion(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_own_account_deletion(uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delete_own_auth_user_if_processing()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.account_deletion_requests req
    WHERE req.user_id = auth.uid()
      AND req.status = 'processing'
  ) THEN
    RAISE EXCEPTION 'no_processing_request';
  END IF;

  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_auth_user_if_processing()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_auth_user_if_processing()
  TO authenticated, service_role;

DROP POLICY IF EXISTS tenant_users_delete_own ON public.tenant_users;
CREATE POLICY tenant_users_delete_own
ON public.tenant_users
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_active_tenant_delete_own ON public.user_active_tenant;
CREATE POLICY user_active_tenant_delete_own
ON public.user_active_tenant
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS profiles_delete_own ON public.profiles;
CREATE POLICY profiles_delete_own
ON public.profiles
FOR DELETE
TO authenticated
USING (id = auth.uid());
