-- Tenant members can read and update notification settings for their salon.

BEGIN;

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_settings_tenant_read" ON public.notification_settings;
DROP POLICY IF EXISTS "notification_settings_tenant_write" ON public.notification_settings;

CREATE POLICY "notification_settings_tenant_read"
ON public.notification_settings
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

CREATE POLICY "notification_settings_tenant_write"
ON public.notification_settings
FOR ALL
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

COMMIT;
