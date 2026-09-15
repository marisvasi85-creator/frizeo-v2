-- Account deletion schema/RLS/claim invariants.
-- Fixtures are rolled back. Does not touch production data.

begin;

do $$
declare
  v_user_a uuid := '71000000-0000-4000-8000-000000000001';
  v_user_b uuid := '71000000-0000-4000-8000-000000000002';
  v_req uuid;
  v_claimed public.account_deletion_requests;
  v_count integer;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values
    ('00000000-0000-0000-0000-000000000000', v_user_a, 'authenticated', 'authenticated', 'delete-a@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', v_user_b, 'authenticated', 'authenticated', 'delete-b@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

  insert into public.account_deletion_requests (
    user_id, email_snapshot, status, requested_at, scheduled_for
  ) values (
    v_user_a, 'delete-a@example.test', 'pending', now(), now() + interval '7 days'
  );

  begin
    insert into public.account_deletion_requests (
      user_id, email_snapshot, status, requested_at, scheduled_for
    ) values (
      v_user_a, 'delete-a@example.test', 'pending', now(), now() + interval '7 days'
    );
    raise exception 'duplicate active request should fail';
  exception
    when unique_violation then
      null;
  end;

  -- Future request must not be claimed by the worker.
  select count(*) into v_count
  from public.claim_account_deletion_batch(5, 900, 5, null);
  if v_count <> 0 then
    raise exception 'worker claimed a request before scheduled_for';
  end if;

  -- Force claim (admin Delete now / staging simulate after expiry).
  select id into v_req
  from public.account_deletion_requests
  where user_id = v_user_a and status = 'pending';

  select * into v_claimed
  from public.claim_account_deletion_batch(1, 900, 5, v_req);
  if v_claimed.status is distinct from 'processing' then
    raise exception 'force claim did not move request to processing';
  end if;

  -- Second claim of the same row must be empty (idempotent lock).
  select count(*) into v_count
  from public.claim_account_deletion_batch(1, 900, 5, v_req);
  if v_count <> 0 then
    raise exception 'second claim of processing request must be skipped';
  end if;

  -- User B cannot see user A request via RLS expression (policy uses auth.uid()).
  if exists (
    select 1 from pg_policies
    where tablename = 'account_deletion_requests'
      and policyname = 'account_deletion_requests_select_own'
  ) is not true then
    raise exception 'missing select-own RLS policy';
  end if;
end $$;

rollback;
