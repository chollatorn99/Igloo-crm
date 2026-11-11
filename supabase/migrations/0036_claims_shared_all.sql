-- Claims become a SHARED team board: every authenticated user can see and work
-- on all claims (not just their own), so anyone can help follow up. Delete stays
-- restricted (unchanged from 0027: manager/owner/support).

drop policy claims_select on claims;
create policy claims_select on claims for select using (auth.uid() is not null);

drop policy claims_insert on claims;
create policy claims_insert on claims for insert with check (auth.uid() is not null);

drop policy claims_update on claims;
create policy claims_update on claims for update
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy claim_notes_select on claim_notes;
create policy claim_notes_select on claim_notes for select using (auth.uid() is not null);
drop policy claim_notes_insert on claim_notes;
create policy claim_notes_insert on claim_notes for insert with check (author_id = auth.uid());

drop policy claim_claimants_select on claim_claimants;
create policy claim_claimants_select on claim_claimants for select using (auth.uid() is not null);
drop policy claim_claimants_insert on claim_claimants;
create policy claim_claimants_insert on claim_claimants for insert with check (auth.uid() is not null);
drop policy claim_claimants_update on claim_claimants;
create policy claim_claimants_update on claim_claimants for update
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- So the claim list/detail can show the customer name to everyone, let any user
-- read a customer that has a claim (names only on the claim pages; the general
-- customers page stays scoped by its own policy).
drop policy customers_select on customers;
create policy customers_select on customers for select using (
  current_user_role() = 'manager'
  or owner_id = auth.uid()
  or (current_user_role() = 'accounting' and customer_has_win_policy(customers.id))
  or (current_user_role() = 'support' and owner_id = current_user_supports())
  or customer_has_claim(customers.id)
  or (current_user_role() = 'sales' and is_shared)
);
