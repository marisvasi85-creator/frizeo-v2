-- Draft DPA acceptance log. Recording a row does not approve the contract.
-- The application route stays off unless DPA_ACCEPTANCE_ENABLED is exactly true.

create table if not exists public.salon_dpa_acceptances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  document_version text not null,
  accepted_by uuid not null,
  accepted_at timestamptz not null default pg_catalog.now(),
  constraint salon_dpa_acceptances_version check (
    document_version = 'dpa-proiect-2026-11-15'
  ),
  constraint salon_dpa_acceptances_once unique (tenant_id, document_version)
);

alter table public.salon_dpa_acceptances enable row level security;

drop policy if exists salon_dpa_acceptances_select on public.salon_dpa_acceptances;
create policy salon_dpa_acceptances_select
  on public.salon_dpa_acceptances
  for select
  to authenticated
  using (
    tenant_id = public.get_current_tenant_id()
    and public.get_current_role() = 'owner'
  );

drop policy if exists salon_dpa_acceptances_insert on public.salon_dpa_acceptances;
create policy salon_dpa_acceptances_insert
  on public.salon_dpa_acceptances
  for insert
  to authenticated
  with check (
    tenant_id = public.get_current_tenant_id()
    and public.get_current_role() = 'owner'
    and accepted_by = auth.uid()
  );

revoke all on table public.salon_dpa_acceptances from public, anon;
grant select, insert on table public.salon_dpa_acceptances to authenticated;
grant select, insert, update, delete on table public.salon_dpa_acceptances to service_role;
