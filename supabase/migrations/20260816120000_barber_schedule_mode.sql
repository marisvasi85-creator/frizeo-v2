-- Barber schedule mode: weekly (default) vs selective (explicit working days only).

ALTER TABLE public.barbers
  ADD COLUMN IF NOT EXISTS schedule_mode text NOT NULL DEFAULT 'weekly';

ALTER TABLE public.barbers
  DROP CONSTRAINT IF EXISTS barbers_schedule_mode_check;

ALTER TABLE public.barbers
  ADD CONSTRAINT barbers_schedule_mode_check
  CHECK (schedule_mode IN ('weekly', 'selective'));

COMMENT ON COLUMN public.barbers.schedule_mode IS
  'weekly = recurring weekly schedule + day overrides; selective = only explicit working-day overrides open slots.';
