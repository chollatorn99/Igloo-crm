-- Group-health claims need more detail: a date documents were received from the
-- customer, a note on every stage, and per-person (claimant) tracking because
-- members can be rejected or paid at different times.
alter table claims add column if not exists documents_received_date date;
alter table claims add column if not exists documents_received_note text;
alter table claims add column if not exists reported_note text;
alter table claims add column if not exists insurer_reported_note text;
alter table claims add column if not exists survey_note text;
alter table claims add column if not exists quote_note text;
alter table claims add column if not exists negotiate_note text;
alter table claims add column if not exists agreed_note text;
alter table claims add column if not exists paid_note text;

-- Per-claimant lines (one row per member in a group claim).
create table if not exists claim_claimants (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references claims(id) on delete cascade,
  name text not null,
  status text not null default 'pending',   -- pending, approved, rejected, paid
  amount numeric(12,2),
  paid_date date,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists claim_claimants_claim_idx on claim_claimants(claim_id);

alter table claim_claimants enable row level security;
create policy claim_claimants_select on claim_claimants for select using (
  current_user_role() in ('manager', 'support', 'accounting') or claim_owner_id(claim_claimants.claim_id) = auth.uid());
create policy claim_claimants_insert on claim_claimants for insert with check (
  current_user_role() in ('manager', 'support') or claim_owner_id(claim_claimants.claim_id) = auth.uid());
create policy claim_claimants_update on claim_claimants for update
  using (current_user_role() in ('manager', 'support') or claim_owner_id(claim_claimants.claim_id) = auth.uid())
  with check (current_user_role() in ('manager', 'support') or claim_owner_id(claim_claimants.claim_id) = auth.uid());
create policy claim_claimants_delete on claim_claimants for delete using (
  current_user_role() in ('manager', 'support') or claim_owner_id(claim_claimants.claim_id) = auth.uid());
