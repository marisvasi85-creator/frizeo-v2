-- Minimum advance notice (hours) before a client can book online

ALTER TABLE public.barbers
  ADD COLUMN IF NOT EXISTS min_booking_notice_hours integer NOT NULL DEFAULT 2;

COMMENT ON COLUMN public.barbers.min_booking_notice_hours IS
  'Minimum hours before appointment start that online booking is allowed (default 2).';
