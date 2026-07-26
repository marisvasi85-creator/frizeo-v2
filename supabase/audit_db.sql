-- Frizeo v2 — DB audit script
-- Run in Supabase SQL Editor → copy full result and share with dev.

-- 1) RLS enabled on critical tables
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'bookings', 'barbers', 'tenants', 'tenant_users',
    'subscriptions', 'notification_settings', 'barber_invitations'
  )
ORDER BY c.relname;

-- 2) Booking policies (must NOT contain open public insert/update)
SELECT tablename, policyname, cmd, roles::text
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'bookings'
ORDER BY policyname;

-- 10) No browser-writable tenant memberships (must return 0 rows)
SELECT policyname, cmd, roles::text
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'tenant_users'
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  AND (
    roles::text LIKE '%authenticated%'
    OR roles::text LIKE '%anon%'
    OR roles::text LIKE '%public%'
  );

-- 11) Barber booking policies are scoped by barber_id / role
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'bookings'
ORDER BY policyname;

-- 12) Rate-limit function is service-only
SELECT
  has_function_privilege(
    'anon',
    'public.consume_api_rate_limit(text,text,integer,integer)',
    'EXECUTE'
  ) AS anon_can_execute,
  has_function_privilege(
    'authenticated',
    'public.consume_api_rate_limit(text,text,integer,integer)',
    'EXECUTE'
  ) AS authenticated_can_execute,
  has_function_privilege(
    'service_role',
    'public.consume_api_rate_limit(text,text,integer,integer)',
    'EXECUTE'
  ) AS service_role_can_execute;

-- 2b) Red flag: public/anon write policies on bookings (should return 0 rows)
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'bookings'
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  AND (
    roles::text LIKE '%public%'
    OR roles::text LIKE '%anon%'
  );

-- 3) Stripe columns on subscriptions
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'subscriptions'
  AND column_name LIKE 'stripe%'
ORDER BY column_name;

-- 4) Billing profile columns on tenants
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tenants'
  AND column_name LIKE 'billing%'
ORDER BY column_name;

-- 5) work_start / work_end on barber_day_overrides (migration 20260621)
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'barber_day_overrides'
  AND column_name IN ('work_start', 'work_end');

-- 6) Plans seeded (Free, Pro, Pro+, Custom)
SELECT slug, name, price, max_barbers, max_bookings_per_month
FROM public.plans
ORDER BY price NULLS LAST, slug;

-- 7) barbers_public view exists
SELECT viewname FROM pg_views
WHERE schemaname = 'public' AND viewname = 'barbers_public';

-- 8) tenant_users read-own policy (migration 20260627)
SELECT policyname FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'tenant_users'
ORDER BY policyname;

-- 9) notification_settings policies (migration 20260630)
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'notification_settings'
ORDER BY policyname;
