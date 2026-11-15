-- Identity recorded with an electronic acceptance. Older rows stay unchanged.

alter table public.salon_dpa_acceptances
  add column if not exists salon_legal_name text,
  add column if not exists salon_cui text,
  add column if not exists salon_address text,
  add column if not exists representative_name text,
  add column if not exists representative_confirmed boolean,
  add column if not exists acceptance_method text;

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
    or (
      document_version = 'dpa-2026-11-15'
      and document_hash ~ '^[0-9a-f]{64}$'
      and length(btrim(salon_legal_name)) >= 2
      and length(btrim(salon_cui)) >= 2
      and length(btrim(salon_address)) >= 5
      and length(btrim(representative_name)) >= 2
      and representative_confirmed is true
      and acceptance_method = 'electronic_dashboard'
    )
  );
