-- email_normalized is generated from email; only write the source column.
create or replace function public.delete_marketing_contacts(
  p_contact_ids uuid[],
  p_deleted_by uuid
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_deleted_count integer;
  v_campaign_id uuid;
begin
  if p_contact_ids is null
     or cardinality(p_contact_ids) = 0
     or cardinality(p_contact_ids) > 200 then
    raise exception 'invalid_contact_selection';
  end if;
  if p_deleted_by is null or not exists (
    select 1 from public.platform_admins admin where admin.user_id = p_deleted_by
  ) then
    raise exception 'platform_admin_required';
  end if;

  perform 1
  from public.marketing_contacts contact
  where contact.id = any(p_contact_ids)
  order by contact.id
  for update;

  update public.marketing_contacts contact
  set deleted_email_hash = encode(extensions.digest(contact.email_normalized, 'sha256'), 'hex'),
      email = 'deleted+' || contact.id::text || '@contacts.invalid',
      first_name = null,
      last_name = null,
      phone = null,
      notes = null,
      user_id = null,
      tenant_id = null,
      status = 'unsubscribed',
      marketing_consent = false,
      unsubscribed_at = coalesce(contact.unsubscribed_at, now()),
      suppression_reason = 'deleted_by_platform_admin',
      deleted_at = now(),
      deleted_by = p_deleted_by,
      updated_at = now()
  where contact.id = any(p_contact_ids)
    and contact.deleted_at is null;

  get diagnostics v_deleted_count = row_count;

  update public.marketing_unsubscribe_tokens token
  set revoked_at = coalesce(token.revoked_at, now())
  where token.contact_id = any(p_contact_ids);

  for v_campaign_id in
    with skipped as (
      update public.marketing_campaign_recipients recipient
      set status = 'skipped',
          error_message = 'contact_deleted_by_platform_admin',
          next_attempt_at = null,
          claimed_at = null,
          claim_token = null,
          updated_at = now()
      from public.marketing_campaigns campaign
      where recipient.campaign_id = campaign.id
        and recipient.contact_id = any(p_contact_ids)
        and campaign.status in ('queued', 'sending')
        and recipient.status in ('pending', 'queued')
      returning recipient.campaign_id
    )
    select distinct skipped.campaign_id from skipped
  loop
    perform public.refresh_marketing_campaign_progress(v_campaign_id);
  end loop;

  return v_deleted_count;
end;
$$;

revoke all on function public.delete_marketing_contacts(uuid[], uuid) from public, anon, authenticated;
grant execute on function public.delete_marketing_contacts(uuid[], uuid) to service_role;
