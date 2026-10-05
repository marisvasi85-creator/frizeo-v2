-- Frizeo 2.0 integration foundation.
-- Additive only. Does not alter bookings, Marketing AI, Google Calendar,
-- Stripe, billing, or account deletion.

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

-- ---------------------------------------------------------------------------
-- Capabilities. Missing row means OFF. Commercial plans are not wired here.
-- ---------------------------------------------------------------------------

create table if not exists public.tenant_capabilities (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  capability text not null,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, capability),
  constraint tenant_capabilities_known check (
    capability in (
      'booking.core',
      'growth.recall',
      'growth.fill',
      'growth.analytics',
      'marketing.generate',
      'marketing.publish.meta',
      'marketing.publish.google_business',
      'marketing.publish.tiktok',
      'marketing.publish.whatsapp',
      'marketing.attribution',
      'studio.hair_preview',
      'studio.recreate',
      'studio.mirror',
      'studio.before_after',
      'studio.portfolio'
    )
  )
);

-- ---------------------------------------------------------------------------
-- Connections. Tokens never live in this table.
-- ---------------------------------------------------------------------------

create table if not exists public.marketing_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null,
  provider_account_id text,
  display_name text,
  status text not null default 'not_connected',
  scopes text[] not null default '{}',
  connected_by uuid,
  connected_at timestamptz,
  token_expires_at timestamptz,
  last_refresh_at timestamptz,
  last_validated_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_connections_provider check (
    provider in ('meta', 'google_business', 'tiktok', 'whatsapp')
  ),
  constraint marketing_connections_status check (
    status in (
      'not_connected',
      'connected',
      'needs_reconnect',
      'error',
      'setup_required'
    )
  )
);

create unique index if not exists marketing_connections_provider_account_uidx
  on public.marketing_connections (tenant_id, provider, provider_account_id)
  where provider_account_id is not null;

create index if not exists marketing_connections_tenant_provider_idx
  on public.marketing_connections (tenant_id, provider);

