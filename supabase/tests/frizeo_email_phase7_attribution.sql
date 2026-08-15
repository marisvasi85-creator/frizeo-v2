-- Phase 7 attribution smoke tests. Every fixture is rolled back.
begin;

do $$
declare
  v_campaign uuid := gen_random_uuid();
  v_automation uuid;
  v_link uuid;
  v_link2 uuid;
  v_count integer;
begin
  select id into v_automation
  from public.marketing_automations
  where automation_key = 'welcome_signup'
  limit 1;

  if v_automation is null then
    raise exception 'phase7_missing_welcome_automation';
  end if;

  insert into public.marketing_campaigns (
    id, name, subject, preview_text, heading, body_text, footer_text,
    status, audience_kind
  ) values (
    v_campaign,
    'Phase 7 Attribution Test',
    'Subject',
    'Preview',
    'Heading',
    'Body',
    'Footer',
    'draft',
    'all_subscribed'
  );

  insert into public.marketing_attribution_links (
    source_kind, campaign_id, destination_url, utm_campaign, is_test, clicked_at
  ) values (
    'campaign',
    v_campaign,
    'https://staging.frizeo.ro/signup',
    v_campaign::text,
    false,
    now()
  ) returning id into v_link;

  insert into public.marketing_conversions (
    conversion_type, attribution_role, attribution_link_id, campaign_id,
    idempotency_key
  ) values (
    'signup', 'acquisition', v_link, v_campaign,
    'phase7_test_signup_' || v_link::text
  );

  begin
    insert into public.marketing_conversions (
      conversion_type, attribution_role, campaign_id, idempotency_key
    ) values (
      'signup', 'acquisition', v_campaign,
      'phase7_test_signup_' || v_link::text
    );
    raise exception 'phase7_idempotency_failed';
  exception
    when unique_violation then
      null;
  end;

  insert into public.marketing_attribution_links (
    source_kind, automation_id, destination_url, is_test
  ) values (
    'automation', v_automation, 'https://staging.frizeo.ro/signup', true
  ) returning id into v_link2;

  select count(*) into v_count
  from public.marketing_attribution_links
  where id = v_link2 and is_test = true;
  if v_count <> 1 then
    raise exception 'phase7_test_link_flag_failed';
  end if;

  insert into public.marketing_conversions (
    conversion_type, attribution_role, automation_id,
    amount, currency, billing_interval, mrr_amount, idempotency_key
  ) values (
    'subscription_started', 'lifecycle', v_automation,
    79, 'RON', 'month', 79,
    'phase7_test_paid_' || v_automation::text
  );

  select count(*) into v_count
  from public.marketing_conversions
  where campaign_id = v_campaign and conversion_type = 'signup';
  if v_count <> 1 then
    raise exception 'phase7_campaign_signup_count_failed';
  end if;

  raise notice 'phase7_attribution_ok';
end $$;

rollback;

select 'phase7_attribution_db_tests_passed' as result;
