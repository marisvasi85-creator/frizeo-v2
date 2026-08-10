-- Phase 6 automations smoke tests. Every fixture is rolled back.
begin;

do $$
declare
  v_plan_id uuid;
  v_user uuid;
  v_tenant uuid := '62000000-0000-4000-8000-000000000001';
  v_contact uuid := '61000000-0000-4000-8000-000000000001';
  v_paid_tenant uuid := '62000000-0000-4000-8000-000000000002';
  v_paid_contact uuid := '61000000-0000-4000-8000-000000000002';
  v_welcome uuid;
  v_trial3 uuid;
  v_winback uuid;
  v_run_id uuid;
  v_claim uuid;
  v_discover jsonb;
  v_cond record;
  v_paused_count integer;
begin
  select id into v_plan_id from public.plans where slug = 'pro' limit 1;
  if v_plan_id is null then raise exception 'test_plan_missing'; end if;
  select id into v_user from auth.users order by created_at limit 1;
  if v_user is null then raise exception 'test_auth_user_missing'; end if;

  -- All seeded automations must be paused.
  select count(*)::integer into v_paused_count
  from public.marketing_automations
  where is_system = true and is_active = true;
  if v_paused_count <> 0 then
    raise exception 'system_automations_not_paused';
  end if;

  insert into public.tenants (id, name, slug) values
    (v_tenant, 'Phase 6 Trial', 'phase-6-trial'),
    (v_paid_tenant, 'Phase 6 Paid', 'phase-6-paid');

  insert into public.subscriptions (
    tenant_id, plan_id, status, stripe_subscription_id, trial_ends_at, created_at
  ) values
    (
      v_tenant,
      v_plan_id,
      'trialing',
      null,
      (timezone('Europe/Bucharest', now())::date + 3)::timestamp,
      now() - interval '1 day'
    ),
    (
      v_paid_tenant,
      v_plan_id,
      'active',
      'sub_phase6_test',
      null,
      now() - interval '10 days'
    );

  insert into public.marketing_contacts (
    id, email, first_name, source, status, marketing_consent, consent_source,
    consent_at, user_id, tenant_id, created_at
  ) values
    (
      v_contact,
      'phase6.trial@example.com',
      'Trial',
      'frizeo_user',
      'subscribed',
      true,
      'test',
      now(),
      v_user,
      v_tenant,
      now() - interval '2 days'
    ),
    (
      v_paid_contact,
      'phase6.paid@example.com',
      'Paid',
      'frizeo_user',
      'subscribed',
      true,
      'test',
      now(),
      v_user,
      v_paid_tenant,
      now() - interval '20 days'
    );

  select id into v_welcome
  from public.marketing_automations
  where automation_key = 'welcome_after_signup';

  select id into v_trial3
  from public.marketing_automations
  where automation_key = 'trial_ending_3_days';

  select id into v_winback
  from public.marketing_automations
  where automation_key = 'trial_expired_7_days';

  if v_welcome is null or v_trial3 is null or v_winback is null then
    raise exception 'system_automations_missing';
  end if;

  -- Paused automation must not create runs.
  perform public.discover_marketing_automation_runs(50);
  if exists (
    select 1 from public.marketing_automation_runs
    where automation_id = v_welcome and contact_id = v_contact
  ) then
    raise exception 'paused_automation_created_run';
  end if;

  update public.marketing_automations set is_active = true where id = v_welcome;
  update public.marketing_automations set is_active = true where id = v_trial3;

  v_discover := public.discover_marketing_automation_runs(50);
  if coalesce((v_discover ->> 'inserted')::integer, 0) < 1 then
    raise exception 'discover_inserted_zero: %', v_discover;
  end if;

  -- Idempotency: second discovery does not duplicate.
  perform public.discover_marketing_automation_runs(50);
  if (
    select count(*) from public.marketing_automation_runs
    where automation_id = v_welcome and contact_id = v_contact and is_test = false
  ) <> 1 then
    raise exception 'welcome_run_not_idempotent';
  end if;

  if (
    select count(*) from public.marketing_automation_runs
    where automation_id = v_trial3 and contact_id = v_contact and is_test = false
  ) <> 1 then
    raise exception 'trial_3_run_missing_or_duplicated';
  end if;

  -- Condition skip when paid.
  select * into v_cond
  from public.marketing_automation_condition_ok(
    v_paid_contact,
    '{"require_eligible":true,"require_not_paid":true}'::jsonb
  );
  if v_cond.ok or v_cond.skip_reason <> 'now_paid' then
    raise exception 'paid_condition_not_skipped: %', v_cond;
  end if;

  -- Claim once.
  update public.marketing_automation_runs
  set scheduled_for = now() - interval '1 minute',
      next_attempt_at = now() - interval '1 minute'
  where automation_id = v_welcome
    and contact_id = v_contact;

  select run_id, claim_token into v_run_id, v_claim
  from public.claim_marketing_automation_run_batch(5, 600, 4)
  where automation_id = v_welcome
  limit 1;

  if v_run_id is null then
    raise exception 'claim_failed';
  end if;

  -- Second claim should not return the same run.
  if exists (
    select 1
    from public.claim_marketing_automation_run_batch(5, 600, 4)
    where run_id = v_run_id
  ) then
    raise exception 'double_claim';
  end if;

  perform public.record_marketing_automation_run_result(
    v_run_id,
    v_claim,
    'sent',
    'resend',
    'msg_phase6_test_1',
    null,
    null,
    false,
    60,
    4
  );

  if not exists (
    select 1 from public.marketing_automation_runs
    where id = v_run_id and status = 'sent' and provider_message_id = 'msg_phase6_test_1'
  ) then
    raise exception 'sent_not_recorded';
  end if;

  -- Webhook automation match.
  perform public.process_marketing_automation_email_event(
    'resend',
    'evt_phase6_1',
    'msg_phase6_test_1',
    'delivered',
    now(),
    '{"frizeo_email_type":"marketing-automation"}'::jsonb,
    null, null, null, false
  );

  if not exists (
    select 1 from public.marketing_email_events
    where provider_event_id = 'evt_phase6_1'
      and automation_run_id = v_run_id
  ) then
    raise exception 'automation_webhook_not_linked';
  end if;

  raise notice 'phase6_automations_ok';
end $$;

rollback;
