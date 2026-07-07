-- Missing from the original schema: the requirement doc calls for a
-- distinct "closed date" driving revenue-by-period reporting, separate from
-- coverage_start_date (which is about when the policy protection begins,
-- not when the deal was won).
alter table policies add column closed_date date;

create or replace function enforce_policy_transitions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.deal_status = 'win' and old.deal_status <> 'win' then
    if new.payment_status is null then
      new.payment_status := 'awaiting_payment';
    end if;
    if new.closed_date is null then
      new.closed_date := current_date;
    end if;
  end if;

  if new.payment_status is distinct from old.payment_status then
    if current_user_role() not in ('accounting', 'manager')
       and not (old.payment_status = 'awaiting_payment' and new.payment_status = 'awaiting_verification') then
      raise exception 'Only accounting or a manager can set this payment status';
    end if;
    insert into payment_status_log(policy_id, old_status, new_status, changed_by)
    values (old.id, old.payment_status, new.payment_status, auth.uid());
  end if;

  return new;
end;
$$;
