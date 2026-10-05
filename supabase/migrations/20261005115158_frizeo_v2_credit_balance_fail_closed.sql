-- A debit or negative adjustment that cannot be covered by credits available
-- at that moment makes the ledger inconsistent. The uncovered part is not
-- dropped, and a later grant cannot hide it.

create or replace function private.credit_balance(
  p_tenant_id uuid,
  p_at timestamptz
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r record;
  v_lots jsonb := '[]'::jsonb;
  v_need integer;
  v_index integer;
  v_best integer;
  v_lot jsonb;
  v_remaining integer;
  v_expires timestamptz;
  v_created timestamptz;
  v_best_expires timestamptz;
  v_best_created timestamptz;
  v_take integer;
  v_total integer := 0;
begin
  for r in
    select entry_type, amount, expires_at, created_at
      from public.credit_ledger
     where tenant_id = p_tenant_id
     order by created_at, id
  loop
    if r.amount > 0
       and r.entry_type in ('included_grant', 'purchased_grant', 'reversal', 'adjustment') then
      v_lots := v_lots || jsonb_build_array(
        jsonb_build_object(
          'remaining', r.amount,
          'expires_at', r.expires_at,
          'created_at', r.created_at
        )
      );
    elsif r.amount < 0 and r.entry_type in ('debit', 'adjustment') then
      v_need := -r.amount;
      while v_need > 0 loop
        v_best := null;
        v_best_expires := null;
        v_best_created := null;

        for v_index in 0 .. jsonb_array_length(v_lots) - 1 loop
          v_lot := v_lots -> v_index;
          v_remaining := (v_lot ->> 'remaining')::integer;
          if v_remaining <= 0 then
            continue;
          end if;

          v_expires := (v_lot ->> 'expires_at')::timestamptz;
          v_created := (v_lot ->> 'created_at')::timestamptz;
          if v_expires is not null and v_expires <= r.created_at then
            continue;
          end if;

          if v_best is null
             or (
               v_expires is not null
               and (
                 v_best_expires is null
                 or v_expires < v_best_expires
                 or (v_expires = v_best_expires and v_created < v_best_created)
               )
             )
             or (
               v_expires is null
               and v_best_expires is null
               and v_created < v_best_created
             ) then
            v_best := v_index;
            v_best_expires := v_expires;
            v_best_created := v_created;
          end if;
        end loop;

        if v_best is null then
          raise exception 'inconsistent_credit_ledger';
        end if;

        v_take := least(v_need, (v_lots -> v_best ->> 'remaining')::integer);
        v_lots := jsonb_set(
          v_lots,
          array[v_best::text, 'remaining'],
          to_jsonb((v_lots -> v_best ->> 'remaining')::integer - v_take)
        );
        v_need := v_need - v_take;
      end loop;
    end if;
  end loop;

  for v_index in 0 .. jsonb_array_length(v_lots) - 1 loop
    v_lot := v_lots -> v_index;
    v_expires := (v_lot ->> 'expires_at')::timestamptz;
    if v_expires is null or v_expires > p_at then
      v_total := v_total + (v_lot ->> 'remaining')::integer;
    end if;
  end loop;

  return v_total;
end;
$$;

revoke all on function private.credit_balance(uuid, timestamptz) from public, anon, authenticated;
grant execute on function private.credit_balance(uuid, timestamptz) to service_role;
