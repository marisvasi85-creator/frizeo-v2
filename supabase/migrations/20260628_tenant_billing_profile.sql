-- Date facturare PF / PJ per salon (tenant)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS billing_type text
    CHECK (billing_type IS NULL OR billing_type IN ('individual', 'company')),
  ADD COLUMN IF NOT EXISTS billing_name text,
  ADD COLUMN IF NOT EXISTS billing_cui text,
  ADD COLUMN IF NOT EXISTS billing_reg_com text,
  ADD COLUMN IF NOT EXISTS billing_address_line1 text,
  ADD COLUMN IF NOT EXISTS billing_city text,
  ADD COLUMN IF NOT EXISTS billing_county text,
  ADD COLUMN IF NOT EXISTS billing_postal_code text,
  ADD COLUMN IF NOT EXISTS billing_country text DEFAULT 'RO';

COMMENT ON COLUMN public.tenants.billing_type IS 'individual = persoana fizica, company = persoana juridica';
COMMENT ON COLUMN public.tenants.billing_cui IS 'CUI/CIF fara prefix RO (doar PJ)';
