-- Optional client notes on bookings (Mentiuni)

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS client_notes text;

COMMENT ON COLUMN public.bookings.client_notes IS 'Optional notes from client or admin when booking';
