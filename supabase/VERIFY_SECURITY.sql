-- Quick verify after APPLY_NOW_SECURITY.sql
-- Run in Supabase SQL Editor and paste all result grids back.

-- A) tenant_users: must be 0 writable policies for browser roles
SELECT 'A_tenant_users_writes' AS check_id, policyname, cmd, roles::text
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'tenant_users'
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  AND (
    roles::text LIKE '%authenticated%'
    OR roles::text LIKE '%anon%'
    OR roles::text LIKE '%public%'
  );

-- B) bookings policies: expect only bookings_tenant_read + bookings_tenant_update
SELECT 'B_bookings_policies' AS check_id, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'bookings'
ORDER BY policyname;

-- C) legacy booking policies must be gone (0 rows)
SELECT 'C_legacy_bookings' AS check_id, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'bookings'
  AND policyname IN (
    'tenant read bookings',
    'Barber can read own bookings',
    'Barber can update own bookings',
    'bookings_select',
    'bookings_update',
    'bookings_insert',
    'bookings_delete'
  );

-- D) notification_settings policies
SELECT 'D_notification_policies' AS check_id, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'notification_settings'
ORDER BY policyname;

-- E) rate limit: anon/auth must be false, service_role true
SELECT
  'E_rate_limit_privs' AS check_id,
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

-- F) tables/functions exist
SELECT
  'F_objects' AS check_id,
  to_regclass('public.api_rate_limits') AS api_rate_limits_table,
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'consume_api_rate_limit'
  ) AS has_rate_limit_fn,
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_booking_safe_v2'
  ) AS has_booking_rpc;
