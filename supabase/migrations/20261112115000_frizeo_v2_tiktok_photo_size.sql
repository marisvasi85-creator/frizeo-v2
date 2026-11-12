-- TikTok failures must not keep a destination locked.
-- Meta and Google keep the shared open-destination lock, including unknown.
-- A TikTok publish id is kept when the pending update conflicts, and a later
-- status reconcile cannot clear it. This records the known staging failure
-- and does not upload anything.

drop index if exists public.integration_publish_jobs_live_open_destination_uidx;

create unique index integration_publish_jobs_live_open_destination_uidx
  on public.integration_publish_jobs (tenant_id, destination_id)
  where execution_mode = 'live'
    and status in ('pending', 'publishing', 'unknown')
    and provider <> 'tiktok';

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
  v_publish text;
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

  v_publish := case
    when r.provider_post_id is not null then r.provider_post_id
    when p_publish_id ~ '^[vp]_[A-Za-z0-9][A-Za-z0-9._~-]{7,160}$' then p_publish_id
    else null
  end;

  if p_kind = 'success' then
    if v_publish is null then
      return jsonb_build_object('outcome', 'rejected');
    end if;
    begin
      update public.integration_publish_jobs
         set status = 'pending',
             provider_post_id = v_publish,
             safe_error = null,
             updated_at = pg_catalog.now()
       where id = r.id
         and tenant_id = p_tenant_id
         and status = 'initiating';
    exception
      when unique_violation then
        update public.integration_publish_jobs
           set provider_post_id = v_publish,
               updated_at = pg_catalog.now()
         where id = r.id
           and tenant_id = p_tenant_id
           and status = 'initiating';
        return jsonb_build_object('outcome', 'publish_saved', 'publish_id', v_publish);
    end;
    return jsonb_build_object('outcome', 'pending', 'publish_id', v_publish);
  end if;

  if p_kind = 'ambiguous' then
    update public.integration_publish_jobs
       set status = 'unknown',
           provider_post_id = v_publish,
           safe_error = 'needs_reconcile',
           updated_at = pg_catalog.now()
     where id = r.id
       and tenant_id = p_tenant_id
       and status = 'initiating';
    return jsonb_build_object('outcome', 'needs_reconcile', 'publish_id', v_publish);
  end if;

  if p_kind = 'rejected'
     and p_safe_error ~ '^[a-z0-9_]{1,64}$' then
    update public.integration_publish_jobs
       set status = 'failed',
           provider_post_id = v_publish,
           safe_error = p_safe_error,
           updated_at = pg_catalog.now()
     where id = r.id
       and tenant_id = p_tenant_id
       and status = 'initiating';
    return jsonb_build_object('outcome', 'failed', 'publish_id', v_publish);
  end if;

  return jsonb_build_object('outcome', 'rejected');
end;
$$;

create or replace function public.tiktok_draft_reconcile(
  p_tenant_id uuid,
  p_job_id uuid,
  p_publish_id text,
  p_status text,
  p_safe_error text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r public.integration_publish_jobs%rowtype;
  v_error text;
begin
  if p_tenant_id is distinct from '5d9862a1-fd85-46f2-9c7e-635e813e067c'::uuid then
    return jsonb_build_object('outcome', 'forbidden_tenant');
  end if;
  if p_publish_id is null or p_publish_id !~ '^[vp]_[A-Za-z0-9][A-Za-z0-9._~-]{7,160}$' then
    return jsonb_build_object('outcome', 'rejected');
  end if;
  if p_status not in ('failed', 'pending', 'published') then
    return jsonb_build_object('outcome', 'rejected');
  end if;

  v_error := case
    when p_status = 'failed' and p_safe_error ~ '^[a-z0-9_]{1,64}$' then p_safe_error
    else null
  end;
  if p_status = 'failed' and v_error is null then
    return jsonb_build_object('outcome', 'rejected');
  end if;

  select *
    into r
    from public.integration_publish_jobs
   where id = p_job_id
     and tenant_id = p_tenant_id
     and provider = 'tiktok'
     and execution_mode = 'live'
   for update;

  if not found or r.status not in ('initiating', 'pending', 'publishing', 'unknown', 'failed', 'published') then
    return jsonb_build_object('outcome', 'not_found');
  end if;
  if r.provider_post_id is not null and r.provider_post_id is distinct from p_publish_id then
    return jsonb_build_object('outcome', 'rejected');
  end if;
  if r.status = 'failed' and p_status is distinct from 'failed' then
    return jsonb_build_object('outcome', 'rejected');
  end if;
  if r.status = 'published' and p_status is distinct from 'published' then
    return jsonb_build_object('outcome', 'rejected');
  end if;
  if r.status = p_status
     and r.provider_post_id is not distinct from p_publish_id
     and r.safe_error is not distinct from v_error then
    return jsonb_build_object('outcome', 'unchanged', 'publish_id', p_publish_id);
  end if;

  update public.integration_publish_jobs
     set status = p_status,
         provider_post_id = p_publish_id,
         safe_error = v_error,
         updated_at = pg_catalog.now()
   where id = r.id
     and tenant_id = p_tenant_id;

  return jsonb_build_object('outcome', 'saved', 'publish_id', p_publish_id, 'status', p_status);
end;
$$;

revoke all on function public.tiktok_draft_reconcile(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.tiktok_draft_reconcile(uuid, uuid, text, text, text) to service_role;

select public.tiktok_draft_reconcile(
  '5d9862a1-fd85-46f2-9c7e-635e813e067c'::uuid,
  'b973614b-d043-4c70-8d24-8f84575b9b21'::uuid,
  'p_inbox_url~v2.7707199245161351190',
  'failed',
  'picture_size_check_failed'
);
