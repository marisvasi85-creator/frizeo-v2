-- Cover the audit-user foreign keys added by the safe-delete migration.
create index if not exists marketing_campaigns_deleted_by_idx
  on public.marketing_campaigns (deleted_by)
  where deleted_by is not null;

create index if not exists marketing_contacts_deleted_by_idx
  on public.marketing_contacts (deleted_by)
  where deleted_by is not null;
