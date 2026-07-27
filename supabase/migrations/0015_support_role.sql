-- Support role: an assistant who records data ON BEHALF OF one salesperson
-- (sales_support helps motor@ / Chanpimook). Scoped to that one owner via
-- profiles.supports_owner_id. Can do everything on that owner's customers +
-- policies (incl. payment verification), but not commission/settings/export.
--
-- ⚠️ RUN IN TWO STEPS in the Supabase SQL editor:
--    STEP 1: run the single ALTER TYPE line below, on its own, and press Run.
--    STEP 2: then run everything from "STEP 2" downward.
-- (Postgres won't let a newly-added enum value be used in the same
--  transaction it was added in.)

-- ===== STEP 1 (run alone first) =====
alter type user_role add value if not exists 'support';


-- ===== STEP 2 (run after step 1 succeeds) =====
alter table profiles add column if not exists supports_owner_id uuid references profiles(id);

-- Which salesperson the current user assists (null for everyone else).
create or replace function current_user_supports()
returns uuid language sql stable security definer set search_path = public as $$
  select supports_owner_id from profiles where id = auth.uid();
$$;

-- customers
drop policy customers_select on customers;
create policy customers_select on customers for select using (
  current_user_role() = 'manager'
  or owner_id = auth.uid()
  or (current_user_role() = 'accounting' and customer_has_win_policy(customers.id))
  or (current_user_role() = 'support' and owner_id = current_user_supports())
);
drop policy customers_insert on customers;
create policy customers_insert on customers for insert with check (
  (current_user_role() in ('manager', 'sales') and (current_user_role() = 'manager' or owner_id = auth.uid()))
  or (current_user_role() = 'support' and owner_id = current_user_supports())
);
drop policy customers_update on customers;
create policy customers_update on customers for update
  using (current_user_role() = 'manager' or owner_id = auth.uid()
         or (current_user_role() = 'support' and owner_id = current_user_supports()))
  with check (current_user_role() = 'manager' or owner_id = auth.uid()
         or (current_user_role() = 'support' and owner_id = current_user_supports()));

-- policies
drop policy policies_select on policies;
create policy policies_select on policies for select using (
  current_user_role() = 'manager'
  or customer_owner_id(policies.customer_id) = auth.uid()
  or (current_user_role() = 'accounting' and deal_status = 'win')
  or (current_user_role() = 'support' and customer_owner_id(policies.customer_id) = current_user_supports())
);
drop policy policies_insert on policies;
create policy policies_insert on policies for insert with check (
  current_user_role() = 'manager'
  or customer_owner_id(policies.customer_id) = auth.uid()
  or (current_user_role() = 'support' and customer_owner_id(policies.customer_id) = current_user_supports())
);
drop policy policies_update on policies;
create policy policies_update on policies for update
  using (
    current_user_role() = 'manager'
    or customer_owner_id(policies.customer_id) = auth.uid()
    or (current_user_role() = 'accounting' and deal_status = 'win')
    or (current_user_role() = 'support' and customer_owner_id(policies.customer_id) = current_user_supports())
  )
  with check (
    current_user_role() = 'manager'
    or customer_owner_id(policies.customer_id) = auth.uid()
    or (current_user_role() = 'accounting' and deal_status = 'win')
    or (current_user_role() = 'support' and customer_owner_id(policies.customer_id) = current_user_supports())
  );
drop policy policies_delete on policies;
create policy policies_delete on policies for delete using (
  current_user_role() = 'manager'
  or customer_owner_id(policies.customer_id) = auth.uid()
  or (current_user_role() = 'support' and customer_owner_id(policies.customer_id) = current_user_supports())
);

-- follow-up notes (calls)
drop policy follow_up_notes_select on follow_up_notes;
create policy follow_up_notes_select on follow_up_notes for select using (
  current_user_role() = 'manager'
  or customer_owner_id(follow_up_notes.customer_id) = auth.uid()
  or (current_user_role() = 'support' and customer_owner_id(follow_up_notes.customer_id) = current_user_supports())
);
drop policy follow_up_notes_insert on follow_up_notes;
create policy follow_up_notes_insert on follow_up_notes for insert with check (
  author_id = auth.uid()
  and (current_user_role() = 'manager'
       or customer_owner_id(follow_up_notes.customer_id) = auth.uid()
       or (current_user_role() = 'support' and customer_owner_id(follow_up_notes.customer_id) = current_user_supports()))
);

-- Allow support to move payment status (verify payments) too.
create or replace function enforce_policy_transitions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.deal_status = 'win' and old.deal_status <> 'win' and new.payment_status is null then
    new.payment_status := 'awaiting_payment';
  end if;

  if new.payment_status is distinct from old.payment_status then
    if current_user_role() not in ('accounting', 'manager', 'support')
       and not (old.payment_status = 'awaiting_payment' and new.payment_status = 'awaiting_verification') then
      raise exception 'Only accounting, support, or a manager can set this payment status';
    end if;
    insert into payment_status_log(policy_id, old_status, new_status, changed_by)
    values (old.id, old.payment_status, new.payment_status, auth.uid());
  end if;

  return new;
end;
$$;
