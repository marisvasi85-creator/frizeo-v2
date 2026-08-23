-- Cover the composite foreign key used to validate tenant/barber ownership.
-- This keeps deletes and relationship checks efficient as the access list grows.
create index if not exists barber_client_access_barber_tenant_idx
  on public.barber_client_access (barber_id, tenant_id);
