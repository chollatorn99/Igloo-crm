-- Option B renewal tracking: a follow-up outcome that lives alongside the
-- historical Win, instead of flipping a won deal to Lost (which would erase
-- the sale from revenue/Performance). deal_status stays the source of truth
-- for revenue; renewal_outcome is purely the "did they renew this term?"
-- follow-up signal used by the renewals reminder list.
create type renewal_outcome as enum ('pending', 'renewed', 'not_renewed');

alter table policies add column renewal_outcome renewal_outcome not null default 'pending';

-- Only owners of the customer (or a manager) may set it — same scope as
-- editing the policy. Enforced at the DB level, not just the UI.
create or replace function set_renewal_outcome(p_policy_id uuid, p_outcome renewal_outcome)
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

  update policies set renewal_outcome = p_outcome where id = p_policy_id;
end;
$$;

revoke all on function set_renewal_outcome(uuid, renewal_outcome) from public;
grant execute on function set_renewal_outcome(uuid, renewal_outcome) to authenticated;
