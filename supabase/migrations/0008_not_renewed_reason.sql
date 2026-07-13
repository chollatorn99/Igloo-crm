-- Capture WHY a customer didn't renew, recorded when marking "ไม่ต่อ".
alter table policies add column not_renewed_reason text;

-- Extend the outcome setter to store the reason (only kept when the outcome
-- is not_renewed; cleared otherwise). p_reason defaults null so existing
-- 2-arg calls keep working.
create or replace function set_renewal_outcome(p_policy_id uuid, p_outcome renewal_outcome, p_reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
begin
  select c.owner_id into v_owner
  from policies p join customers c on c.id = p.customer_id
  where p.id = p_policy_id;

  if v_owner is null then
    raise exception 'Policy not found';
  end if;
  if current_user_role() <> 'manager' and v_owner <> auth.uid() then
    raise exception 'Only the customer owner or a manager can set renewal outcome';
  end if;

  update policies
  set renewal_outcome = p_outcome,
      not_renewed_reason = case when p_outcome = 'not_renewed' then p_reason else null end
  where id = p_policy_id;
end;
$$;

grant execute on function set_renewal_outcome(uuid, renewal_outcome, text) to authenticated;
