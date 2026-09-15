-- Account deletion follow-up: nullable barber.user_id safety + ownership transfer.
-- Additive. Does NOT delete tenants, bookings, invoices, or Google Calendar events.
--
-- barbers.user_id may be NULL only after Auth detach. INSERT still requires
-- user_id. An anonymized barber (user_id IS NULL) must stay inactive.
--
-- tenant_users.role already has explicit owner/manager/barber. This adds an
-- atomic, server-side ownership transfer. The current owner must choose the target.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Anonymized barbers cannot be active; new barbers must have Auth.
-- ---------------------------------------------------------------------------
ALTER TABLE public.barbers
  DROP CONSTRAINT IF EXISTS barbers_detached_must_be_inactive;

ALTER TABLE public.barbers
  ADD CONSTRAINT barbers_detached_must_be_inactive
  CHECK (user_id IS NOT NULL OR active = false);

CREATE OR REPLACE FUNCTION public.barbers_require_user_id_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'barbers.user_id is required on insert';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS barbers_require_user_id_on_insert
  ON public.barbers;
CREATE TRIGGER barbers_require_user_id_on_insert
BEFORE INSERT ON public.barbers
FOR EACH ROW
EXECUTE FUNCTION public.barbers_require_user_id_on_insert();

-- ---------------------------------------------------------------------------
-- 2. New bookings cannot land on an anonymized or inactive barber.
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
  WHERE b.id = p_barber_id
    AND b.active = true
    AND b.user_id IS NOT NULL;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Barber is not accepting bookings';
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

  v_end := (p_start + make_interval(mins => v_duration))::time;

  UPDATE public.bookings
  SET status = 'cancelled'
  WHERE barber_id = p_barber_id
    AND date = p_date
    AND (p_exclude_booking_id IS NULL OR id IS DISTINCT FROM p_exclude_booking_id)
    AND status = 'pending'
    AND expires_at IS NOT NULL
    AND expires_at <= now()
    AND start_time < v_end
    AND end_time > p_start;

  IF EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.barber_id = p_barber_id
      AND b.date = p_date
      AND b.start_time < v_end
      AND b.end_time > p_start
      AND (p_exclude_booking_id IS NULL OR b.id IS DISTINCT FROM p_exclude_booking_id)
      AND (
        b.status = 'confirmed'
        OR (
          b.status = 'pending'
          AND (b.expires_at IS NULL OR b.expires_at > now())
        )
      )
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
    rescheduled_from,
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
    p_exclude_booking_id,
    now()
  )
  RETURNING * INTO new_booking;

  RETURN new_booking;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Public/atomic reschedule cannot move onto a detached (user_id NULL) barber.
--    Inactive-but-attached barbers may still reschedule an existing booking.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reschedule_booking_safe(
  p_old_booking_id uuid,
  p_date date,
  p_start time without time zone,
  p_client_name text,
  p_client_phone text,
  p_client_email text,
  p_client_notes text DEFAULT NULL,
  p_barber_service_id uuid DEFAULT NULL
)
RETURNS bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  old_booking public.bookings;
  new_booking public.bookings;
  v_service_id uuid;
  v_duration integer;
  v_end time without time zone;
BEGIN
  SELECT *
  INTO old_booking
  FROM public.bookings
  WHERE id = p_old_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF old_booking.status IS DISTINCT FROM 'confirmed' THEN
    RAISE EXCEPTION 'Booking cannot be rescheduled';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.barbers b
    WHERE b.id = old_booking.barber_id
      AND b.user_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Barber is not accepting bookings';
  END IF;

  v_service_id := coalesce(p_barber_service_id, old_booking.barber_service_id);

  IF v_service_id IS NULL THEN
    RAISE EXCEPTION 'Invalid barber service';
  END IF;

  SELECT s.duration
  INTO v_duration
  FROM public.barber_services s
  WHERE s.id = v_service_id
    AND s.barber_id = old_booking.barber_id
    AND s.tenant_id = old_booking.tenant_id
    AND coalesce(s.active, true) = true;

  IF v_duration IS NULL OR v_duration < 1 THEN
    RAISE EXCEPTION 'Invalid barber service';
  END IF;

  v_end := (p_start + make_interval(mins => v_duration))::time;

  IF old_booking.date = p_date AND old_booking.start_time = p_start THEN
    RAISE EXCEPTION 'Same slot selected';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.barber_id = old_booking.barber_id
      AND b.date = p_date
      AND b.start_time < v_end
      AND b.end_time > p_start
      AND b.id IS DISTINCT FROM old_booking.id
      AND (
        b.status = 'confirmed'
        OR (
          b.status = 'pending'
          AND (b.expires_at IS NULL OR b.expires_at > now())
        )
      )
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
    client_notes,
    status,
    cancel_token,
    reschedule_token,
    reschedule_count,
    rescheduled_from,
    created_at
  )
  VALUES (
    old_booking.barber_id,
    old_booking.tenant_id,
    v_service_id,
    p_date,
    p_start,
    v_end,
    p_client_name,
    p_client_phone,
    p_client_email,
    p_client_notes,
    'confirmed',
    gen_random_uuid(),
    gen_random_uuid(),
    coalesce(old_booking.reschedule_count, 0) + 1,
    old_booking.id,
    now()
  )
  RETURNING * INTO new_booking;

  UPDATE public.bookings
  SET
    status = 'cancelled',
    reschedule_token = NULL
  WHERE id = old_booking.id;

  RETURN new_booking;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Atomic ownership transfer. Source owner is always auth.uid().
--    Never promotes a member without the current owner's explicit choice.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transfer_tenant_ownership(
  p_tenant_id uuid,
  p_to_user_id uuid,
  p_from_new_role text DEFAULT 'barber'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from uuid := auth.uid();
  v_from_role text;
  v_to_role text;
BEGIN
  IF v_from IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_from_new_role IS NULL OR p_from_new_role NOT IN ('barber', 'manager') THEN
    RAISE EXCEPTION 'invalid_from_role';
  END IF;

  IF p_to_user_id IS NULL OR p_to_user_id = v_from THEN
    RAISE EXCEPTION 'invalid_target';
  END IF;

  SELECT role INTO v_from_role
  FROM public.tenant_users
  WHERE tenant_id = p_tenant_id
    AND user_id = v_from
  FOR UPDATE;

  SELECT role INTO v_to_role
  FROM public.tenant_users
  WHERE tenant_id = p_tenant_id
    AND user_id = p_to_user_id
  FOR UPDATE;

  IF v_from_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'not_owner';
  END IF;

  IF v_to_role IS NULL THEN
    RAISE EXCEPTION 'target_not_member';
  END IF;

  UPDATE public.tenant_users
  SET role = CASE
        WHEN user_id = p_to_user_id THEN 'owner'
        WHEN user_id = v_from THEN p_from_new_role
        ELSE role
      END
  WHERE tenant_id = p_tenant_id
    AND user_id IN (v_from, p_to_user_id);

  IF NOT EXISTS (
    SELECT 1
    FROM public.tenant_users
    WHERE tenant_id = p_tenant_id
      AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'owner_missing_after_transfer';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'tenant_id', p_tenant_id,
    'from_user_id', v_from,
    'to_user_id', p_to_user_id,
    'from_new_role', p_from_new_role
  );
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_tenant_ownership(uuid, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_tenant_ownership(uuid, uuid, text)
  TO authenticated, service_role;

COMMIT;
