-- Claims one finished Instagram container before the single publish call.
-- Status stays publishing. safe_error becomes publish_in_flight so a second
-- caller, or a later retry after an ambiguous result, cannot send again.

create or replace function public.meta_publish_claim_finished(
  p_tenant_id uuid,
  p_job_id uuid,
  p_provider_container_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r public.integration_publish_jobs%rowtype;
begin
  if p_provider_container_id is null or p_provider_container_id !~ '^[0-9]{1,32}$' then
    return jsonb_build_object('outcome', 'not_found');
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

  if r.execution_mode is distinct from 'live'
     or r.status is distinct from 'publishing'
     or r.provider_post_id is not null
     or r.safe_error is not null
     or r.provider_container_id is distinct from p_provider_container_id then
    return jsonb_build_object(
      'outcome', 'held',
      'job', public.meta_publish_public_job(r.id)
    );
  end if;

  update public.integration_publish_jobs
     set safe_error = 'publish_in_flight',
         updated_at = pg_catalog.now()
   where id = r.id
     and tenant_id = p_tenant_id
     and status = 'publishing'
     and execution_mode = 'live'
     and provider_post_id is null
     and safe_error is null
     and provider_container_id = p_provider_container_id;

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

revoke all on function public.meta_publish_claim_finished(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.meta_publish_claim_finished(uuid, uuid, text) to service_role;
