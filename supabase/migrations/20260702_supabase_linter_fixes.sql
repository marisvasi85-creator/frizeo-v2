-- Supabase Security Advisor fixes (safe for Frizeo v2 app)
-- Run in Supabase SQL Editor after migrations 20260621–20260630.
--
-- App booking flows use service_role via Next.js API routes, not public RPC.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Booking RPC: only service_role may execute (not anon/authenticated)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'create_booking_safe',
        'create_booking_safe_v2',
        'reschedule_booking_safe',
        'cancel_booking_safe'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Pin search_path on public helper / booking functions (linter 0011)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'reschedule_booking_safe',
        'set_updated_at',
        'get_current_tenant_id',
        'get_current_role',
        'get_current_barber_id',
        'create_booking_safe',
        'create_booking_safe_v2',
        'cancel_booking_safe',
        'prevent_booking_overlap'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', fn);
  END LOOP;
END $$;

COMMIT;
