-- Track who created a customer, so a support user (or any salesperson) can
-- delete customers they created themselves — but not others'. Edit stays open
-- per the existing customers_update policy.
alter table customers add column if not exists created_by uuid references profiles(id);

drop policy if exists customers_delete on customers;
create policy customers_delete on customers for delete using (
  current_user_role() = 'manager' or created_by = auth.uid()
);
