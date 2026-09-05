-- P1: Tighten overly open RLS without breaking the app.
-- Public booking, slots, services, gallery, and signup all use service_role
-- (supabaseAdmin), so anon/authenticated RLS changes do not affect those paths.
-- Authenticated tenant members keep existing FOR ALL / membership policies (OR'd).
--
-- Run in Supabase SQL Editor after P0. Prefer staging verification first if you
-- ever split projects; currently staging/prod share one Supabase DB.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) barber_services — public/anon may only read active services of active barbers
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can read barber services" ON public.barber_services;
DROP POLICY IF EXISTS "public_read_barber_services" ON public.barber_services;
DROP POLICY IF EXISTS "Public can read active barber services" ON public.barber_services;

CREATE POLICY "Public can read active barber services"
ON public.barber_services
FOR SELECT
TO anon, authenticated
USING (
  active = true
  AND EXISTS (
    SELECT 1
    FROM public.barbers b
    WHERE b.id = barber_services.barber_id
      AND b.active = true
  )
);

-- ---------------------------------------------------------------------------
-- 2) barber_weekly_schedule — public read only for active barbers
--    (aligned with barber_day_overrides public policy from 20260626)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "barber_weekly_schedule_read_public" ON public.barber_weekly_schedule;

CREATE POLICY "barber_weekly_schedule_read_public"
ON public.barber_weekly_schedule
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.barbers b
    WHERE b.id = barber_weekly_schedule.barber_id
      AND b.active = true
  )
);

-- ---------------------------------------------------------------------------
-- 3) tenants — drop open INSERT (signup uses service_role)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "tenants_insert_authenticated" ON public.tenants;
DROP POLICY IF EXISTS "Allow insert tenants" ON public.tenants;

-- ---------------------------------------------------------------------------
-- 4) salon_gallery — move from role public → authenticated + tenant membership
--    Public salon pages and admin gallery APIs use supabaseAdmin (bypass RLS).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "tenant gallery read" ON public.salon_gallery;
DROP POLICY IF EXISTS "tenant gallery insert" ON public.salon_gallery;
DROP POLICY IF EXISTS "tenant gallery update" ON public.salon_gallery;
DROP POLICY IF EXISTS "tenant gallery delete" ON public.salon_gallery;

ALTER TABLE public.salon_gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant gallery read"
ON public.salon_gallery
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

CREATE POLICY "tenant gallery insert"
ON public.salon_gallery
FOR INSERT
TO authenticated
WITH CHECK (
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

CREATE POLICY "tenant gallery update"
ON public.salon_gallery
FOR UPDATE
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
)
WITH CHECK (
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

CREATE POLICY "tenant gallery delete"
ON public.salon_gallery
FOR DELETE
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

COMMIT;
