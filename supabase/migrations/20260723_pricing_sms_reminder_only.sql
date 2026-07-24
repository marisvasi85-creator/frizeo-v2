-- Pricing: Pro 79 / Pro+ 199
-- SMS policy: standard plans keep reminder SMS only; disable extended SMS
-- flags for non-Custom tenants (confirm / cancel / reschedule).
-- Run in Supabase SQL Editor (shared staging/prod project).

BEGIN;

UPDATE public.plans
SET name = 'Pro', price = 79, max_barbers = 1, max_bookings_per_month = NULL
WHERE slug = 'pro';

UPDATE public.plans
SET name = 'Pro+', price = 199, max_barbers = 3, max_bookings_per_month = NULL
WHERE slug = 'pro-plus';

-- Turn off expensive SMS types for everyone not on Custom.
UPDATE public.notification_settings ns
SET
  booking_sms_enabled = false,
  reschedule_sms_enabled = false,
  cancel_sms_enabled = false
WHERE NOT EXISTS (
  SELECT 1
  FROM public.subscriptions s
  JOIN public.plans p ON p.id = s.plan_id
  WHERE s.tenant_id = ns.tenant_id
    AND p.slug = 'custom'
);

COMMIT;