create table if not exists private.marketing_connection_secrets (
  connection_id uuid primary key
    references public.marketing_connections(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  ciphertext bytea not null,
  nonce bytea not null,
  key_version smallint not null default 1,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Destinations
-- ---------------------------------------------------------------------------

create table if not exists public.marketing_destinations (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null
    references public.marketing_connections(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null,
  destination_type text not null,
  provider_destination_id text not null,
  display_name text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_destinations_provider check (
    provider in ('meta', 'google_business', 'tiktok', 'whatsapp')
  ),
  constraint marketing_destinations_type check (
    destination_type in (
      'facebook_page',
      'instagram_business',
      'google_business_location',
      'tiktok_account',
      'whatsapp_number'
    )
  ),
  constraint marketing_destinations_status check (
    status in ('active', 'disabled', 'error')
  ),
  unique (tenant_id, provider, provider_destination_id)
);

create index if not exists marketing_destinations_connection_idx
  on public.marketing_destinations (connection_id);

create index if not exists marketing_destinations_tenant_idx
  on public.marketing_destinations (tenant_id, provider);

-- ---------------------------------------------------------------------------
-- Campaigns and assets. No generation in this milestone.
-- ---------------------------------------------------------------------------

create table if not exists public.integration_campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  barber_id uuid references public.barbers(id) on delete set null,
  type text not null,
  title text not null,
  status text not null default 'draft',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_campaigns_type check (
    type in ('normal', 'fill', 'recall', 'service', 'portfolio', 'seasonal')
  ),
  constraint integration_campaigns_status check (
    status in ('draft', 'active', 'archived')
  )
);

create index if not exists integration_campaigns_tenant_created_idx
  on public.integration_campaigns (tenant_id, created_at desc);

create index if not exists integration_campaigns_barber_idx
  on public.integration_campaigns (barber_id)
  where barber_id is not null;

create table if not exists public.integration_assets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null
    references public.integration_campaigns(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind text not null,
  format text,
  channel text,
  variant text,
  body text,
  tracking jsonb not null default '{}'::jsonb,
  utm jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_assets_kind check (
    kind in ('caption', 'image', 'story', 'video', 'cta', 'booking_url')
  )
);

create index if not exists integration_assets_campaign_idx
  on public.integration_assets (campaign_id);

create index if not exists integration_assets_tenant_idx
  on public.integration_assets (tenant_id, campaign_id);

-- ---------------------------------------------------------------------------
-- Publish jobs. No worker and no cron.
-- ---------------------------------------------------------------------------

create table if not exists public.integration_publish_jobs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null
    references public.integration_campaigns(id) on delete cascade,
  asset_id uuid not null
    references public.integration_assets(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null,
  destination_id uuid not null
    references public.marketing_destinations(id) on delete cascade,
  status text not null default 'draft',
  scheduled_for timestamptz,
  published_at timestamptz,
  provider_post_id text,
  provider_url text,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_publish_jobs_provider check (
    provider in ('meta', 'google_business', 'tiktok', 'whatsapp')
  ),
  constraint integration_publish_jobs_status check (
    status in (
      'draft',
      'pending',
      'publishing',
      'published',
      'failed',
      'cancelled'
    )
  ),
  constraint integration_publish_jobs_attempts check (attempts >= 0)
);

create index if not exists integration_publish_jobs_tenant_status_idx
  on public.integration_publish_jobs (tenant_id, status, created_at desc);

create index if not exists integration_publish_jobs_destination_idx
  on public.integration_publish_jobs (destination_id);

-- ---------------------------------------------------------------------------
-- OAuth state lives in private. The callback must reload tenant from this row.
-- ---------------------------------------------------------------------------

create table if not exists private.integration_oauth_states (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null,
  provider text not null,
  state_hash text not null unique,
  pkce_ciphertext bytea,
  pkce_nonce bytea,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint integration_oauth_states_provider check (
    provider in ('meta', 'google_business', 'tiktok', 'whatsapp')
  )
);

create index if not exists integration_oauth_states_tenant_idx
  on private.integration_oauth_states (tenant_id, expires_at);

-- ---------------------------------------------------------------------------
-- Webhook receipts. No raw payload.
-- ---------------------------------------------------------------------------

create table if not exists public.integration_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_event_id text not null,
  event_type text,
  tenant_id uuid references public.tenants(id) on delete set null,
  status text not null default 'received',
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error_safe text,
  constraint integration_webhook_events_provider check (
    provider in ('meta', 'google_business', 'tiktok', 'whatsapp')
  ),
  constraint integration_webhook_events_status check (
    status in ('received', 'processed', 'ignored', 'failed')
  ),
  unique (provider, external_event_id)
);

create index if not exists integration_webhook_events_tenant_idx
  on public.integration_webhook_events (tenant_id, received_at desc)
  where tenant_id is not null;

-- ---------------------------------------------------------------------------
-- Usage and credits. Append-only ledgers. No checkout.
-- ---------------------------------------------------------------------------

create table if not exists public.usage_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid,
  feature text not null,
  provider text not null,
  model text,
  units numeric not null default 0,
  input_tokens integer,
  output_tokens integer,
  credits_used integer not null default 0,
  estimated_cost_minor integer not null default 0,
  currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  constraint usage_ledger_units check (units >= 0),
  constraint usage_ledger_tokens check (
    (input_tokens is null or input_tokens >= 0)
    and (output_tokens is null or output_tokens >= 0)
  ),
  constraint usage_ledger_credits check (credits_used >= 0),
  constraint usage_ledger_cost check (estimated_cost_minor >= 0)
);

create index if not exists usage_ledger_tenant_created_idx
  on public.usage_ledger (tenant_id, created_at desc);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  entry_type text not null,
  amount integer not null,
  idempotency_key text not null,
  expires_at timestamptz,
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint credit_ledger_type check (
    entry_type in (
      'included_grant',
      'purchased_grant',
      'debit',
      'adjustment',
      'reversal'
    )
  ),
  constraint credit_ledger_amount_sign check (
    (
      entry_type in ('included_grant', 'purchased_grant', 'reversal')
      and amount > 0
    )
    or (entry_type = 'debit' and amount < 0)
    or (entry_type = 'adjustment' and amount <> 0)
  ),
  unique (tenant_id, idempotency_key)
);

