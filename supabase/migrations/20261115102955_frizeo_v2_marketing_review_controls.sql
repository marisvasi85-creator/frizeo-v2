-- Meta App Review removal and optional marketing retention.
-- Does not enable publishing and does not choose a retention period.

create or replace function public.meta_disconnect_provider_user(
  p_provider_user_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_removed integer := 0;
begin
  if p_provider_user_id is null or p_provider_user_id !~ '^[0-9]{1,32}$' then
    return jsonb_build_object('removed', 0);
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('meta-user:' || p_provider_user_id, 42)
  );

  delete from public.marketing_connections
   where provider = 'meta'
     and provider_account_id = p_provider_user_id;
  get diagnostics v_removed = row_count;

  return jsonb_build_object('removed', v_removed);
end;
$$;

create or replace function public.marketing_retention_candidates(
  p_days integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_days is null or p_days < 1 or p_days > 3650 then
    return jsonb_build_object('outcome', 'rejected', 'assets', '[]'::jsonb, 'orphans', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'outcome', 'ready',
    'assets', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'path', a.media_object_path))
        from public.integration_assets a
       where a.channel in ('meta', 'tiktok', 'google_business')
         and a.created_at < pg_catalog.now() - make_interval(days => p_days)
         and a.media_object_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]jpg$'
         and not exists (
           select 1
             from public.integration_publish_jobs j
            where j.asset_id = a.id
              and j.tenant_id = a.tenant_id
         )
         and not exists (
           select 1
             from public.marketing_connections c
            where c.tenant_id = a.tenant_id
              and c.status = 'connected'
              and c.provider = case a.channel
                when 'tiktok' then 'tiktok'
                when 'google_business' then 'google_business'
                else 'meta'
              end
         )
    ), '[]'::jsonb),
    'orphans', coalesce((
      select jsonb_agg(o.name)
        from storage.objects o
       where o.bucket_id = 'marketing-publish'
         and o.created_at < pg_catalog.now() - make_interval(days => p_days)
         and o.name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]jpg$'
         and not exists (
           select 1
             from public.integration_assets a
            where a.media_object_path = o.name
         )
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.marketing_retention_apply(
  p_days integer,
  p_asset_ids uuid[]
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_assets integer := 0;
  v_campaigns integer := 0;
begin
  if p_days is null or p_days < 1 or p_days > 3650 or p_asset_ids is null then
    return jsonb_build_object('outcome', 'rejected', 'assets', 0, 'campaigns', 0);
  end if;

  delete from public.integration_assets a
   where a.id = any (p_asset_ids)
     and a.channel in ('meta', 'tiktok', 'google_business')
     and a.created_at < pg_catalog.now() - make_interval(days => p_days)
     and not exists (
       select 1
         from public.integration_publish_jobs j
        where j.asset_id = a.id
          and j.tenant_id = a.tenant_id
     )
     and not exists (
       select 1
         from public.marketing_connections c
        where c.tenant_id = a.tenant_id
          and c.status = 'connected'
          and c.provider = case a.channel
            when 'tiktok' then 'tiktok'
            when 'google_business' then 'google_business'
            else 'meta'
          end
     );
  get diagnostics v_assets = row_count;

  delete from public.integration_campaigns c
   where c.created_at < pg_catalog.now() - make_interval(days => p_days)
     and not exists (
       select 1 from public.integration_assets a where a.campaign_id = c.id
     )
     and not exists (
       select 1 from public.integration_publish_jobs j where j.campaign_id = c.id
     );
  get diagnostics v_campaigns = row_count;

  return jsonb_build_object('outcome', 'applied', 'assets', v_assets, 'campaigns', v_campaigns);
end;
$$;

revoke all on function public.meta_disconnect_provider_user(text) from public, anon, authenticated;
revoke all on function public.marketing_retention_candidates(integer) from public, anon, authenticated;
revoke all on function public.marketing_retention_apply(integer, uuid[]) from public, anon, authenticated;

grant execute on function public.meta_disconnect_provider_user(text) to service_role;
grant execute on function public.marketing_retention_candidates(integer) to service_role;
grant execute on function public.marketing_retention_apply(integer, uuid[]) to service_role;
