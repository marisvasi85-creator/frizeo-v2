-- P0: ON DELETE CASCADE for tenant-scoped rows that still use NO ACTION.
-- Safe for the app: signup / booking / admin paths use service_role (supabaseAdmin).
-- UNIQUE(tenant_id) on subscriptions + notification_settings already applied in
-- 20260718_perf_core_indexes.sql (0 duplicates verified live).
--
-- Run in Supabase SQL Editor on the shared staging/prod project after review.
-- Does not block reads/writes; only changes delete behavior when a tenant is removed.

BEGIN;

-- ---------------------------------------------------------------------------
-- Helper: replace a single-column FK to tenants(id) with ON DELETE CASCADE
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._frizeo_set_tenant_fk_cascade(
  p_table regclass,
  p_constraint_name text
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  existing_name text;
BEGIN
  SELECT c.conname INTO existing_name
  FROM pg_constraint c
  WHERE c.conrelid = p_table
    AND c.contype = 'f'
    AND pg_get_constraintdef(c.oid) ILIKE '%(tenant_id)%REFERENCES%tenants%'
  LIMIT 1;

  IF existing_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', p_table, existing_name);
  END IF;

  EXECUTE format(
    'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE',
    p_table,
    p_constraint_name
  );
END;
$$;

SELECT public._frizeo_set_tenant_fk_cascade('public.subscriptions'::regclass, 'subscriptions_tenant_id_fkey');
SELECT public._frizeo_set_tenant_fk_cascade('public.notification_settings'::regclass, 'notification_settings_tenant_id_fkey');
SELECT public._frizeo_set_tenant_fk_cascade('public.barber_services'::regclass, 'barber_services_tenant_id_fkey');

DROP FUNCTION public._frizeo_set_tenant_fk_cascade(regclass, text);

-- Ensure one subscription / notification_settings row per tenant (idempotent).
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_tenant_id_uidx
    ON public.subscriptions (tenant_id);
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'subscriptions: duplicate tenant_id rows exist; skip unique index';
END $$;

DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS notification_settings_tenant_id_uidx
    ON public.notification_settings (tenant_id);
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'notification_settings: duplicate tenant_id rows exist; skip unique index';
END $$;

COMMIT;
