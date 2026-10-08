-- Option (ข): the support user handles CLAIMS for the whole sales team, while
-- their sales/renewal/payment visibility stays limited to the salesperson they
-- assist (unchanged). So: claims + claim_notes become support-wide, support can
-- READ a customer that has a claim (to show the name on claim list/detail), and
-- a security-definer search lets support/manager find any customer to open the
-- first claim — without widening the general customers page.

drop policy claims_select on claims;
create policy claims_select on claims for select using (
  current_user_role() in ('manager', 'support', 'accounting') or owner_id = auth.uid()
);
drop policy claims_insert on claims;
create policy claims_insert on claims for insert with check (
  current_user_role() in ('manager', 'support') or owner_id = auth.uid()
);
drop policy claims_update on claims;
create policy claims_update on claims for update
  using (current_user_role() in ('manager', 'support') or owner_id = auth.uid())
  with check (current_user_role() in ('manager', 'support') or owner_id = auth.uid());

drop policy claim_notes_select on claim_notes;
create policy claim_notes_select on claim_notes for select using (
  current_user_role() in ('manager', 'support', 'accounting') or claim_owner_id(claim_notes.claim_id) = auth.uid()
);
drop policy claim_notes_insert on claim_notes;
create policy claim_notes_insert on claim_notes for insert with check (
  author_id = auth.uid() and (current_user_role() in ('manager', 'support') or claim_owner_id(claim_notes.claim_id) = auth.uid())
);

-- Support may read a customer that has a claim (name on claim list/detail).
create or replace function customer_has_claim(p_customer_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from claims where customer_id = p_customer_id);
$$;

drop policy customers_select on customers;
create policy customers_select on customers for select using (
  current_user_role() = 'manager'
  or owner_id = auth.uid()
  or (current_user_role() = 'accounting' and customer_has_win_policy(customers.id))
  or (current_user_role() = 'support' and owner_id = current_user_supports())
  or (current_user_role() = 'support' and customer_has_claim(customers.id))
  or (current_user_role() = 'sales' and is_shared)
);

-- Cross-customer search for the claim picker (manager/support only), so support
-- can find Jenjira's customers to open a claim. Returns name/phone only.
create or replace function claim_customer_search(term text)
returns table(id uuid, name text, phone text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.phone
  from customers c
  where current_user_role() in ('manager', 'support')
    and (c.name ilike '%' || term || '%' or c.phone ilike '%' || term || '%')
  order by c.name
  limit 25;
$$;
grant execute on function claim_customer_search(text) to authenticated;
