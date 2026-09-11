-- After cancel, the same hour must be bookable again.
-- 1) unique_booking_slot currently includes completed/no_show/expired pending
--    (status <> 'cancelled'), so a cancelled-looking free slot can still fail insert.
-- 2) Expired pending holds stay in that unique index until a cron deletes them.
--    Cancel those rows in the overlap trigger so a new booking can take the slot
--    without waiting on cleanup.

BEGIN;

DROP INDEX IF EXISTS public.bookings_unique_slot;
DROP INDEX IF EXISTS public.unique_booking_slot;

CREATE UNIQUE INDEX IF NOT EXISTS unique_booking_slot
  ON public.bookings USING btree (barber_id, date, start_time)
  WHERE status IN ('confirmed', 'pending');

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

  -- unique_booking_slot cannot expire rows by time. Cancel leftover holds
  -- so the unique index releases the slot in this same statement.
  UPDATE public.bookings
  SET status = 'cancelled'
  WHERE barber_id = NEW.barber_id
    AND date = NEW.date
    AND id IS DISTINCT FROM NEW.id
    AND status = 'pending'
    AND expires_at IS NOT NULL
    AND expires_at <= now()
    AND NEW.start_time < end_time
    AND NEW.end_time > start_time;

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

COMMIT;
