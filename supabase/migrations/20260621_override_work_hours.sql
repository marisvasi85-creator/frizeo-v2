-- Rulează în Supabase SQL Editor dacă nu există deja coloanele.
ALTER TABLE barber_day_overrides
  ADD COLUMN IF NOT EXISTS work_start time,
  ADD COLUMN IF NOT EXISTS work_end time;
