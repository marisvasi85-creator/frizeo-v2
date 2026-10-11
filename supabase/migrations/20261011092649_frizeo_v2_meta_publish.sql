-- Meta publishing state. Additive. Does not publish and does not enable
-- marketing.publish.meta.live. Applied migrations are not edited.
-- Asset inserts call json_contains_secret_key, so service_role needs EXECUTE.
-- The function body and the rejection trigger stay unchanged.

grant execute on function public.json_contains_secret_key(jsonb, text[]) to service_role;

alter table public.tenant_capabilities
  drop constraint if exists tenant_capabilities_known;

alter table public.tenant_capabilities
  add constraint tenant_capabilities_known check (
    capability in (
      'booking.core',
      'growth.recall',
      'growth.fill',
      'growth.analytics',
      'marketing.generate',
      'marketing.publish.meta',
      'marketing.publish.meta.live',
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
  );

alter table public.integration_assets
  add column if not exists media_object_path text;

alter table public.integration_assets
  drop constraint if exists integration_assets_media_path;

alter table public.integration_assets
  add constraint integration_assets_media_path check (
    media_object_path is null
    or media_object_path ~ (
      '^' || tenant_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]jpg$'
    )
  );

alter table public.integration_publish_jobs
  add column if not exists idempotency_key text,
  add column if not exists provider_container_id text,
  add column if not exists execution_mode text,
  add column if not exists safe_error text;

alter table public.integration_publish_jobs
  alter column execution_mode set default 'mock';

update public.integration_publish_jobs
   set execution_mode = 'mock'
 where execution_mode is null;

alter table public.integration_publish_jobs
  alter column execution_mode set not null;

alter table public.integration_publish_jobs
  drop constraint if exists integration_publish_jobs_status;

alter table public.integration_publish_jobs
  add constraint integration_publish_jobs_status check (
    status in (
      'draft',
      'pending',
      'publishing',
      'published',
      'failed',
      'cancelled',
      'unknown'
    )
  );

alter table public.integration_publish_jobs
  drop constraint if exists integration_publish_jobs_execution_mode;

alter table public.integration_publish_jobs
  add constraint integration_publish_jobs_execution_mode check (
    execution_mode in ('mock', 'live')
  );

alter table public.integration_publish_jobs
  drop constraint if exists integration_publish_jobs_mode_status;

alter table public.integration_publish_jobs
  add constraint integration_publish_jobs_mode_status check (
    (
      execution_mode = 'mock'
      and status = 'draft'
      and provider_post_id is null
      and provider_container_id is null
    )
    or (
      execution_mode = 'live'
      and status in (
        'pending',
        'publishing',
        'published',
        'failed',
        'cancelled',
        'unknown'
      )
    )
  );

alter table public.integration_publish_jobs
  drop constraint if exists integration_publish_jobs_published_post;

alter table public.integration_publish_jobs
  add constraint integration_publish_jobs_published_post check (
    status <> 'published'
    or (
      provider_post_id is not null
      and provider_post_id ~ '^[0-9]{1,32}(_[0-9]{1,32})?$'
    )
  );

alter table public.integration_publish_jobs
  drop constraint if exists integration_publish_jobs_idempotency_key;

alter table public.integration_publish_jobs
  add constraint integration_publish_jobs_idempotency_key check (
    idempotency_key is null
    or idempotency_key ~ '^[A-Za-z0-9_-]{16,80}$'
  );

alter table public.integration_publish_jobs
  drop constraint if exists integration_publish_jobs_safe_error;

alter table public.integration_publish_jobs
  add constraint integration_publish_jobs_safe_error check (
    safe_error is null
    or safe_error ~ '^[a-z0-9_]{1,64}$'
  );

alter table public.integration_publish_jobs
  drop constraint if exists integration_publish_jobs_provider_ids;

alter table public.integration_publish_jobs
  add constraint integration_publish_jobs_provider_ids check (
    (provider_post_id is null or provider_post_id ~ '^[0-9]{1,32}(_[0-9]{1,32})?$')
    and (provider_container_id is null or provider_container_id ~ '^[0-9]{1,32}$')
  );

create unique index if not exists integration_publish_jobs_idempotency_uidx
  on public.integration_publish_jobs (tenant_id, idempotency_key, destination_id)
  where idempotency_key is not null;

