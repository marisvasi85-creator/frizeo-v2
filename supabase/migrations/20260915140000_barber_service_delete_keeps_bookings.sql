-- Catalog delete for barber_services must not destroy bookings.
-- "Șterge programarea" only cancels the row; cancelled bookings still hold
-- bookings.barber_service_id, so a hard DELETE hits FK 23503.
--
-- Fix: soft-delete (deleted_at + active=false). Bookings keep the FK so
-- names/durations still join. New bookings cannot use the removed service.
-- Reschedule of an existing booking may keep the original service even after
-- catalog delete. Switching to a different service still requires a live one.
--
-- Defense in depth: bookings.barber_service_id ON DELETE SET NULL, matching
-- the legacy bookings.service_id FK.

BEGIN;

ALTER TABLE public.barber_services
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS barber_services_barber_id_catalog_idx
  ON public.barber_services (barber_id, sort_order)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS bookings_barber_service_id_idx
  ON public.bookings (barber_service_id);

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_barber_service_id_fkey;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_barber_service_id_fkey
  FOREIGN KEY (barber_service_id)
  REFERENCES public.barber_services(id)
  ON DELETE SET NULL;

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
    AND coalesce(s.active, true) = true
    AND s.deleted_at IS NULL;

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

  -- Same service as the original booking stays valid after catalog delete.
  -- A different service must still be in the live catalog.
  SELECT s.duration
  INTO v_duration
  FROM public.barber_services s
  WHERE s.id = v_service_id
    AND s.barber_id = old_booking.barber_id
    AND s.tenant_id = old_booking.tenant_id
    AND (
      s.id IS NOT DISTINCT FROM old_booking.barber_service_id
      OR (
        coalesce(s.active, true) = true
        AND s.deleted_at IS NULL
      )
    );

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

COMMIT;
