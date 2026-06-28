-- Tenant members can read bookings for their salon (admin UI + authenticated APIs)
BEGIN;

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookings_tenant_read" ON public.bookings;
DROP POLICY IF EXISTS "bookings_tenant_update" ON public.bookings;

CREATE POLICY "bookings_tenant_read"
ON public.bookings
FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tu.tenant_id
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
  )
  OR tenant_id IN (
    SELECT b.tenant_id
    FROM public.barbers b
    WHERE b.user_id = auth.uid()
  )
);

CREATE POLICY "bookings_tenant_update"
ON public.bookings
FOR UPDATE
TO authenticated
USING (
  tenant_id IN (
    SELECT tu.tenant_id
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
  )
  OR barber_id IN (
    SELECT b.id
    FROM public.barbers b
    WHERE b.user_id = auth.uid()
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT tu.tenant_id
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
  )
  OR barber_id IN (
    SELECT b.id
    FROM public.barbers b
    WHERE b.user_id = auth.uid()
  )
);

COMMIT;
