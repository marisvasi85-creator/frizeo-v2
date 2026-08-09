-- Follow-up from Supabase performance advisor: cover Phase 2 auth.user FKs.

CREATE INDEX IF NOT EXISTS marketing_email_templates_created_by_idx
  ON public.marketing_email_templates (created_by)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS marketing_campaigns_created_by_idx
  ON public.marketing_campaigns (created_by)
  WHERE created_by IS NOT NULL;
