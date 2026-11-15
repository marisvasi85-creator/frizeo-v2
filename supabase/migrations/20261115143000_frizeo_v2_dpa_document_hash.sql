-- Proof of a later draft. Existing rows, if any, stay tied to the old version
-- and are not treated as acceptance of this text.

alter table public.salon_dpa_acceptances
  add column if not exists document_hash text;

alter table public.salon_dpa_acceptances
  drop constraint if exists salon_dpa_acceptances_version;

alter table public.salon_dpa_acceptances
  add constraint salon_dpa_acceptances_version check (
    (
      document_version = 'dpa-proiect-2026-11-15'
      and document_hash is null
    )
    or (
      document_version = 'dpa-proiect-2026-11-15-915'
      and document_hash ~ '^[0-9a-f]{64}$'
    )
  );
