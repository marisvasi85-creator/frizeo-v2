-- Accept the documented photo publish id prefix. Does not update existing jobs.

alter table public.integration_publish_jobs
  drop constraint if exists integration_publish_jobs_provider_ids;

alter table public.integration_publish_jobs
  add constraint integration_publish_jobs_provider_ids check (
    (
      provider_post_id is null
      or provider_post_id ~ '^[0-9]{1,32}(_[0-9]{1,32})?$'
      or provider_post_id ~ '^accounts/[0-9]{1,30}/locations/[0-9]{1,30}/localPosts/[A-Za-z0-9_-]{1,128}$'
      or provider_post_id ~ '^[vp]_[A-Za-z0-9][A-Za-z0-9._~-]{7,160}$'
    )
    and (provider_container_id is null or provider_container_id ~ '^[0-9]{1,32}$')
  );

alter table public.integration_publish_jobs
  drop constraint if exists integration_publish_jobs_published_post;

alter table public.integration_publish_jobs
  add constraint integration_publish_jobs_published_post check (
    status <> 'published'
    or (
      provider_post_id is not null
      and (
        provider_post_id ~ '^[0-9]{1,32}(_[0-9]{1,32})?$'
        or provider_post_id ~ '^accounts/[0-9]{1,30}/locations/[0-9]{1,30}/localPosts/[A-Za-z0-9_-]{1,128}$'
        or provider_post_id ~ '^[vp]_[A-Za-z0-9][A-Za-z0-9._~-]{7,160}$'
      )
    )
  );

create or replace function public.tiktok_draft_settle(
  p_tenant_id uuid,
  p_job_id uuid,
  p_kind text,
  p_publish_id text,
  p_safe_error text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r public.integration_publish_jobs%rowtype;
begin
  if p_tenant_id is distinct from '5d9862a1-fd85-46f2-9c7e-635e813e067c'::uuid then
    return jsonb_build_object('outcome', 'forbidden_tenant');
  end if;

  select *
    into r
    from public.integration_publish_jobs
   where id = p_job_id
     and tenant_id = p_tenant_id
     and provider = 'tiktok'
   for update;

  if not found or r.status is distinct from 'initiating' or r.execution_mode is distinct from 'live' then
    return jsonb_build_object('outcome', 'rejected');
  end if;

  if p_kind = 'success' then
    if p_publish_id is null or p_publish_id !~ '^[vp]_[A-Za-z0-9][A-Za-z0-9._~-]{7,160}$' then
      return jsonb_build_object('outcome', 'rejected');
    end if;
    update public.integration_publish_jobs
       set status = 'pending',
           provider_post_id = p_publish_id,
           safe_error = null,
           updated_at = pg_catalog.now()
     where id = r.id
       and tenant_id = p_tenant_id
       and status = 'initiating';
    return jsonb_build_object('outcome', 'pending', 'publish_id', p_publish_id);
  end if;

  if p_kind = 'ambiguous' then
    update public.integration_publish_jobs
       set status = 'unknown',
           provider_post_id = null,
           safe_error = 'needs_reconcile',
           updated_at = pg_catalog.now()
     where id = r.id
       and tenant_id = p_tenant_id
       and status = 'initiating';
    return jsonb_build_object('outcome', 'needs_reconcile');
  end if;

  if p_kind = 'rejected'
     and p_safe_error ~ '^[a-z0-9_]{1,64}$' then
    update public.integration_publish_jobs
       set status = 'failed',
           provider_post_id = null,
           safe_error = p_safe_error,
           updated_at = pg_catalog.now()
     where id = r.id
       and tenant_id = p_tenant_id
       and status = 'initiating';
    return jsonb_build_object('outcome', 'failed');
  end if;

  return jsonb_build_object('outcome', 'rejected');
end;
$$;
