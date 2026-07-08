-- Tags consecutive vacation closed days for grouping and public "Concediu" messaging.
ALTER TABLE barber_day_overrides
  ADD COLUMN IF NOT EXISTS vacation_period_id uuid;

CREATE INDEX IF NOT EXISTS barber_day_overrides_vacation_period_id_idx
  ON barber_day_overrides (barber_id, vacation_period_id)
  WHERE vacation_period_id IS NOT NULL;
