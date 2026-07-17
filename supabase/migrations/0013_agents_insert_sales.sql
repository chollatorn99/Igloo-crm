-- Let salespeople add their own agents (freelance introducers), not just
-- managers — Jenjira asked to add agents herself. Insert only; editing/
-- deactivating stays manager-only via the existing agents_write policy.
create policy agents_insert_sales on agents for insert
  with check (current_user_role() in ('sales', 'manager'));
