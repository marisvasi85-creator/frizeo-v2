-- RLS hardening for Frizeo v2
-- Run in Supabase SQL Editor (production) after reviewing.
-- Requires companion app deploy: public booking routes use service_role.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Revoke dangerous privileges
-- ---------------------------------------------------------------------------
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Safe public views (no OAuth tokens, no client PII)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.barbers_public
WITH (security_barrier = true) AS
SELECT
  id,
  display_name,
  active,
  tenant_id,
  phone,
  slug,
  avatar_url,
  bio,
  instagram_url
FROM public.barbers
WHERE active = true;

GRANT SELECT ON public.barbers_public TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Enable RLS on tables that were missing it
-- ---------------------------------------------------------------------------
ALTER TABLE public.barber_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barber_weekly_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 4. Drop obsolete / permissive policies
-- ---------------------------------------------------------------------------

-- barbers
DROP POLICY IF EXISTS "Public can read barbers" ON public.barbers;
DROP POLICY IF EXISTS "Public can view barbers" ON public.barbers;
DROP POLICY IF EXISTS "public_read_barbers_safe" ON public.barbers;

-- barber_google_accounts
DROP POLICY IF EXISTS "barber_google_accounts_select" ON public.barber_google_accounts;
DROP POLICY IF EXISTS "barber_google_accounts_insert" ON public.barber_google_accounts;

-- bookings (critical — remove open public access)
DROP POLICY IF EXISTS "Public can read bookings" ON public.bookings;
DROP POLICY IF EXISTS "Public can update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow public insert bookings" ON public.bookings;
DROP POLICY IF EXISTS "Public can insert bookings" ON public.bookings;
DROP POLICY IF EXISTS "Public can create booking" ON public.bookings;
DROP POLICY IF EXISTS "public insert booking" ON public.bookings;
DROP POLICY IF EXISTS "public read booking by token" ON public.bookings;
DROP POLICY IF EXISTS "public read by token" ON public.bookings;

-- tenants
DROP POLICY IF EXISTS "Allow insert tenants" ON public.tenants;
DROP POLICY IF EXISTS "Allow authenticated users to read tenants" ON public.tenants;

-- ---------------------------------------------------------------------------
-- 5. barber_google_accounts — only owning barber
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "barber_google_accounts_own" ON public.barber_google_accounts;

CREATE POLICY "barber_google_accounts_own"
ON public.barber_google_accounts
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.barbers b
    WHERE b.id = barber_google_accounts.barber_id
      AND b.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.barbers b
    WHERE b.id = barber_google_accounts.barber_id
      AND b.user_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- 6. barber_day_overrides — public read for slot calculation (no PII)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "public_read_day_overrides" ON public.barber_day_overrides;

CREATE POLICY "public_read_day_overrides"
ON public.barber_day_overrides
FOR SELECT
TO public
USING (
  barber_id IN (
    SELECT id FROM public.barbers WHERE active = true
  )
);

-- ---------------------------------------------------------------------------
-- 7. barber_weekly_schedule — public read (RLS was disabled)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "barber_weekly_schedule_read_public" ON public.barber_weekly_schedule;

CREATE POLICY "barber_weekly_schedule_read_public"
ON public.barber_weekly_schedule
FOR SELECT
TO public
USING (true);

-- ---------------------------------------------------------------------------
-- 8. barber_invitations — tenant owners/managers only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "barber_invitations_tenant_read" ON public.barber_invitations;
DROP POLICY IF EXISTS "barber_invitations_tenant_insert" ON public.barber_invitations;
DROP POLICY IF EXISTS "barber_invitations_tenant_delete" ON public.barber_invitations;

CREATE POLICY "barber_invitations_tenant_read"
ON public.barber_invitations
FOR SELECT
TO authenticated
USING (
  tenant_id = public.get_current_tenant_id()
  AND public.get_current_role() = ANY (ARRAY['owner', 'manager'])
);

CREATE POLICY "barber_invitations_tenant_insert"
ON public.barber_invitations
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = public.get_current_tenant_id()
  AND public.get_current_role() = ANY (ARRAY['owner', 'manager'])
);

CREATE POLICY "barber_invitations_tenant_delete"
ON public.barber_invitations
FOR DELETE
TO authenticated
USING (
  tenant_id = public.get_current_tenant_id()
  AND public.get_current_role() = ANY (ARRAY['owner', 'manager'])
);

-- ---------------------------------------------------------------------------
-- 9. booking_cancellations — tenant-scoped
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "booking_cancellations_tenant_read" ON public.booking_cancellations;
DROP POLICY IF EXISTS "booking_cancellations_tenant_insert" ON public.booking_cancellations;

CREATE POLICY "booking_cancellations_tenant_read"
ON public.booking_cancellations
FOR SELECT
TO authenticated
USING (
  booking_id IN (
    SELECT b.id
    FROM public.bookings b
    WHERE b.tenant_id = public.get_current_tenant_id()
  )
);

CREATE POLICY "booking_cancellations_tenant_insert"
ON public.booking_cancellations
FOR INSERT
TO authenticated
WITH CHECK (
  booking_id IN (
    SELECT b.id
    FROM public.bookings b
    WHERE b.tenant_id = public.get_current_tenant_id()
  )
);

-- ---------------------------------------------------------------------------
-- 10. plans — public catalog read only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "plans_public_read" ON public.plans;

CREATE POLICY "plans_public_read"
ON public.plans
FOR SELECT
TO public
USING (true);

-- ---------------------------------------------------------------------------
-- 11. subscriptions — tenant members read only (writes via service_role)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "subscriptions_tenant_read" ON public.subscriptions;

CREATE POLICY "subscriptions_tenant_read"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tu.tenant_id
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- 12. tenant_users
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "tenant_users_same_tenant" ON public.tenant_users;
DROP POLICY IF EXISTS "tenant_users_insert_self" ON public.tenant_users;

CREATE POLICY "tenant_users_same_tenant"
ON public.tenant_users
FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tu.tenant_id
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
  )
);

CREATE POLICY "tenant_users_insert_self"
ON public.tenant_users
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 13. tenants — membership read + controlled write
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read only their tenants" ON public.tenants;
DROP POLICY IF EXISTS "tenants_insert_authenticated" ON public.tenants;
DROP POLICY IF EXISTS "tenants_update_member" ON public.tenants;

CREATE POLICY "tenants_read_members"
ON public.tenants
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT tu.tenant_id
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
  )
);

CREATE POLICY "tenants_insert_authenticated"
ON public.tenants
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "tenants_update_member"
ON public.tenants
FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT tu.tenant_id
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
      AND tu.role = ANY (ARRAY['owner', 'manager'])
  )
)
WITH CHECK (
  id IN (
    SELECT tu.tenant_id
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
      AND tu.role = ANY (ARRAY['owner', 'manager'])
  )
);

COMMIT;
