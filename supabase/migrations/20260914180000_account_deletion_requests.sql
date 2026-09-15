-- Account deletion: request + 7-day grace + safe Auth detach.
-- Additive / reversible. Does NOT delete existing rows.
--
-- Safety prerequisite:
--   barbers.user_id is NOT NULL + ON DELETE CASCADE today.
--   Deleting auth.users would CASCADE delete the barber, which CASCADE
--   deletes that barber's bookings. Make user_id nullable and SET NULL
--   so Auth deletion cannot destroy salon bookings.
--
-- Rollback / mitigation:
--   1. Stop the account-deletion cron and admin "Delete now".
--   2. DROP TABLE public.account_deletion_requests CASCADE;
--   3. Do NOT restore barbers.user_id NOT NULL / ON DELETE CASCADE while
--      any detached (user_id IS NULL) barbers exist — that would fail or
--      re-introduce the bookings CASCADE hazard.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Detach barbers from Auth without destroying bookings
-- ---------------------------------------------------------------------------
ALTER TABLE public.barbers
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.barbers
  DROP CONSTRAINT IF EXISTS barbers_user_id_fkey;

ALTER TABLE public.barbers
  ADD CONSTRAINT barbers_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users (id)
  ON DELETE SET NULL;

-- unique_user_per_barber stays: PostgreSQL UNIQUE allows multiple NULLs.

-- ---------------------------------------------------------------------------
-- 2. Request table (survives Auth deletion)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES public.tenants (id) ON DELETE SET NULL,
  email_snapshot text NOT NULL,
  reason text,
  reason_details text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'cancelled', 'processing', 'completed', 'failed')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  scheduled_for timestamptz NOT NULL,
  cancelled_at timestamptz,
  completed_at timestamptz,
  failure_reason text,
  attempt_count integer NOT NULL DEFAULT 0,
  claimed_at timestamptz,
  claim_token uuid,
  request_email_sent_at timestamptz,
  cancel_email_sent_at timestamptz,
  final_email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_deletion_requests_reason_check
    CHECK (
      reason IS NULL
      OR reason IN (
        'not_using',
        'other_app',
        'too_complicated',
        'missing_feature',
        'price',
        'technical_issues',
        'other'
      )
    ),
  CONSTRAINT account_deletion_requests_reason_details_len_check
    CHECK (reason_details IS NULL OR char_length(reason_details) <= 2000)
);

CREATE UNIQUE INDEX IF NOT EXISTS account_deletion_requests_one_active_per_user
  ON public.account_deletion_requests (user_id)
  WHERE status IN ('pending', 'processing') AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS account_deletion_requests_due_idx
  ON public.account_deletion_requests (scheduled_for)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS account_deletion_requests_status_idx
  ON public.account_deletion_requests (status, requested_at DESC);

CREATE INDEX IF NOT EXISTS account_deletion_requests_email_snapshot_idx
  ON public.account_deletion_requests (lower(email_snapshot));

-- ---------------------------------------------------------------------------
-- 3. updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_account_deletion_requests_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS account_deletion_requests_set_updated_at
  ON public.account_deletion_requests;
CREATE TRIGGER account_deletion_requests_set_updated_at
BEFORE UPDATE ON public.account_deletion_requests
FOR EACH ROW
EXECUTE FUNCTION public.set_account_deletion_requests_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Guard client writes: users may only request/cancel themselves.
--    Privileged transitions (processing/completed/failed/schedule) are
--    service_role / postgres only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_account_deletion_request_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.user_id := auth.uid();
      NEW.status := 'pending';
      NEW.requested_at := now();
      NEW.scheduled_for := now() + interval '7 days';
      NEW.cancelled_at := NULL;
      NEW.completed_at := NULL;
      NEW.failure_reason := NULL;
      NEW.attempt_count := 0;
      NEW.claimed_at := NULL;
      NEW.claim_token := NULL;
      NEW.request_email_sent_at := NULL;
      NEW.cancel_email_sent_at := NULL;
      NEW.final_email_sent_at := NULL;

      SELECT u.email INTO v_email
      FROM auth.users u
      WHERE u.id = auth.uid();

      IF v_email IS NOT NULL AND btrim(v_email) <> '' THEN
        NEW.email_snapshot := lower(btrim(v_email));
      END IF;
    END IF;

    IF NEW.email_snapshot IS NULL OR btrim(NEW.email_snapshot) = '' THEN
      RAISE EXCEPTION 'email_snapshot is required';
    END IF;

    NEW.email_snapshot := lower(btrim(NEW.email_snapshot));
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF auth.uid() IS NOT NULL THEN
      IF OLD.user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'cannot update another user deletion request';
      END IF;
      IF OLD.status IS DISTINCT FROM 'pending' THEN
        RAISE EXCEPTION 'only pending deletion requests can be cancelled';
      END IF;
      IF NEW.status IS DISTINCT FROM 'cancelled' THEN
        RAISE EXCEPTION 'users may only cancel a pending deletion request';
      END IF;

      NEW.user_id := OLD.user_id;
      NEW.tenant_id := OLD.tenant_id;
      NEW.email_snapshot := OLD.email_snapshot;
      NEW.reason := OLD.reason;
      NEW.reason_details := OLD.reason_details;
      NEW.requested_at := OLD.requested_at;
      NEW.scheduled_for := OLD.scheduled_for;
      NEW.completed_at := OLD.completed_at;
      NEW.failure_reason := OLD.failure_reason;
      NEW.attempt_count := OLD.attempt_count;
      NEW.claimed_at := OLD.claimed_at;
      NEW.claim_token := OLD.claim_token;
      NEW.request_email_sent_at := OLD.request_email_sent_at;
      NEW.final_email_sent_at := OLD.final_email_sent_at;
      NEW.cancelled_at := coalesce(NEW.cancelled_at, now());
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS account_deletion_requests_guard_write
  ON public.account_deletion_requests;
