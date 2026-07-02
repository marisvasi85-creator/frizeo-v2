-- Facturi fiscale FGO emise pentru plăți Stripe (abonamente)
CREATE TABLE IF NOT EXISTS public.tenant_fiscal_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  stripe_invoice_id text NOT NULL UNIQUE,
  amount_ron numeric(12, 2) NOT NULL,
  status text NOT NULL CHECK (status IN ('issued', 'failed')),
  fgo_serie text,
  fgo_numar text,
  fgo_pdf_url text,
  error_message text,
  issued_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenant_fiscal_invoices_tenant_id_idx
  ON public.tenant_fiscal_invoices (tenant_id, created_at DESC);

COMMENT ON TABLE public.tenant_fiscal_invoices IS 'Facturi fiscale emise via FGO la invoice.paid Stripe';

ALTER TABLE public.tenant_fiscal_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_fiscal_invoices_owner_read"
ON public.tenant_fiscal_invoices
FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tu.tenant_id
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
      AND tu.role = 'owner'
  )
);
