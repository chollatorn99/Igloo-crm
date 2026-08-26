-- Bug: a salesperson closing a NEW policy to Win got "Only accounting,
-- support, or a manager can set this payment status". Closing Win auto-sets
-- payment_status null -> awaiting_payment, and the payment-status guard was
-- blocking that automatic default for sales. (Renewals didn't hit this because
-- they're created via INSERT, and this trigger is UPDATE-only.)
--
-- Fix: the guard should govern who moves a payment THROUGH the verification
-- workflow — not the automatic null -> awaiting_payment that a Win sets. Exempt
-- that one transition (RLS already restricts who can update the policy at all).
create or replace function enforce_policy_transitions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.deal_status = 'win' and old.deal_status <> 'win' and new.payment_status is null then
    new.payment_status := 'awaiting_payment';
  end if;

  if new.payment_status is distinct from old.payment_status then
    -- Allow the system default a Win close applies (null -> awaiting_payment)
    -- for anyone allowed to update the policy; guard only real workflow moves.
    if not (old.payment_status is null and new.payment_status = 'awaiting_payment') then
      if current_user_role() not in ('accounting', 'manager', 'support')
         and not (old.payment_status = 'awaiting_payment' and new.payment_status = 'awaiting_verification') then
        raise exception 'Only accounting, support, or a manager can set this payment status';
      end if;
    end if;
    insert into payment_status_log(policy_id, old_status, new_status, changed_by)
    values (old.id, old.payment_status, new.payment_status, auth.uid());
  end if;

  return new;
end;
$$;
