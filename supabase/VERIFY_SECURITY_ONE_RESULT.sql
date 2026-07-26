-- Single result grid — paste the whole JSON/table back.

WITH checks AS (
  SELECT 'A_tenant_users_writes' AS check_id,
    (
      SELECT count(*)::int
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'tenant_users'
        AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
        AND (
          roles::text LIKE '%authenticated%'
          OR roles::text LIKE '%anon%'
          OR roles::text LIKE '%public%'
        )
    ) AS value_int,
    NULL::text AS value_text,
    'expect 0' AS expected

  UNION ALL
  SELECT 'B_bookings_policy_count',
    (
      SELECT count(*)::int
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'bookings'
    ),
    (
      SELECT string_agg(policyname || ':' || cmd, ', ' ORDER BY policyname)
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'bookings'
    ),
    'expect 2: bookings_tenant_read, bookings_tenant_update'

  UNION ALL
  SELECT 'C_legacy_bookings',
    (
      SELECT count(*)::int
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
        )
    ),
    NULL,
    'expect 0'

  UNION ALL
  SELECT 'D_notification_policies',
    (
      SELECT count(*)::int
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'notification_settings'
    ),
    (
      SELECT string_agg(policyname || ':' || cmd, ', ' ORDER BY policyname)
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'notification_settings'
    ),
    'expect tenant_read + tenant_write'

  UNION ALL
  SELECT 'E_rate_limit_privs',
    NULL,
    format(
      'anon=%s auth=%s service=%s',
      has_function_privilege(
        'anon',
        'public.consume_api_rate_limit(text,text,integer,integer)',
        'EXECUTE'
      ),
      has_function_privilege(
        'authenticated',
        'public.consume_api_rate_limit(text,text,integer,integer)',
        'EXECUTE'
      ),
      has_function_privilege(
        'service_role',
        'public.consume_api_rate_limit(text,text,integer,integer)',
        'EXECUTE'
      )
    ),
    'expect anon=false auth=false service=true'

  UNION ALL
  SELECT 'F_objects',
    NULL,
    format(
      'table=%s rate_fn=%s booking_rpc=%s',
      to_regclass('public.api_rate_limits') IS NOT NULL,
      EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'consume_api_rate_limit'
      ),
      EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'create_booking_safe_v2'
      )
    ),
    'expect table=true rate_fn=true booking_rpc=true'
)
SELECT
  check_id,
  value_int,
  value_text,
  expected,
  CASE check_id
    WHEN 'A_tenant_users_writes' THEN value_int = 0
    WHEN 'B_bookings_policy_count' THEN
      value_int = 2
      AND value_text = 'bookings_tenant_read:SELECT, bookings_tenant_update:UPDATE'
    WHEN 'C_legacy_bookings' THEN value_int = 0
    WHEN 'D_notification_policies' THEN
      value_text ILIKE '%notification_settings_tenant_read%'
      AND value_text ILIKE '%notification_settings_tenant_write%'
      AND value_text NOT ILIKE '%notification_settings_insert%'
      AND value_text NOT ILIKE '%notification_settings_update%'
    WHEN 'E_rate_limit_privs' THEN
      value_text = 'anon=false auth=false service=true'
    WHEN 'F_objects' THEN
      value_text = 'table=true rate_fn=true booking_rpc=true'
    ELSE false
  END AS ok
FROM checks
ORDER BY check_id;
