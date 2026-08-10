-- Run after the Phase 5 migration. Every fixture is rolled back.
begin;

do $$
declare
  v_plan_id uuid;
  v_registered_user uuid;
  v_lead uuid := '51000000-0000-4000-8000-000000000001';
  v_trial_3 uuid := '51000000-0000-4000-8000-000000000002';
  v_expired uuid := '51000000-0000-4000-8000-000000000003';
  v_paid uuid := '51000000-0000-4000-8000-000000000004';
  v_unsubscribed uuid := '51000000-0000-4000-8000-000000000005';
  v_complained uuid := '51000000-0000-4000-8000-000000000006';
  v_bounced uuid := '51000000-0000-4000-8000-000000000007';
  v_deleted uuid := '51000000-0000-4000-8000-000000000008';
  v_tenant_trial uuid := '52000000-0000-4000-8000-000000000001';
  v_tenant_expired uuid := '52000000-0000-4000-8000-000000000002';
  v_tenant_paid uuid := '52000000-0000-4000-8000-000000000003';
  v_custom_segment uuid;
  v_campaign uuid;
begin
  select id into v_plan_id from public.plans where slug = 'pro' limit 1;
  if v_plan_id is null then raise exception 'test_plan_missing'; end if;
  select id into v_registered_user from auth.users order by created_at limit 1;
  if v_registered_user is null then raise exception 'test_auth_user_missing'; end if;

  insert into public.tenants (id, name, slug) values
    (v_tenant_trial, 'Phase 5 Trial Test', 'phase-5-trial-test'),
    (v_tenant_expired, 'Phase 5 Expired Test', 'phase-5-expired-test'),
    (v_tenant_paid, 'Phase 5 Paid Test', 'phase-5-paid-test');

  insert into public.subscriptions (
    tenant_id, plan_id, status, stripe_subscription_id, trial_ends_at
  ) values
    (
      v_tenant_trial,
      v_plan_id,
      'trialing',
      null,
      (timezone('Europe/Bucharest', now())::date + 3)::timestamp
    ),
    (
      v_tenant_expired,
      v_plan_id,
      'trialing',
      null,
      (timezone('Europe/Bucharest', now())::date - 1)::timestamp
    ),
    (v_tenant_paid, v_plan_id, 'active', 'sub_phase5_test', null);

  insert into public.marketing_contacts (
    id, email, source, status, marketing_consent, consent_source, consent_at,
    user_id, tenant_id, complained_at, bounced_at, deleted_at
  ) values
    (v_lead, 'phase5-lead@example.test', 'manual', 'subscribed', true, 'test', now(), null, null, null, null, null),
    (v_trial_3, 'phase5-trial3@example.test', 'frizeo_user', 'subscribed', true, 'test', now(), v_registered_user, v_tenant_trial, null, null, null),
    (v_expired, 'phase5-expired@example.test', 'frizeo_user', 'subscribed', true, 'test', now(), v_registered_user, v_tenant_expired, null, null, null),
    (v_paid, 'phase5-paid@example.test', 'frizeo_user', 'subscribed', true, 'test', now(), v_registered_user, v_tenant_paid, null, null, null),
    (v_unsubscribed, 'phase5-unsub@example.test', 'manual', 'subscribed', true, 'test', now(), null, null, null, null, null),
    (v_complained, 'phase5-complained@example.test', 'manual', 'complained', true, 'test', now(), null, null, now(), null, null),
    (v_bounced, 'phase5-bounced@example.test', 'manual', 'bounced', true, 'test', now(), null, null, null, now(), null),
    (v_deleted, 'phase5-deleted@example.test', 'manual', 'subscribed', true, 'test', now(), null, null, null, null, now());

  insert into public.marketing_unsubscribe_events (contact_id)
  values (v_unsubscribed);

  if not exists (
    select 1 from public.marketing_evaluate_segment_definition(
      (select definition from public.marketing_segments where segment_key = 'leads')
    ) member where member.contact_id = v_lead
  ) then raise exception 'lead_missing_from_leads'; end if;

  if exists (
    select 1 from public.marketing_evaluate_segment_definition(
      (select definition from public.marketing_segments where segment_key = 'leads')
    ) member where member.contact_id = v_trial_3
  ) then raise exception 'registered_user_in_leads'; end if;

  if not exists (
    select 1 from public.marketing_evaluate_segment_definition(
      (select definition from public.marketing_segments where segment_key = 'trial_ending_3_days')
    ) member where member.contact_id = v_trial_3
  ) then raise exception 'trial_3_days_missing'; end if;

  if not exists (
    select 1 from public.marketing_evaluate_segment_definition(
      (select definition from public.marketing_segments where segment_key = 'trial_expired_no_subscription')
    ) member where member.contact_id = v_expired
  ) then raise exception 'expired_without_subscription_missing'; end if;

  if exists (
    select 1 from public.marketing_evaluate_segment_definition(
      (select definition from public.marketing_segments where segment_key = 'trial_expired_no_subscription')
    ) member where member.contact_id = v_paid
  ) then raise exception 'paid_in_expired_without_subscription'; end if;

  if not exists (
    select 1 from public.marketing_evaluate_segment_definition(
      (select definition from public.marketing_segments where segment_key = 'paid_customers')
    ) member where member.contact_id = v_paid
  ) then raise exception 'paid_customer_missing'; end if;

  if exists (
    select 1 from public.marketing_contact_facts() fact
    where fact.contact_id in (v_unsubscribed, v_complained, v_bounced, v_deleted)
  ) then raise exception 'suppressed_contact_is_eligible'; end if;

  if public.marketing_validate_segment_definition(
    '{"version":1,"logic":"AND","conditions":[{"field":"raw_sql","operator":"equals","value":"true"}]}'::jsonb
  ) then raise exception 'invalid_field_accepted'; end if;

  if public.marketing_validate_segment_definition(
    '{"version":1,"logic":"AND","conditions":[{"field":"source","operator":"before","value":"manual"}]}'::jsonb
  ) then raise exception 'invalid_operator_accepted'; end if;

  begin
    update public.marketing_segments set name = name || ' changed'
    where segment_key = 'leads';
    raise exception 'system_segment_update_allowed';
  exception when others then
    if sqlerrm = 'system_segment_update_allowed' then raise; end if;
  end;

  begin
    delete from public.marketing_segments where segment_key = 'leads';
    raise exception 'system_segment_delete_allowed';
  exception when others then
    if sqlerrm = 'system_segment_delete_allowed' then raise; end if;
  end;

  insert into public.marketing_segments (
    name, description, category, definition, is_system_segment
  ) values (
    'Phase 5 AND Test', 'Temporary custom segment', 'custom',
    '{"version":1,"logic":"AND","conditions":[{"field":"source","operator":"equals","value":"manual"},{"field":"account_status","operator":"equals","value":"lead"}]}'::jsonb,
    false
  ) returning id into v_custom_segment;

  if not exists (
    select 1
    from public.marketing_evaluate_segment_definition(
      (select definition from public.marketing_segments where id = v_custom_segment)
    ) member
    where member.contact_id = v_lead
  ) then raise exception 'custom_and_failed'; end if;

  insert into public.marketing_campaigns (
    name, subject, body_text, audience_kind, segment_id
  ) values (
    'Phase 5 Snapshot Test', 'Phase 5', 'Phase 5 body', 'segment', v_custom_segment
  ) returning id into v_campaign;

  perform public.snapshot_marketing_campaign_audience(v_campaign);
  if not exists (
    select 1 from public.marketing_campaign_recipients
    where campaign_id = v_campaign and contact_id = v_lead
  ) then raise exception 'preview_snapshot_missing_lead'; end if;

  update public.marketing_segments
  set definition = '{"version":1,"logic":"AND","conditions":[{"field":"account_status","operator":"equals","value":"registered"}]}'::jsonb
  where id = v_custom_segment;

  if not exists (
    select 1 from public.marketing_campaign_recipients
    where campaign_id = v_campaign and contact_id = v_lead
  ) then raise exception 'snapshot_changed_before_queue'; end if;

  perform public.queue_marketing_campaign(v_campaign);
  if exists (
    select 1 from public.marketing_campaign_recipients
    where campaign_id = v_campaign and contact_id = v_lead
  ) then raise exception 'queue_did_not_reevaluate_segment'; end if;

  update public.marketing_segments
  set definition = '{"version":1,"logic":"AND","conditions":[{"field":"account_status","operator":"equals","value":"lead"}]}'::jsonb
  where id = v_custom_segment;

  if exists (
    select 1 from public.marketing_campaign_recipients
    where campaign_id = v_campaign and contact_id = v_lead
  ) then raise exception 'queued_snapshot_not_immutable'; end if;

  if has_function_privilege(
    'authenticated',
    'public.marketing_preview_segment(jsonb,integer)',
    'execute'
  ) then raise exception 'authenticated_can_execute_segment_rpc'; end if;
end;
$$;

select 'phase5_dynamic_segment_db_tests_passed' as result;
rollback;
