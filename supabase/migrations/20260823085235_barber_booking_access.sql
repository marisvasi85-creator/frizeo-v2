-- Per-barber booking access modes and client approvals.
-- Safe rollout: existing and future barbers remain `open` by default.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Per-barber mode. Adding the NOT NULL default backfills existing rows
--    without changing any booking or blocking the current public flow.
-- ---------------------------------------------------------------------------
ALTER TABLE public.barbers
  ADD COLUMN IF NOT EXISTS booking_access_mode text NOT NULL DEFAULT 'open';

ALTER TABLE public.barbers
  DROP CONSTRAINT IF EXISTS barbers_booking_access_mode_check;

ALTER TABLE public.barbers
  ADD CONSTRAINT barbers_booking_access_mode_check
  CHECK (booking_access_mode IN ('open', 'approval_required', 'approved_only'));

COMMENT ON COLUMN public.barbers.booking_access_mode IS
  'open = public bookings; approval_required = new clients request access; approved_only = approved clients only.';

-- A composite key prevents a client-access row from carrying a tenant that
-- does not match its barber.
CREATE UNIQUE INDEX IF NOT EXISTS barbers_id_tenant_id_uidx
  ON public.barbers (id, tenant_id);

-- ---------------------------------------------------------------------------
-- 2) Canonical Romanian phone normalization used by views and DB enforcement.
--    07..., +407... and 00407... resolve to the same 40XXXXXXXXX value.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_ro_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
RETURNS NULL ON NULL INPUT
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  v_digits text;
BEGIN
  v_digits := regexp_replace(p_phone, '[^0-9]', '', 'g');

  IF v_digits LIKE '0040%' THEN
    v_digits := substring(v_digits FROM 3);
  ELSIF v_digits LIKE '0%' THEN
    v_digits := '40' || substring(v_digits FROM 2);
  ELSIF length(v_digits) = 9 AND v_digits LIKE '7%' THEN
    v_digits := '40' || v_digits;
  END IF;

  IF v_digits !~ '^40[0-9]{9}$' THEN
    RETURN NULL;
  END IF;

  RETURN v_digits;
END;
$function$;

REVOKE ALL ON FUNCTION public.normalize_ro_phone(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_ro_phone(text) TO service_role;

-- ---------------------------------------------------------------------------
-- 3) Canonical barber-client access relationship.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.barber_client_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  barber_id uuid NOT NULL,
  phone_normalized text NOT NULL,
  client_name text NOT NULL,
  client_email text,
  referral text,
  request_message text,
  status text NOT NULL DEFAULT 'pending',
  source text NOT NULL DEFAULT 'client_request',
  decision_source text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT barber_client_access_barber_tenant_fkey
    FOREIGN KEY (barber_id, tenant_id)
    REFERENCES public.barbers(id, tenant_id)
    ON DELETE CASCADE,
  CONSTRAINT barber_client_access_barber_phone_key
    UNIQUE (barber_id, phone_normalized),
  CONSTRAINT barber_client_access_phone_check
    CHECK (phone_normalized ~ '^40[0-9]{9}$'),
  CONSTRAINT barber_client_access_name_check
    CHECK (char_length(btrim(client_name)) BETWEEN 1 AND 160),
  CONSTRAINT barber_client_access_email_check
    CHECK (client_email IS NULL OR char_length(client_email) <= 320),
  CONSTRAINT barber_client_access_referral_check
    CHECK (referral IS NULL OR char_length(referral) <= 240),
  CONSTRAINT barber_client_access_message_check
    CHECK (request_message IS NULL OR char_length(request_message) <= 1200),
  CONSTRAINT barber_client_access_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'blocked')),
  CONSTRAINT barber_client_access_source_check
    CHECK (source IN ('client_request', 'manual_admin', 'existing_client')),
  CONSTRAINT barber_client_access_decision_source_check
    CHECK (decision_source IS NULL OR decision_source IN ('manual_admin', 'existing_client'))
);

COMMENT ON TABLE public.barber_client_access IS
  'Per-barber booking eligibility keyed by canonical Romanian phone. No client login or OTP in this MVP.';

