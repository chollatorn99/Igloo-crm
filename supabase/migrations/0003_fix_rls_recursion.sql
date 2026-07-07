-- customers_select referenced policies (for the accounting scope), and
-- policies_select/insert/update referenced customers (for ownership) —
-- each cross-table EXISTS re-triggered the other table's RLS, causing
-- "infinite recursion detected in policy for relation customers".
--
-- Fix: route the cross-table checks through security-definer functions.
-- Owned by postgres (BYPASSRLS), so their internal query does not
-- re-trigger RLS on the other table, breaking the cycle.

create or replace function customer_owner_id(p_customer_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select owner_id from customers where id = p_customer_id;
$$;

create or replace function customer_has_win_policy(p_customer_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from policies where customer_id = p_customer_id and deal_status = 'win');
$$;

drop policy customers_select on customers;
create policy customers_select on customers for select using (
  current_user_role() = 'manager'
  or owner_id = auth.uid()
  or (current_user_role() = 'accounting' and customer_has_win_policy(customers.id))
);

drop policy policies_select on policies;
create policy policies_select on policies for select using (
  current_user_role() = 'manager'
  or customer_owner_id(policies.customer_id) = auth.uid()
  or (current_user_role() = 'accounting' and deal_status = 'win')
);

drop policy policies_insert on policies;
create policy policies_insert on policies for insert with check (
  current_user_role() = 'manager'
  or customer_owner_id(policies.customer_id) = auth.uid()
);

drop policy policies_update on policies;
create policy policies_update on policies for update
  using (
    current_user_role() = 'manager'
    or customer_owner_id(policies.customer_id) = auth.uid()
    or (current_user_role() = 'accounting' and deal_status = 'win')
  )
  with check (
    current_user_role() = 'manager'
    or customer_owner_id(policies.customer_id) = auth.uid()
    or (current_user_role() = 'accounting' and deal_status = 'win')
  );

drop policy follow_up_notes_select on follow_up_notes;
create policy follow_up_notes_select on follow_up_notes for select using (
  current_user_role() = 'manager'
  or customer_owner_id(follow_up_notes.customer_id) = auth.uid()
);

drop policy follow_up_notes_insert on follow_up_notes;
create policy follow_up_notes_insert on follow_up_notes for insert with check (
  author_id = auth.uid()
  and (current_user_role() = 'manager' or customer_owner_id(follow_up_notes.customer_id) = auth.uid())
);
