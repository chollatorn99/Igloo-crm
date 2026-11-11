-- Daily report support: a monthly target per salesperson (set once a month) and
-- the few activity counts the CRM doesn't otherwise track (quotes / calls that
-- aren't logged as follow-up notes), saved per day so the evening report fills
-- itself in. Everything money/win/brand related is computed live from policies.

create table if not exists report_targets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  month text not null, -- 'YYYY-MM'
  target_premium numeric(14,2),
  existing_target numeric(14,2),
  updated_at timestamptz not null default now(),
  unique (owner_id, month)
);

create table if not exists daily_report_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  report_date date not null,
  new_quotes int,
  tbd int,
  new_calls int,
  follow_ups int,
  no_response int,
  wrong_number int,
  note text,
  updated_at timestamptz not null default now(),
  unique (owner_id, report_date)
);

create or replace function profile_is_self_or_manager(p_owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select current_user_role() = 'manager' or p_owner = auth.uid()
    or (current_user_role() = 'support' and p_owner = current_user_supports());
$$;

alter table report_targets enable row level security;
alter table daily_report_entries enable row level security;

create policy report_targets_rw on report_targets for all
  using (profile_is_self_or_manager(owner_id)) with check (profile_is_self_or_manager(owner_id));
create policy daily_report_rw on daily_report_entries for all
  using (profile_is_self_or_manager(owner_id)) with check (profile_is_self_or_manager(owner_id));
