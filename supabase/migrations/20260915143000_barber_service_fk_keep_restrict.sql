-- Soft-delete (deleted_at) is the catalog delete path. Do not null out
-- bookings.barber_service_id when a service row is removed: a leftover
-- hard DELETE in the deployed app would wipe historical service labels.
-- Keep the FK restrictive (NO ACTION).

BEGIN;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_barber_service_id_fkey;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_barber_service_id_fkey
  FOREIGN KEY (barber_service_id)
  REFERENCES public.barber_services(id);

COMMIT;