create index if not exists credit_ledger_tenant_created_idx
  on public.credit_ledger (tenant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Integrity
-- ---------------------------------------------------------------------------

create or replace function public.reject_secret_json_keys()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  forbidden text[] := array[
    'access_token',
    'refresh_token',
    'client_secret',
    'token',
    'authorization',
    'code_verifier',
    'ciphertext',
    'pkce_verifier'
  ];
  blob jsonb;
begin
  if tg_table_name = 'marketing_destinations' then
    blob := new.metadata;
    if blob is not null and blob ?| forbidden then
      raise exception 'metadata contains a secret key';
    end if;
  elsif tg_table_name = 'integration_assets' then
    if new.tracking is not null and new.tracking ?| forbidden then
      raise exception 'tracking contains a secret key';
    end if;
    if new.utm is not null and new.utm ?| forbidden then
      raise exception 'utm contains a secret key';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_marketing_destination_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_tenant uuid;
  v_provider text;
begin
  select tenant_id, provider
    into v_tenant, v_provider
    from public.marketing_connections
   where id = new.connection_id;

  if v_tenant is null or v_tenant <> new.tenant_id or v_provider <> new.provider then
    raise exception 'destination tenant mismatch';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_marketing_asset_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant
    from public.integration_campaigns
   where id = new.campaign_id;

  if v_tenant is null or v_tenant <> new.tenant_id then
    raise exception 'asset tenant mismatch';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_marketing_publish_job_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_campaign_tenant uuid;
  v_asset_tenant uuid;
  v_destination_tenant uuid;
  v_destination_provider text;
begin
  select tenant_id into v_campaign_tenant
    from public.integration_campaigns
   where id = new.campaign_id;
  select tenant_id into v_asset_tenant
    from public.integration_assets
   where id = new.asset_id;
  select tenant_id, provider
    into v_destination_tenant, v_destination_provider
    from public.marketing_destinations
   where id = new.destination_id;

  if v_campaign_tenant is null
     or v_campaign_tenant <> new.tenant_id
     or v_asset_tenant is null
     or v_asset_tenant <> new.tenant_id
     or v_destination_tenant is null
     or v_destination_tenant <> new.tenant_id
     or v_destination_provider <> new.provider then
    raise exception 'publish job tenant mismatch';
  end if;
  return new;
end;
$$;

drop trigger if exists marketing_destinations_secrets on public.marketing_destinations;
create trigger marketing_destinations_secrets
  before insert or update on public.marketing_destinations
  for each row execute function public.reject_secret_json_keys();

drop trigger if exists integration_assets_secrets on public.integration_assets;
create trigger integration_assets_secrets
  before insert or update on public.integration_assets
  for each row execute function public.reject_secret_json_keys();

drop trigger if exists marketing_destinations_tenant on public.marketing_destinations;
create trigger marketing_destinations_tenant
  before insert or update on public.marketing_destinations
  for each row execute function public.enforce_marketing_destination_tenant();

drop trigger if exists integration_assets_tenant on public.integration_assets;
create trigger integration_assets_tenant
  before insert or update on public.integration_assets
  for each row execute function public.enforce_marketing_asset_tenant();

drop trigger if exists integration_publish_jobs_tenant on public.integration_publish_jobs;
create trigger integration_publish_jobs_tenant
  before insert or update on public.integration_publish_jobs
  for each row execute function public.enforce_marketing_publish_job_tenant();

drop trigger if exists tenant_capabilities_updated_at on public.tenant_capabilities;
create trigger tenant_capabilities_updated_at
  before update on public.tenant_capabilities
  for each row execute function public.set_updated_at();

drop trigger if exists marketing_connections_updated_at on public.marketing_connections;
create trigger marketing_connections_updated_at
  before update on public.marketing_connections
  for each row execute function public.set_updated_at();

drop trigger if exists marketing_destinations_updated_at on public.marketing_destinations;
create trigger marketing_destinations_updated_at
  before update on public.marketing_destinations
  for each row execute function public.set_updated_at();

drop trigger if exists integration_campaigns_updated_at on public.integration_campaigns;
create trigger integration_campaigns_updated_at
  before update on public.integration_campaigns
  for each row execute function public.set_updated_at();

drop trigger if exists integration_assets_updated_at on public.integration_assets;
create trigger integration_assets_updated_at
  before update on public.integration_assets
  for each row execute function public.set_updated_at();

drop trigger if exists integration_publish_jobs_updated_at on public.integration_publish_jobs;
create trigger integration_publish_jobs_updated_at
  before update on public.integration_publish_jobs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Credits. Service role only. Debits lock per tenant and are idempotent.
-- ---------------------------------------------------------------------------

create or replace function private.record_credit_ledger_entry(
  p_tenant_id uuid,
  p_entry_type text,
  p_amount integer,
  p_idempotency_key text,
  p_expires_at timestamptz,
  p_note text,
  p_created_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_entry_type = 'debit' then
    raise exception 'use apply_credit_debit';
  end if;

  insert into public.credit_ledger (
    tenant_id,
    entry_type,
    amount,
    idempotency_key,
    expires_at,
    note,
    created_by
  ) values (
    p_tenant_id,
    p_entry_type,
    p_amount,
    p_idempotency_key,
    p_expires_at,
    p_note,
    p_created_by
  )
  on conflict (tenant_id, idempotency_key) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id
      from public.credit_ledger
     where tenant_id = p_tenant_id
       and idempotency_key = p_idempotency_key;
  end if;

  return v_id;
end;
$$;

create or replace function private.apply_credit_debit(
  p_tenant_id uuid,
  p_amount integer,
  p_idempotency_key text,
  p_note text,
  p_created_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing uuid;
  v_balance integer;
  v_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'debit_amount_must_be_positive';
  end if;
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) = 0 then
    raise exception 'idempotency_key_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text, 42));

  select id into v_existing
    from public.credit_ledger
   where tenant_id = p_tenant_id
     and idempotency_key = p_idempotency_key;

  if v_existing is not null then
    return v_existing;
  end if;

  select coalesce(sum(amount), 0) into v_balance
    from public.credit_ledger
   where tenant_id = p_tenant_id
     and (expires_at is null or expires_at > now());

  if v_balance < p_amount then
    raise exception 'insufficient_credits';
  end if;

  insert into public.credit_ledger (
    tenant_id,
    entry_type,
    amount,
    idempotency_key,
    note,
    created_by
  ) values (
    p_tenant_id,
    'debit',
    -p_amount,
    p_idempotency_key,
    p_note,
    p_created_by
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.reject_secret_json_keys() from public, anon, authenticated;
revoke all on function public.enforce_marketing_destination_tenant() from public, anon, authenticated;
revoke all on function public.enforce_marketing_asset_tenant() from public, anon, authenticated;
revoke all on function public.enforce_marketing_publish_job_tenant() from public, anon, authenticated;
revoke all on function private.record_credit_ledger_entry(uuid, text, integer, text, timestamptz, text, uuid) from public, anon, authenticated;
revoke all on function private.apply_credit_debit(uuid, integer, text, text, uuid) from public, anon, authenticated;
grant execute on function private.record_credit_ledger_entry(uuid, text, integer, text, timestamptz, text, uuid) to service_role;
grant execute on function private.apply_credit_debit(uuid, integer, text, text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

alter table public.tenant_capabilities enable row level security;
alter table public.marketing_connections enable row level security;
alter table public.marketing_destinations enable row level security;
alter table public.integration_campaigns enable row level security;
alter table public.integration_assets enable row level security;
alter table public.integration_publish_jobs enable row level security;
alter table public.integration_webhook_events enable row level security;
alter table public.usage_ledger enable row level security;
alter table public.credit_ledger enable row level security;
alter table private.marketing_connection_secrets enable row level security;
alter table private.integration_oauth_states enable row level security;

revoke all on table public.tenant_capabilities from public, anon, authenticated;
revoke all on table public.marketing_connections from public, anon, authenticated;
revoke all on table public.marketing_destinations from public, anon, authenticated;
revoke all on table public.integration_campaigns from public, anon, authenticated;
revoke all on table public.integration_assets from public, anon, authenticated;
revoke all on table public.integration_publish_jobs from public, anon, authenticated;
revoke all on table public.integration_webhook_events from public, anon, authenticated;
revoke all on table public.usage_ledger from public, anon, authenticated;
revoke all on table public.credit_ledger from public, anon, authenticated;
revoke all on table private.marketing_connection_secrets from public, anon, authenticated;
revoke all on table private.integration_oauth_states from public, anon, authenticated;

grant select on table public.tenant_capabilities to authenticated;
grant select on table public.marketing_connections to authenticated;
grant select on table public.marketing_destinations to authenticated;
grant select on table public.integration_campaigns to authenticated;
grant select on table public.integration_assets to authenticated;
grant select on table public.integration_publish_jobs to authenticated;
grant select on table public.usage_ledger to authenticated;
grant select on table public.credit_ledger to authenticated;

grant select, insert, update, delete on table public.tenant_capabilities to service_role;
grant select, insert, update, delete on table public.marketing_connections to service_role;
grant select, insert, update, delete on table public.marketing_destinations to service_role;
grant select, insert, update, delete on table public.integration_campaigns to service_role;
grant select, insert, update, delete on table public.integration_assets to service_role;
grant select, insert, update, delete on table public.integration_publish_jobs to service_role;
grant select, insert, update, delete on table public.integration_webhook_events to service_role;
grant select, insert, update, delete on table public.usage_ledger to service_role;
grant select, insert, update, delete on table public.credit_ledger to service_role;
grant select, insert, update, delete on table private.marketing_connection_secrets to service_role;
grant select, insert, update, delete on table private.integration_oauth_states to service_role;

drop policy if exists tenant_capabilities_select on public.tenant_capabilities;
create policy tenant_capabilities_select
  on public.tenant_capabilities
  for select
  to authenticated
  using (
    tenant_id = public.get_current_tenant_id()
    and public.get_current_role() is not null
  );

drop policy if exists marketing_connections_select on public.marketing_connections;
create policy marketing_connections_select
  on public.marketing_connections
  for select
  to authenticated
  using (
    tenant_id = public.get_current_tenant_id()
    and public.get_current_role() = any (array['owner', 'manager'])
  );

drop policy if exists marketing_destinations_select on public.marketing_destinations;
create policy marketing_destinations_select
  on public.marketing_destinations
  for select
  to authenticated
  using (
    tenant_id = public.get_current_tenant_id()
    and public.get_current_role() = any (array['owner', 'manager'])
  );

drop policy if exists integration_campaigns_select on public.integration_campaigns;
create policy integration_campaigns_select
  on public.integration_campaigns
  for select
  to authenticated
  using (
    tenant_id = public.get_current_tenant_id()
    and public.get_current_role() = any (array['owner', 'manager'])
  );

drop policy if exists integration_assets_select on public.integration_assets;
create policy integration_assets_select
  on public.integration_assets
  for select
  to authenticated
  using (
    tenant_id = public.get_current_tenant_id()
    and public.get_current_role() = any (array['owner', 'manager'])
  );

drop policy if exists integration_publish_jobs_select on public.integration_publish_jobs;
create policy integration_publish_jobs_select
  on public.integration_publish_jobs
  for select
  to authenticated
  using (
    tenant_id = public.get_current_tenant_id()
    and public.get_current_role() = any (array['owner', 'manager'])
  );

drop policy if exists usage_ledger_select on public.usage_ledger;
create policy usage_ledger_select
  on public.usage_ledger
  for select
  to authenticated
  using (
    tenant_id = public.get_current_tenant_id()
    and public.get_current_role() = any (array['owner', 'manager'])
  );

drop policy if exists credit_ledger_select on public.credit_ledger;
create policy credit_ledger_select
  on public.credit_ledger
  for select
  to authenticated
  using (
    tenant_id = public.get_current_tenant_id()
    and public.get_current_role() = any (array['owner', 'manager'])
  );