-- Private bucket for images Meta may fetch through a signed URL.
-- Existing salon buckets are not updated.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marketing-publish',
  'marketing-publish',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create or replace function public.meta_publish_public_job(p_job_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', j.id,
    'campaign_id', j.campaign_id,
    'asset_id', j.asset_id,
    'destination_id', j.destination_id,
    'destination_type', d.destination_type,
    'display_name', d.display_name,
    'provider_destination_id', d.provider_destination_id,
    'status', j.status,
    'execution_mode', j.execution_mode,
    'attempts', j.attempts,
    'provider_post_id', j.provider_post_id,
    'provider_container_id', j.provider_container_id,
    'safe_error', j.safe_error,
    'idempotency_key', j.idempotency_key,
    'caption', a.body,
    'media_object_path', a.media_object_path
  )
  from public.integration_publish_jobs j
  join public.marketing_destinations d
    on d.id = j.destination_id
   and d.tenant_id = j.tenant_id
  join public.integration_assets a
    on a.id = j.asset_id
   and a.tenant_id = j.tenant_id
  where j.id = p_job_id;
$$;

create or replace function public.meta_publish_prepare(
  p_tenant_id uuid,
  p_created_by uuid,
  p_idempotency_key text,
  p_caption text,
  p_media_object_path text,
  p_destination_ids uuid[],
  p_execution_mode text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
  v_types integer;
  v_existing integer;
  v_campaign uuid;
  v_asset uuid;
  v_jobs jsonb;
begin
  if p_tenant_id is null or p_created_by is null then
    return jsonb_build_object('outcome', 'invalid');
  end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9_-]{16,80}$' then
    return jsonb_build_object('outcome', 'invalid');
  end if;
  if p_caption is null or length(p_caption) > 2200 or position(chr(0) in p_caption) > 0 then
    return jsonb_build_object('outcome', 'invalid');
  end if;
  if p_execution_mode is distinct from 'mock' and p_execution_mode is distinct from 'live' then
    return jsonb_build_object('outcome', 'invalid');
  end if;
  if p_media_object_path is null
     or p_media_object_path !~ (
       '^' || p_tenant_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]jpg$'
     ) then
    return jsonb_build_object('outcome', 'invalid');
  end if;
  if p_destination_ids is null
     or cardinality(p_destination_ids) < 1
     or cardinality(p_destination_ids) > 2
     or (
       select count(distinct destination_id)
         from unnest(p_destination_ids) as ids(destination_id)
     ) <> cardinality(p_destination_ids) then
    return jsonb_build_object('outcome', 'invalid');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text || ':publish:' || p_idempotency_key, 42)
  );

  select count(*)
    into v_count
    from public.marketing_destinations d
   where d.tenant_id = p_tenant_id
     and d.id = any (p_destination_ids)
     and d.provider = 'meta'
     and d.status = 'active'
     and d.destination_type in ('facebook_page', 'instagram_business');

  if v_count <> cardinality(p_destination_ids) then
    return jsonb_build_object('outcome', 'destination_mismatch');
  end if;

  select count(distinct d.destination_type)
    into v_types
    from public.marketing_destinations d
   where d.tenant_id = p_tenant_id
     and d.id = any (p_destination_ids);

  if v_types <> v_count then
    return jsonb_build_object('outcome', 'invalid');
  end if;

  select count(*)
    into v_existing
    from public.integration_publish_jobs
   where tenant_id = p_tenant_id
     and idempotency_key = p_idempotency_key;

  if v_existing > 0 then
    if exists (
      select 1
        from public.integration_publish_jobs j
        join public.integration_assets a
          on a.id = j.asset_id
         and a.tenant_id = j.tenant_id
       where j.tenant_id = p_tenant_id
         and j.idempotency_key = p_idempotency_key
         and (
           j.execution_mode is distinct from p_execution_mode
           or a.body is distinct from p_caption
           or a.media_object_path is distinct from p_media_object_path
         )
    ) or exists (
      select 1
        from (
          select coalesce(array_agg(destination_id order by destination_id), '{}') as ids
            from public.integration_publish_jobs
           where tenant_id = p_tenant_id
             and idempotency_key = p_idempotency_key
        ) existing
        cross join (
          select coalesce(array_agg(destination_id order by destination_id), '{}') as ids
            from unnest(p_destination_ids) as requested_ids(destination_id)
        ) requested
       where existing.ids is distinct from requested.ids
    ) then
      return jsonb_build_object('outcome', 'idempotency_conflict');
    end if;

    select coalesce(jsonb_agg(public.meta_publish_public_job(j.id) order by j.created_at), '[]'::jsonb)
      into v_jobs
      from public.integration_publish_jobs j
     where j.tenant_id = p_tenant_id
       and j.idempotency_key = p_idempotency_key;

    return jsonb_build_object('outcome', 'replay', 'jobs', v_jobs);
  end if;

  insert into public.integration_campaigns (
    tenant_id,
    type,
    title,
    status,
    created_by
  ) values (
    p_tenant_id,
    'normal',
    case
      when length(btrim(p_caption)) = 0 then 'Publicare Meta'
      else left(btrim(p_caption), 120)
    end,
    'draft',
    p_created_by
  )
  returning id into v_campaign;

  insert into public.integration_assets (
    campaign_id,
    tenant_id,
    kind,
    format,
    channel,
    body,
    media_object_path,
    tracking,
    utm
  ) values (
    v_campaign,
    p_tenant_id,
    'image',
    'jpeg',
    'meta',
    p_caption,
    p_media_object_path,
    '{}'::jsonb,
    '{}'::jsonb
  )
  returning id into v_asset;

  insert into public.integration_publish_jobs (
    campaign_id,
    asset_id,
    tenant_id,
    provider,
    destination_id,
    status,
    idempotency_key,
    execution_mode,
    attempts
  )
  select
    v_campaign,
    v_asset,
    p_tenant_id,
    'meta',
    d.id,
    case when p_execution_mode = 'live' then 'pending' else 'draft' end,
    p_idempotency_key,
    p_execution_mode,
    0
  from public.marketing_destinations d
  where d.tenant_id = p_tenant_id
    and d.id = any (p_destination_ids);

  select coalesce(jsonb_agg(public.meta_publish_public_job(j.id) order by j.created_at), '[]'::jsonb)
    into v_jobs
    from public.integration_publish_jobs j
   where j.tenant_id = p_tenant_id
     and j.asset_id = v_asset;

  return jsonb_build_object('outcome', 'created', 'jobs', v_jobs);
