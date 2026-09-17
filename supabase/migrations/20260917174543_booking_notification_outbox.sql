-- Durable, opt-in delivery queue for booking side effects.
-- The booking confirmation and the four queue rows are written in one
-- transaction by confirm_public_booking_with_outbox(). The function is only
-- executable by service_role; public clients cannot read or mutate the queue.

create table if not exists public.booking_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  channel text not null check (
    channel in ('google_calendar', 'client_email', 'client_sms', 'barber_email')
  ),
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'completed', 'failed')
  ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  claimed_at timestamptz,
  claim_token uuid,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, channel)
);

create index if not exists booking_notification_outbox_due_idx
  on public.booking_notification_outbox (available_at, created_at)
  where status in ('pending', 'processing');

alter table public.booking_notification_outbox enable row level security;

revoke all on table public.booking_notification_outbox from public, anon, authenticated;
grant select, insert, update, delete on table public.booking_notification_outbox to service_role;

create or replace function public.confirm_public_booking_with_outbox(
  p_booking_id uuid,
  p_client_name text,
  p_client_phone text,
  p_client_email text default null,
  p_client_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_did_confirm boolean := false;
begin
  select *
    into v_booking
    from public.bookings
   where id = p_booking_id
   for update;

  if not found then
    return null;
  end if;

  if v_booking.status = 'pending' and v_booking.expires_at > now() then
    update public.bookings
       set status = 'confirmed',
           client_name = p_client_name,
           client_phone = p_client_phone,
           client_email = nullif(p_client_email, ''),
           client_notes = p_client_notes
     where id = p_booking_id
     returning * into v_booking;

    v_did_confirm := true;
  elsif v_booking.status <> 'confirmed' then
    return null;
  end if;

  if v_did_confirm then
    insert into public.booking_notification_outbox (booking_id, channel)
    select p_booking_id, channels.channel
      from unnest(array[
        'google_calendar',
        'client_email',
        'client_sms',
        'barber_email'
      ]::text[]) as channels(channel)
    on conflict (booking_id, channel) do nothing;
  end if;

  return jsonb_build_object(
    'booking', to_jsonb(v_booking),
    'didConfirm', v_did_confirm
  );
end;
$$;

revoke all on function public.confirm_public_booking_with_outbox(
  uuid, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.confirm_public_booking_with_outbox(
  uuid, text, text, text, text
) to service_role;

create or replace function public.claim_booking_notification_jobs(
  p_limit integer default 8,
  p_lease_seconds integer default 300,
  p_booking_id uuid default null
)
returns setof public.booking_notification_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select job.id
      from public.booking_notification_outbox as job
     where (p_booking_id is null or job.booking_id = p_booking_id)
       and job.attempt_count < 5
       and (
         (job.status = 'pending' and job.available_at <= now())
         or
         (job.status = 'processing' and job.claimed_at < now() - make_interval(secs => p_lease_seconds))
       )
     order by job.created_at, job.channel
     for update of job skip locked
     limit greatest(1, least(coalesce(p_limit, 8), 20))
  )
  update public.booking_notification_outbox as job
     set status = 'processing',
         attempt_count = job.attempt_count + 1,
         claimed_at = now(),
         claim_token = gen_random_uuid(),
         updated_at = now()
    from due
   where job.id = due.id
  returning job.*;
end;
$$;

revoke all on function public.claim_booking_notification_jobs(integer, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_booking_notification_jobs(integer, integer, uuid)
  to service_role;

comment on table public.booking_notification_outbox is
  'Durable per-channel side effects for confirmed bookings. No public policies.';
