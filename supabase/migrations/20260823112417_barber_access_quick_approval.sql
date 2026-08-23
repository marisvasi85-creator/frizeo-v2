-- Per-barber SMS opt-in and one-time quick approval links for client access.
-- IMPORTANT: staging and production currently share one database. This file is
-- intentionally committed without being applied remotely.

BEGIN;

-- Existing and future barbers default to receiving access-request SMS.
ALTER TABLE public.barbers
  ADD COLUMN IF NOT EXISTS access_request_sms_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.barbers.access_request_sms_enabled IS
  'Per-barber toggle for immediate SMS on a newly-created pending access request.';

-- Only a SHA-256 hash is persisted. The raw 32-byte token exists only in the
-- notification URL and is never stored in Postgres.
CREATE TABLE IF NOT EXISTS public.barber_access_request_tokens (
  request_id uuid PRIMARY KEY
    REFERENCES public.barber_client_access(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT barber_access_request_tokens_hash_check
    CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT barber_access_request_tokens_expiry_check
    CHECK (expires_at > created_at)
);

COMMENT ON TABLE public.barber_access_request_tokens IS
  'Service-role-only hashes for 7-day quick approval links. GET is read-only; POST consumes the token.';

ALTER TABLE public.barber_access_request_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.barber_access_request_tokens
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.barber_access_request_tokens TO service_role;

ALTER TABLE public.barber_client_access
  ADD COLUMN IF NOT EXISTS approval_notification_claimed_at timestamptz;

COMMENT ON COLUMN public.barber_client_access.approval_notification_claimed_at IS
  'Atomic at-most-once claim for the client approval notification.';

-- Quick-link decisions are auditable without impersonating an authenticated user.
ALTER TABLE public.barber_client_access
  DROP CONSTRAINT IF EXISTS barber_client_access_decision_source_check;

ALTER TABLE public.barber_client_access
  ADD CONSTRAINT barber_client_access_decision_source_check
  CHECK (
    decision_source IS NULL
    OR decision_source IN ('manual_admin', 'existing_client', 'quick_link')
  );

-- Reuse the existing SMS usage log for this new SMS category.
ALTER TABLE public.sms_sends
  DROP CONSTRAINT IF EXISTS sms_sends_sms_type_check;

ALTER TABLE public.sms_sends
  ADD CONSTRAINT sms_sends_sms_type_check
  CHECK (sms_type IN ('booking', 'reminder', 'reschedule', 'cancel', 'access_request'));

-- Atomically create the pending request and its token hash. The caller is the
-- server-side service role; public clients never receive table/function grants.
CREATE OR REPLACE FUNCTION public.create_barber_access_request_with_token(
  p_tenant_id uuid,
  p_barber_id uuid,
  p_phone_normalized text,
  p_client_name text,
  p_client_email text,
  p_referral text,
  p_request_message text,
  p_token_hash text,
  p_expires_at timestamptz
)
RETURNS TABLE(request_id uuid, request_status text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_request_id uuid;
  v_request_status text;
BEGIN
  IF p_token_hash IS NULL
    OR p_token_hash !~ '^[0-9a-f]{64}$'
    OR p_expires_at IS NULL
    OR p_expires_at <= now()
  THEN
    RAISE EXCEPTION 'Invalid access request token metadata'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.barbers b
    WHERE b.id = p_barber_id
      AND b.tenant_id = p_tenant_id
      AND b.active = true
      AND b.booking_access_mode = 'approval_required'
  ) THEN
    RAISE EXCEPTION 'Barber does not accept access requests'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.barber_client_access (
    tenant_id,
    barber_id,
    phone_normalized,
    client_name,
    client_email,
    referral,
    request_message,
    status,
    source,
    requested_at
  )
  VALUES (
    p_tenant_id,
    p_barber_id,
    p_phone_normalized,
    p_client_name,
    p_client_email,
    p_referral,
    p_request_message,
    'pending',
    'client_request',
    now()
  )
  RETURNING id, status INTO v_request_id, v_request_status;

  INSERT INTO public.barber_access_request_tokens (
    request_id,
    token_hash,
    expires_at
  )
  VALUES (v_request_id, p_token_hash, p_expires_at);

  RETURN QUERY SELECT v_request_id, v_request_status;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_barber_access_request_with_token(
  uuid, uuid, text, text, text, text, text, text, timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_barber_access_request_with_token(
  uuid, uuid, text, text, text, text, text, text, timestamptz
) TO service_role;

-- One short transaction locks the token row and then its exact request. No
-- external notification is made while locks are held.
CREATE OR REPLACE FUNCTION public.accept_barber_access_request_token(
  p_token_hash text
)
RETURNS TABLE(outcome text, request_id uuid, barber_id uuid)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_token public.barber_access_request_tokens%ROWTYPE;
  v_access public.barber_client_access%ROWTYPE;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  SELECT t.*
  INTO v_token
  FROM public.barber_access_request_tokens t
  WHERE t.token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  SELECT a.*
  INTO v_access
  FROM public.barber_client_access a
  WHERE a.id = v_token.request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  IF v_access.status IN ('approved', 'blocked', 'rejected')
    AND v_token.used_at IS NULL
  THEN
    UPDATE public.barber_access_request_tokens t
    SET used_at = now()
    WHERE t.request_id = v_access.id
      AND t.used_at IS NULL;
  END IF;

  IF v_access.status = 'approved' THEN
    RETURN QUERY SELECT 'already_approved'::text, v_access.id, v_access.barber_id;
    RETURN;
  END IF;

  IF v_access.status = 'blocked' THEN
    RETURN QUERY SELECT 'blocked'::text, v_access.id, v_access.barber_id;
    RETURN;
  END IF;

  IF v_access.status = 'rejected' THEN
    RETURN QUERY SELECT 'rejected'::text, v_access.id, v_access.barber_id;
    RETURN;
  END IF;

  IF v_access.status <> 'pending' OR v_token.used_at IS NOT NULL THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  IF v_token.expires_at <= now() THEN
    RETURN QUERY SELECT 'expired'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  UPDATE public.barber_client_access a
  SET
    status = 'approved',
    decision_source = 'quick_link',
    decided_at = now(),
    decided_by = NULL,
    updated_by = NULL
  WHERE a.id = v_access.id
    AND a.barber_id = v_access.barber_id
    AND a.tenant_id = v_access.tenant_id
    AND a.status = 'pending';

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  UPDATE public.barber_access_request_tokens t
  SET used_at = now()
  WHERE t.request_id = v_access.id
    AND t.used_at IS NULL;

  RETURN QUERY SELECT 'approved'::text, v_access.id, v_access.barber_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.accept_barber_access_request_token(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_barber_access_request_token(text)
  TO service_role;

-- Claiming is atomic, so dashboard and quick-link races can produce at most
-- one client email attempt.
CREATE OR REPLACE FUNCTION public.claim_barber_access_approval_notification(
  p_request_id uuid
)
RETURNS TABLE(
  request_id uuid,
  barber_id uuid,
  client_name text,
  client_email text
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  UPDATE public.barber_client_access a
  SET approval_notification_claimed_at = now()
  WHERE a.id = p_request_id
    AND a.status = 'approved'
    AND a.approval_notification_claimed_at IS NULL
  RETURNING a.id, a.barber_id, a.client_name, a.client_email;
$function$;

REVOKE ALL ON FUNCTION public.claim_barber_access_approval_notification(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_barber_access_approval_notification(uuid)
  TO service_role;

COMMIT;
