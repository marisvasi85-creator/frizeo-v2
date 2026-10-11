-- Lets an owner release one ambiguous live job without labeling it a confirmed
-- failure. safe_error stays ambiguous. The destination lock covers only
-- pending, publishing, and unknown, so released can be followed by one new attempt.

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
      'unknown',
      'released'
    )
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
        'unknown',
        'released'
      )
    )
  );

create or replace function public.meta_publish_release_ambiguous(
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

  if r.execution_mode is distinct from 'live'
     or r.status is distinct from 'unknown'
     or r.safe_error is distinct from 'ambiguous'
     or r.provider_post_id is not null then
    return jsonb_build_object('outcome', 'rejected', 'job', public.meta_publish_public_job(r.id));
  end if;

  update public.integration_publish_jobs
     set status = 'released',
         safe_error = 'ambiguous',
         updated_at = pg_catalog.now()
   where id = r.id
     and tenant_id = p_tenant_id;

  return jsonb_build_object(
    'outcome', 'released',
    'prior_container', r.provider_container_id is not null,
    'job', public.meta_publish_public_job(r.id)
  );
end;
$$;

revoke all on function public.meta_publish_release_ambiguous(uuid, uuid) from public, anon, authenticated;
grant execute on function public.meta_publish_release_ambiguous(uuid, uuid) to service_role;
