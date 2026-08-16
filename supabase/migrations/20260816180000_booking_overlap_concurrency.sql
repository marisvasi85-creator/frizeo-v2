-- Booking concurrency hardening:
-- 1) Overlap trigger ignores expired pending holds (no cron dependency)
-- 2) Overlap trigger also runs on UPDATE (admin update-full races)
-- 3) create_booking_safe_v2 pre-check matches the same pending rule
-- 4) Atomic reschedule_booking_safe (create + cancel old in one transaction)

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) prevent_booking_overlap: active statuses only + UPDATE support
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_booking_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only enforce when the row would occupy a slot.
  IF NEW.status IS DISTINCT FROM 'confirmed'
     AND NEW.status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;

  -- Expired pending holds must not block new bookings.
  IF NEW.status = 'pending'
     AND NEW.expires_at IS NOT NULL
     AND NEW.expires_at <= now() THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.barber_id = NEW.barber_id
      AND b.date = NEW.date
      AND b.id IS DISTINCT FROM NEW.id
      AND (NEW.rescheduled_from IS NULL OR b.id IS DISTINCT FROM NEW.rescheduled_from)
      AND (
        b.status = 'confirmed'
        OR (
          b.status = 'pending'
          AND (b.expires_at IS NULL OR b.expires_at > now())
        )
      )
      AND NEW.start_time < b.end_time
      AND NEW.end_time > b.start_time
  ) THEN
    RAISE EXCEPTION 'Slot ocupat';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_prevent_overlap ON public.bookings;

CREATE TRIGGER trigger_prevent_overlap
BEFORE INSERT OR UPDATE OF barber_id, date, start_time, end_time, status, expires_at
ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.prevent_booking_overlap();

-- ---------------------------------------------------------------------------
-- 2) Align create_booking_safe_v2 pre-check with expired-pending rule
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

REVOKE ALL ON FUNCTION public.create_booking_safe_v2(
  uuid, uuid, date, time, time, text, text, text, integer, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_safe_v2(
  uuid, uuid, date, time, time, text, text, text, integer, uuid
) TO service_role;

-- ---------------------------------------------------------------------------
-- 3) Atomic reschedule: insert new confirmed + cancel old in one TX
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

REVOKE ALL ON FUNCTION public.reschedule_booking_safe(
  uuid, date, time, text, text, text, text, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_booking_safe(
  uuid, date, time, text, text, text, text, uuid
) TO service_role;

COMMIT;