CREATE INDEX IF NOT EXISTS barber_client_access_tenant_status_idx
  ON public.barber_client_access (tenant_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS barber_client_access_barber_status_idx
  ON public.barber_client_access (barber_id, status, updated_at DESC);

-- Postgres does not create indexes for foreign-key columns automatically.
CREATE INDEX IF NOT EXISTS barber_client_access_decided_by_idx
  ON public.barber_client_access (decided_by)
  WHERE decided_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS barber_client_access_created_by_idx
  ON public.barber_client_access (created_by)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS barber_client_access_updated_by_idx
  ON public.barber_client_access (updated_by)
  WHERE updated_by IS NOT NULL;

CREATE TRIGGER barber_client_access_updated_at
BEFORE UPDATE ON public.barber_client_access
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4) RLS. Public callers never receive table access; public status/request
--    operations go through rate-limited Next.js endpoints with service_role.
-- ---------------------------------------------------------------------------
ALTER TABLE public.barber_client_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "barber_client_access_tenant_read"
ON public.barber_client_access
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.user_id = (SELECT auth.uid())
      AND tu.tenant_id = barber_client_access.tenant_id
      AND tu.role IN ('owner', 'manager')
  )
  OR EXISTS (
    SELECT 1
    FROM public.barbers b
    WHERE b.user_id = (SELECT auth.uid())
      AND b.id = barber_client_access.barber_id
      AND b.tenant_id = barber_client_access.tenant_id
  )
);

CREATE POLICY "barber_client_access_tenant_insert"
ON public.barber_client_access
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.user_id = (SELECT auth.uid())
      AND tu.tenant_id = barber_client_access.tenant_id
      AND tu.role IN ('owner', 'manager')
  )
  OR EXISTS (
    SELECT 1
    FROM public.barbers b
    WHERE b.user_id = (SELECT auth.uid())
      AND b.id = barber_client_access.barber_id
      AND b.tenant_id = barber_client_access.tenant_id
  )
);

CREATE POLICY "barber_client_access_tenant_update"
ON public.barber_client_access
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.user_id = (SELECT auth.uid())
      AND tu.tenant_id = barber_client_access.tenant_id
      AND tu.role IN ('owner', 'manager')
  )
  OR EXISTS (
    SELECT 1
    FROM public.barbers b
    WHERE b.user_id = (SELECT auth.uid())
      AND b.id = barber_client_access.barber_id
      AND b.tenant_id = barber_client_access.tenant_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.user_id = (SELECT auth.uid())
      AND tu.tenant_id = barber_client_access.tenant_id
      AND tu.role IN ('owner', 'manager')
  )
  OR EXISTS (
    SELECT 1
    FROM public.barbers b
    WHERE b.user_id = (SELECT auth.uid())
      AND b.id = barber_client_access.barber_id
      AND b.tenant_id = barber_client_access.tenant_id
  )
);

REVOKE ALL ON TABLE public.barber_client_access FROM PUBLIC, anon;
REVOKE DELETE ON TABLE public.barber_client_access FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.barber_client_access TO authenticated;
GRANT ALL ON TABLE public.barber_client_access TO service_role;

-- ---------------------------------------------------------------------------
-- 5) Existing clients are derived from booking history, never copied into a
--    duplicate customer table. The view is service-role only because it has PII.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.barber_existing_clients
WITH (security_invoker = true)
AS
WITH normalized AS (
  SELECT
    b.id,
    b.tenant_id,
    b.barber_id,
    public.normalize_ro_phone(b.client_phone) AS phone_normalized,
    nullif(btrim(b.client_name), '') AS client_name,
    nullif(btrim(b.client_email), '') AS client_email,
    b.status,
    b.date,
    b.start_time,
    b.created_at
  FROM public.bookings b
  WHERE public.normalize_ro_phone(b.client_phone) IS NOT NULL
)
SELECT
  tenant_id,
  barber_id,
  phone_normalized,
  (
    array_agg(client_name ORDER BY date DESC, start_time DESC, created_at DESC, id DESC)
    FILTER (WHERE client_name IS NOT NULL)
  )[1] AS client_name,
  (
    array_agg(client_email ORDER BY date DESC, start_time DESC, created_at DESC, id DESC)
    FILTER (WHERE client_email IS NOT NULL)
  )[1] AS client_email,
  count(*)::integer AS appointment_count,
  max(date) AS last_appointment,
  count(*) FILTER (WHERE status = 'cancelled')::integer AS cancellation_count,
  count(*) FILTER (WHERE status = 'no_show')::integer AS no_show_count