CREATE TRIGGER account_deletion_requests_guard_write
BEFORE INSERT OR UPDATE ON public.account_deletion_requests
FOR EACH ROW
EXECUTE FUNCTION public.guard_account_deletion_request_write();

-- ---------------------------------------------------------------------------
-- 5. Atomic claim for the daily worker (SKIP LOCKED, idempotent)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_account_deletion_batch(
  p_limit integer DEFAULT 5,
  p_lease_seconds integer DEFAULT 900,
  p_max_attempts integer DEFAULT 5,
  p_force_id uuid DEFAULT NULL
)
RETURNS SETOF public.account_deletion_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch integer := greatest(1, least(coalesce(p_limit, 5), 20));
  v_lease integer := greatest(60, least(coalesce(p_lease_seconds, 900), 3600));
  v_max integer := greatest(1, least(coalesce(p_max_attempts, 5), 10));
BEGIN
  -- Recover stale processing leases so retries are safe.
  UPDATE public.account_deletion_requests req
  SET status = CASE
        WHEN req.attempt_count >= v_max THEN 'failed'
        ELSE 'pending'
      END,
      failure_reason = CASE
        WHEN req.attempt_count >= v_max THEN coalesce(req.failure_reason, 'claim_lease_expired')
        ELSE req.failure_reason
      END,
      claim_token = NULL,
      claimed_at = NULL
  WHERE req.status = 'processing'
    AND req.claimed_at IS NOT NULL
    AND req.claimed_at < now() - make_interval(secs => v_lease);

  RETURN QUERY
  WITH due AS (
    SELECT req.id
    FROM public.account_deletion_requests req
    WHERE req.status = 'pending'
      AND (
        (p_force_id IS NOT NULL AND req.id = p_force_id)
        OR (p_force_id IS NULL AND req.scheduled_for <= now())
      )
    ORDER BY req.scheduled_for, req.created_at
    FOR UPDATE OF req SKIP LOCKED
    LIMIT CASE WHEN p_force_id IS NULL THEN v_batch ELSE 1 END
  )
  UPDATE public.account_deletion_requests req
  SET status = 'processing',
      claimed_at = now(),
      claim_token = gen_random_uuid(),
      attempt_count = req.attempt_count + 1,
      failure_reason = NULL
  FROM due
  WHERE req.id = due.id
  RETURNING req.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_account_deletion_batch(integer, integer, integer, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_account_deletion_batch(integer, integer, integer, uuid)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.account_deletion_requests FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.account_deletion_requests TO authenticated;
GRANT ALL ON public.account_deletion_requests TO service_role;

DROP POLICY IF EXISTS account_deletion_requests_select_own
  ON public.account_deletion_requests;
CREATE POLICY account_deletion_requests_select_own
ON public.account_deletion_requests
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS account_deletion_requests_insert_own
  ON public.account_deletion_requests;
CREATE POLICY account_deletion_requests_insert_own
ON public.account_deletion_requests
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS account_deletion_requests_update_cancel_own
  ON public.account_deletion_requests;
CREATE POLICY account_deletion_requests_update_cancel_own
ON public.account_deletion_requests
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND status = 'pending')
WITH CHECK (user_id = auth.uid() AND status = 'cancelled');

COMMIT;
