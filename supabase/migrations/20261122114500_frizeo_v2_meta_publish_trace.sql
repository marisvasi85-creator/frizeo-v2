-- Safe stage trace for a Meta publish job. Each entry is an allowlisted
-- stage and outcome plus a duration and HTTP status. Secrets, URLs, post text,
-- and response bodies are not accepted.

alter table public.integration_publish_jobs
  add column if not exists publish_trace jsonb not null default '[]'::jsonb;

create or replace function public.meta_publish_trace(
  p_tenant_id uuid,
  p_job_id uuid,
  p_stage text,
  p_outcome text,
  p_duration_ms integer,
  p_http_status integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_duration integer := p_duration_ms;
  v_status integer := p_http_status;
begin
  if p_stage not in (
    'container_create',
    'container_status',
    'media_publish',
    'facebook_photo',
    'page_token'
  ) then
    return;
  end if;
  if p_outcome not in (
    'created',
    'ok',
    'timeout',
    'network',
    'http',
    'in_progress',
    'finished',
    'error',
    'expired',
    'published',
    'ambiguous',
    'provider_error',
    'missing_id',
    'skipped'
  ) then
    return;
  end if;
  if v_duration is null or v_duration < 0 or v_duration > 60000 then
    v_duration := null;
  end if;
  if v_status is not null and (v_status < 0 or v_status > 599) then
    v_status := null;
  end if;

  update public.integration_publish_jobs
     set publish_trace = (
       select coalesce(jsonb_agg(item order by ord), '[]'::jsonb)
         from (
           select item, ord
             from jsonb_array_elements(
               coalesce(publish_trace, '[]'::jsonb) || jsonb_build_array(
                 jsonb_build_object(
                   'stage', p_stage,
                   'outcome', p_outcome,
                   'duration_ms', v_duration,
                   'http_status', v_status,
                   'at', pg_catalog.to_char(
                     pg_catalog.now() at time zone 'utc',
                     'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                   )
                 )
               )
             ) with ordinality as traced(item, ord)
            order by ord desc
            limit 24
         ) kept
     )
   where id = p_job_id
     and tenant_id = p_tenant_id;
end;
$$;

revoke all on function public.meta_publish_trace(uuid, uuid, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.meta_publish_trace(uuid, uuid, text, text, integer, integer)
  to service_role;