FROM normalized
GROUP BY tenant_id, barber_id, phone_normalized;

REVOKE ALL ON TABLE public.barber_existing_clients
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.barber_existing_clients TO service_role;

-- ---------------------------------------------------------------------------
-- 6) Final database guard. Holds remain possible as `pending`, but every new
--    transition/insert to `confirmed` is checked. Existing confirmed bookings
--    and atomic reschedules remain governed by their current rules.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_barber_booking_access()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_mode text;
  v_tenant_id uuid;
  v_phone text;
  v_previous public.bookings;
BEGIN
  IF NEW.status IS DISTINCT FROM 'confirmed' THEN
    RETURN NEW;
  END IF;

  -- Do not retroactively block ordinary edits to appointments that were
  -- already valid. Changing the barber or client phone is a new access check.
  IF TG_OP = 'UPDATE'
    AND OLD.status = 'confirmed'
    AND NEW.barber_id = OLD.barber_id
    AND public.normalize_ro_phone(NEW.client_phone)
      IS NOT DISTINCT FROM public.normalize_ro_phone(OLD.client_phone)
  THEN
    RETURN NEW;
  END IF;

  SELECT b.booking_access_mode, b.tenant_id
  INTO v_mode, v_tenant_id
  FROM public.barbers b
  WHERE b.id = NEW.barber_id
    AND b.active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_ACCESS_BARBER_UNAVAILABLE';
  END IF;

  IF v_mode = 'open' THEN
    RETURN NEW;
  END IF;

  v_phone := public.normalize_ro_phone(NEW.client_phone);

  -- A client may always reschedule their already-created appointment. The
  -- replacement row must retain the same barber and normalized phone.
  IF NEW.rescheduled_from IS NOT NULL THEN
    SELECT *
    INTO v_previous
    FROM public.bookings old_booking
    WHERE old_booking.id = NEW.rescheduled_from;

    IF FOUND
      AND v_previous.barber_id = NEW.barber_id
      AND public.normalize_ro_phone(v_previous.client_phone) = v_phone
    THEN
      RETURN NEW;
    END IF;
  END IF;

  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'BOOKING_ACCESS_INVALID_PHONE';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.barber_client_access access_row
    WHERE access_row.tenant_id = v_tenant_id
      AND access_row.barber_id = NEW.barber_id
      AND access_row.phone_normalized = v_phone
      AND access_row.status = 'approved'
  ) THEN
    RAISE EXCEPTION 'BOOKING_ACCESS_REQUIRED';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_barber_booking_access()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_enforce_barber_booking_access
  ON public.bookings;

CREATE TRIGGER trigger_enforce_barber_booking_access
BEFORE INSERT OR UPDATE OF status, client_phone, barber_id
ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.enforce_barber_booking_access();

COMMIT;

-- Reversible rollback (manual, only before depending code is deployed):
-- DROP TRIGGER IF EXISTS trigger_enforce_barber_booking_access ON public.bookings;
-- DROP FUNCTION IF EXISTS public.enforce_barber_booking_access();
-- DROP VIEW IF EXISTS public.barber_existing_clients;
-- DROP TABLE IF EXISTS public.barber_client_access;
-- DROP FUNCTION IF EXISTS public.normalize_ro_phone(text);
-- ALTER TABLE public.barbers DROP CONSTRAINT IF EXISTS barbers_booking_access_mode_check;
-- ALTER TABLE public.barbers DROP COLUMN IF EXISTS booking_access_mode;
-- DROP INDEX IF EXISTS public.barbers_id_tenant_id_uidx;
