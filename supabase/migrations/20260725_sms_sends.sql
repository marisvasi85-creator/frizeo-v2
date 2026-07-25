-- SMS send log for Platform AI consumption reporting.
-- Access: service_role only (RLS on, no anon/authenticated policies).

CREATE TABLE IF NOT EXISTS public.sms_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  barber_id uuid REFERENCES public.barbers(id) ON DELETE SET NULL,
  sms_type text NOT NULL CHECK (
    sms_type IN ('booking', 'reminder', 'reschedule', 'cancel')
  ),
  phone text NOT NULL,
  ok boolean NOT NULL,
  provider text NOT NULL DEFAULT 'smso',
  provider_status int,
  provider_response jsonb,
  usage_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sms_sends_tenant_date_idx
  ON public.sms_sends (tenant_id, usage_date DESC);

CREATE INDEX IF NOT EXISTS sms_sends_tenant_type_date_idx
  ON public.sms_sends (tenant_id, sms_type, usage_date DESC);

CREATE INDEX IF NOT EXISTS sms_sends_usage_date_idx
  ON public.sms_sends (usage_date DESC);

COMMENT ON TABLE public.sms_sends IS
  'One row per SMS send attempt (Platform AI usage / ops).';

ALTER TABLE public.sms_sends ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.sms_sends FROM anon, authenticated;
GRANT ALL ON public.sms_sends TO service_role;
