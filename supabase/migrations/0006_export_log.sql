-- Audit trail for every Excel export. Sales is blocked from exporting
-- entirely (enforced in the server action too); this logs the exports that
-- managers/accounting do make, so a leaked file can be traced to a person.
create table export_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  export_type text not null,
  row_count integer not null,
  filter_note text,
  created_at timestamptz not null default now()
);

alter table export_log enable row level security;

-- A user may only record their own export; managers can review all of them.
create policy export_log_insert on export_log for insert
  with check (user_id = auth.uid());
create policy export_log_select on export_log for select
  using (current_user_role() = 'manager');

create index export_log_created_at_idx on export_log(created_at desc);