end;
$$;

create or replace function public.meta_publish_claim(
  p_tenant_id uuid,
  p_job_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r public.integration_publish_jobs%rowtype;
begin
  select *
    into r
    from public.integration_publish_jobs
   where id = p_job_id
     and tenant_id = p_tenant_id
   for update;

  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  if r.execution_mode is distinct from 'live' or r.status is distinct from 'pending' or r.attempts <> 0 then
    return jsonb_build_object(
      'outcome', 'held',
      'job', public.meta_publish_public_job(r.id)
    );
  end if;

  update public.integration_publish_jobs
     set status = 'publishing',
         attempts = attempts + 1,
         updated_at = pg_catalog.now()
   where id = r.id
     and tenant_id = p_tenant_id
     and status = 'pending'
     and execution_mode = 'live'
     and attempts = 0;

  if not found then
    return jsonb_build_object(
      'outcome', 'held',
      'job', public.meta_publish_public_job(r.id)
    );
  end if;

  return jsonb_build_object(
    'outcome', 'claimed',
    'job', public.meta_publish_public_job(r.id)
  );
end;
$$;

create or replace function public.meta_publish_settle(
  p_tenant_id uuid,
  p_job_id uuid,
  p_status text,
  p_provider_post_id text,
  p_provider_container_id text,
  p_safe_error text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r public.integration_publish_jobs%rowtype;
  v_post text := nullif(btrim(coalesce(p_provider_post_id, '')), '');
  v_container text := nullif(btrim(coalesce(p_provider_container_id, '')), '');
  v_error text := nullif(btrim(coalesce(p_safe_error, '')), '');
  v_allowed boolean := false;
begin
  if v_post is not null and v_post !~ '^[0-9]{1,32}(_[0-9]{1,32})?$' then
    return jsonb_build_object('outcome', 'invalid');
  end if;
  if v_container is not null and v_container !~ '^[0-9]{1,32}$' then
    return jsonb_build_object('outcome', 'invalid');
  end if;
  if v_error is not null and v_error !~ '^[a-z0-9_]{1,64}$' then
    return jsonb_build_object('outcome', 'invalid');
  end if;

  select *
    into r
    from public.integration_publish_jobs
   where id = p_job_id
     and tenant_id = p_tenant_id
   for update;

  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  if r.execution_mode is distinct from 'live' then
    return jsonb_build_object('outcome', 'rejected', 'job', public.meta_publish_public_job(r.id));
  end if;

  if r.provider_container_id is not null
     and v_container is not null
     and v_container is distinct from r.provider_container_id then
    return jsonb_build_object('outcome', 'rejected', 'job', public.meta_publish_public_job(r.id));
  end if;

  if r.status = 'publishing' and p_status = 'publishing' and v_post is null and v_container is not null and v_error is null then
    v_allowed := true;
  elsif r.status = 'publishing' and p_status = 'published' and v_post is not null and v_error is null then
    v_allowed := true;
  elsif r.status = 'publishing' and p_status = 'failed' and v_post is null and v_error in (
    'token_expired',
    'missing_permission',
    'missing_task',
    'invalid_parameter',
    'invalid_image',
    'timeout',
    'provider_error',
    'container_error',
    'container_expired'
  ) then
    v_allowed := true;
  elsif r.status = 'publishing' and p_status = 'unknown' and v_post is null and v_error in (
    'ambiguous',
    'already_published_unconfirmed',
    'awaiting_publish_confirmation'
  ) then
    v_allowed := true;
  elsif r.status = 'pending' and p_status = 'failed' and v_post is null and v_container is null and v_error in (
    'token_expired',
    'missing_permission',
    'missing_task',
    'invalid_parameter',
    'invalid_image',
    'timeout'
  ) then
    v_allowed := true;
  elsif r.status = 'unknown' and p_status = 'published' and v_post is not null and v_error is null then
    v_allowed := true;
  elsif r.status = 'unknown' and p_status = 'failed' and v_post is null and v_error in (
    'container_error',
    'container_expired',
    'provider_error'
  ) then
    v_allowed := true;
  end if;

  if not v_allowed then
    return jsonb_build_object('outcome', 'rejected', 'job', public.meta_publish_public_job(r.id));
  end if;

  update public.integration_publish_jobs
     set status = p_status,
         provider_post_id = case when p_status = 'published' then v_post else provider_post_id end,
         provider_container_id = coalesce(v_container, provider_container_id),
         safe_error = case when p_status = 'published' then null else v_error end,
         published_at = case
           when p_status = 'published' then pg_catalog.now()
           else published_at
         end,
         updated_at = pg_catalog.now()
   where id = r.id
     and tenant_id = p_tenant_id;

  return jsonb_build_object('outcome', 'updated', 'job', public.meta_publish_public_job(r.id));
end;
$$;

create or replace function public.meta_publish_list(p_tenant_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(public.meta_publish_public_job(j.id) order by j.created_at desc), '[]'::jsonb)
    from (
      select id, created_at
        from public.integration_publish_jobs
       where tenant_id = p_tenant_id
       order by created_at desc
       limit 40
    ) j;
$$;

create or replace function public.meta_publish_media_eligible(
  p_tenant_id uuid,
  p_asset_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
      from public.integration_assets a
     where a.id = p_asset_id
       and a.tenant_id = p_tenant_id
       and a.media_object_path is not null
  )
  and not exists (
    select 1
      from public.integration_publish_jobs j
     where j.asset_id = p_asset_id
       and j.tenant_id = p_tenant_id
       and j.status in ('pending', 'publishing', 'unknown')
  )
  and exists (
    select 1
      from public.integration_publish_jobs j
     where j.asset_id = p_asset_id
       and j.tenant_id = p_tenant_id
  );
$$;

create or replace function public.meta_publish_media_candidate(
  p_tenant_id uuid,
  p_asset_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_path text;
begin
  if not public.meta_publish_media_eligible(p_tenant_id, p_asset_id) then
    return jsonb_build_object('eligible', false);
  end if;

  select media_object_path
    into v_path
    from public.integration_assets
   where id = p_asset_id
     and tenant_id = p_tenant_id
   for update;

  if v_path is null then
    return jsonb_build_object('eligible', false);
  end if;

  return jsonb_build_object('eligible', true, 'media_object_path', v_path);
end;
$$;

create or replace function public.meta_publish_media_clear(
  p_tenant_id uuid,
  p_asset_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_path text;
begin
  select media_object_path
    into v_path
    from public.integration_assets
   where id = p_asset_id
     and tenant_id = p_tenant_id
   for update;

  if not found or v_path is null or not public.meta_publish_media_eligible(p_tenant_id, p_asset_id) then
    return jsonb_build_object('cleared', false);
  end if;

  update public.integration_assets
     set media_object_path = null,
         updated_at = pg_catalog.now()
   where id = p_asset_id
     and tenant_id = p_tenant_id;

  return jsonb_build_object('cleared', true, 'media_object_path', v_path);
end;
$$;

revoke all on function public.meta_publish_public_job(uuid) from public, anon, authenticated;
revoke all on function public.meta_publish_prepare(uuid, uuid, text, text, text, uuid[], text) from public, anon, authenticated;
revoke all on function public.meta_publish_claim(uuid, uuid) from public, anon, authenticated;
revoke all on function public.meta_publish_settle(uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.meta_publish_list(uuid) from public, anon, authenticated;
revoke all on function public.meta_publish_media_eligible(uuid, uuid) from public, anon, authenticated;
revoke all on function public.meta_publish_media_candidate(uuid, uuid) from public, anon, authenticated;
revoke all on function public.meta_publish_media_clear(uuid, uuid) from public, anon, authenticated;

grant execute on function public.meta_publish_public_job(uuid) to service_role;
grant execute on function public.meta_publish_prepare(uuid, uuid, text, text, text, uuid[], text) to service_role;
grant execute on function public.meta_publish_claim(uuid, uuid) to service_role;
grant execute on function public.meta_publish_settle(uuid, uuid, text, text, text, text) to service_role;
grant execute on function public.meta_publish_list(uuid) to service_role;
grant execute on function public.meta_publish_media_eligible(uuid, uuid) to service_role;
grant execute on function public.meta_publish_media_candidate(uuid, uuid) to service_role;
grant execute on function public.meta_publish_media_clear(uuid, uuid) to service_role;
