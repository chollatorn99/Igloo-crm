-- Let a support user renew / mark outcomes on behalf of the salesperson they
-- assist (e.g. sales_support recording renewals for Chanpimook), and let any
-- salesperson act on a shared prospect. Previously set_renewal_outcome only
-- allowed the customer's own owner or a manager, so the renew button failed for
-- support with "Only the customer owner or a manager can set renewal outcome".
create or replace function set_renewal_outcome(p_policy_id uuid, p_outcome renewal_outcome, p_reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_customer uuid;
begin
  select c.owner_id, c.id into v_owner, v_customer
  from policies p join customers c on c.id = p.customer_id
  where p.id = p_policy_id;

  if v_owner is null then
    raise exception 'Policy not found';
  end if;
  if not (
    current_user_role() = 'manager'
    or v_owner = auth.uid()
    or (current_user_role() = 'support' and v_owner = current_user_supports())
    or (current_user_role() = 'sales' and customer_is_shared(v_customer))
  ) then
    raise exception 'Only the customer owner, their support, or a manager can set renewal outcome';
  end if;

  update policies
  set renewal_outcome = p_outcome,
      not_renewed_reason = case when p_outcome = 'not_renewed' then p_reason else null end
  where id = p_policy_id;
end;
$$;

grant execute on function set_renewal_outcome(uuid, renewal_outcome, text) to authenticated;
