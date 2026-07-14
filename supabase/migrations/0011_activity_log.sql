-- Activity feed: one row per meaningful action (add/win/lost/renew/not-renew/
-- delete policy, payment report/verify, logged call). Gives each salesperson a
-- record of their own work and managers a full audit trail — including who
-- deleted what, which the timestamped columns on `policies` can't show.
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references profiles(id),
  action text not null,          -- machine key, e.g. 'renewed', 'policy_deleted'
  summary text not null,         -- human-readable snapshot (survives row deletion)
  entity_id uuid,                -- policy/customer id (not FK — entity may be deleted)
  customer_id uuid,              -- for linking back to the customer when it still exists
  created_at timestamptz not null default now()
);

alter table activity_log enable row level security;

-- A user may only write their own activity; managers can read everyone's, a
-- salesperson only their own.
create policy activity_log_insert on activity_log for insert
  with check (actor_id = auth.uid());
create policy activity_log_select on activity_log for select
  using (actor_id = auth.uid() or current_user_role() = 'manager');

create index activity_log_actor_created_idx on activity_log(actor_id, created_at desc);
create index activity_log_created_idx on activity_log(created_at desc);
