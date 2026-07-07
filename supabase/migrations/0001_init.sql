-- Igloo Broker CRM — initial schema
-- Roles: manager (full access), sales (owns customers), accounting (win-deal payment queue only)

create extension if not exists "pgcrypto";

-- ============ ENUMS ============

create type user_role as enum ('manager', 'sales', 'accounting');
create type user_status as enum ('active', 'inactive');
create type customer_type as enum ('individual', 'organization');
create type deal_status as enum ('pending', 'win', 'lost');
create type payment_status as enum ('awaiting_payment', 'awaiting_verification', 'verified', 'rejected');
create type agent_status as enum ('active', 'inactive');

-- ============ TABLES ============

-- Extends auth.users. Created together with the auth user by the Settings
-- "add user" server action (using the service role key) — no public sign-up.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null,
  status user_status not null default 'active',
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);

-- Freelance introducers who earn a commission split but are not system users.
create table agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  status agent_status not null default 'active',
  created_at timestamptz not null default now()
);

-- Self-service list (Settings, manager-only) — not a hardcoded enum, because
-- Igloo adds new lines of business (Marine, Golf, Fire, ...) over time.
create table policy_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  renewal_reminder_days integer not null default 120,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into policy_categories (name, renewal_reminder_days) values
  ('Motor', 90),
  ('พรบ.รถ', 90),
  ('CAR', 90),
  ('PA', 120),
  ('TA', 120),
  ('Health', 120),
  ('Health+Life', 120),
  ('IAR', 120),
  ('Marine', 120),
  ('Golf', 120),
  ('Fire', 120),
  ('Other', 120);

-- A customer is a relationship (person, school, or company) — not tied to
-- any single policy. One customer can hold many policies over the years.
create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  customer_type customer_type not null default 'individual',
  owner_id uuid not null references profiles(id),
  call_count integer not null default 0,
  last_call_result text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_owner_id_idx on customers(owner_id);

-- One row per policy/deal — matches the real accounting ledger almost
-- column-for-column. deal_status and payment_status live here (not on
-- customers) because one customer can have several policies at different
-- stages at once (e.g. Motor already won, Health still pending).
create table policies (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  category_id uuid not null references policy_categories(id),
  insurance_company text,
  policy_detail text,
  reported_date date not null default current_date,
  coverage_start_date date,
  coverage_end_date date,
  deal_status deal_status not null default 'pending',

  net_premium numeric(12,2),
  stamp_duty numeric(12,2) not null default 0,
  vat numeric(12,2) not null default 0,
  total_premium numeric(12,2) generated always as
    (coalesce(net_premium,0) + coalesce(stamp_duty,0) + coalesce(vat,0)) stored,
  total_collectible numeric(12,2),
  withholding_tax_amount numeric(12,2) not null default 0,

  payment_status payment_status,
  payment_reference text,
  payment_date date,
  verified_by uuid references profiles(id),
  verified_at timestamptz,

  company_commission_rate numeric(5,2),
  company_commission_amount numeric(12,2) generated always as
    (coalesce(net_premium,0) * coalesce(company_commission_rate,0) / 100) stored,

  agent_id uuid references agents(id),
  agent_commission_rate numeric(5,2),
  agent_commission_amount numeric(12,2) generated always as
    (coalesce(net_premium,0) * coalesce(agent_commission_rate,0) / 100) stored,

  customer_discount_amount numeric(12,2) not null default 0,

  -- Inlined (not referencing the two generated columns above) because
  -- Postgres forbids a generated column from referencing another one.
  net_commission_to_igloo numeric(12,2) generated always as (
    (coalesce(net_premium,0) * coalesce(company_commission_rate,0) / 100)
    - (coalesce(net_premium,0) * coalesce(agent_commission_rate,0) / 100)
    - coalesce(customer_discount_amount,0)
  ) stored,

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index policies_customer_id_idx on policies(customer_id);
create index policies_category_id_idx on policies(category_id);
create index policies_deal_status_idx on policies(deal_status);
create index policies_coverage_end_date_idx on policies(coverage_end_date);

-- Append-only timeline per customer.
create table follow_up_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  author_id uuid not null references profiles(id),
  note_text text not null,
  created_at timestamptz not null default now()
);

create index follow_up_notes_customer_id_idx on follow_up_notes(customer_id);

-- Audit trail, written automatically by the enforce_owner_change trigger below.
create table owner_change_log (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  old_owner_id uuid references profiles(id),
  new_owner_id uuid not null references profiles(id),
  changed_by uuid not null references profiles(id),
  changed_at timestamptz not null default now()
);

-- Audit trail, written automatically by the enforce_policy_transitions trigger below.
create table payment_status_log (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references policies(id) on delete cascade,
  old_status payment_status,
  new_status payment_status not null,
  changed_by uuid not null references profiles(id),
  changed_at timestamptz not null default now(),
  note text
);

-- ============ HELPER FUNCTIONS ============

create or replace function current_user_role()
returns user_role
language sql stable security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger customers_touch_updated_at before update on customers
  for each row execute function touch_updated_at();
create trigger policies_touch_updated_at before update on policies
  for each row execute function touch_updated_at();
create trigger policy_categories_touch_updated_at before update on policy_categories
  for each row execute function touch_updated_at();

-- Reassignment is manager-only and always audited — enforced here, not just
-- in the UI, per the security checklist.
create or replace function enforce_owner_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id is distinct from old.owner_id then
    if current_user_role() <> 'manager' then
      raise exception 'Only managers can reassign customer ownership';
    end if;
    insert into owner_change_log(customer_id, old_owner_id, new_owner_id, changed_by)
    values (old.id, old.owner_id, new.owner_id, auth.uid());
  end if;
  return new;
end;
$$;

create trigger customers_owner_change before update on customers
  for each row execute function enforce_owner_change();

-- Payment workflow: win auto-sets "awaiting_payment"; sales may only report
-- a transfer (awaiting_payment -> awaiting_verification); only
-- accounting/manager can verify or reject. Every change is logged.
create or replace function enforce_policy_transitions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.deal_status = 'win' and old.deal_status <> 'win' and new.payment_status is null then
    new.payment_status := 'awaiting_payment';
  end if;

  if new.payment_status is distinct from old.payment_status then
    if current_user_role() not in ('accounting', 'manager')
       and not (old.payment_status = 'awaiting_payment' and new.payment_status = 'awaiting_verification') then
      raise exception 'Only accounting or a manager can set this payment status';
    end if;
    insert into payment_status_log(policy_id, old_status, new_status, changed_by)
    values (old.id, old.payment_status, new.payment_status, auth.uid());
  end if;

  return new;
end;
$$;

create trigger policies_transitions before update on policies
  for each row execute function enforce_policy_transitions();

-- ============ ROW LEVEL SECURITY ============

alter table profiles enable row level security;
alter table agents enable row level security;
alter table policy_categories enable row level security;
alter table customers enable row level security;
alter table policies enable row level security;
alter table follow_up_notes enable row level security;
alter table owner_change_log enable row level security;
alter table payment_status_log enable row level security;

-- profiles: everyone reads their own row; manager reads all.
-- No insert/update/delete policy — user management goes through the
-- Settings server action using the service role key (bypasses RLS).
create policy profiles_select on profiles for select
  using (id = auth.uid() or current_user_role() = 'manager');

-- agents / policy_categories: readable by any authenticated user (needed
-- for dropdowns), writable by managers only.
create policy agents_select on agents for select using (auth.role() = 'authenticated');
create policy agents_write on agents for all
  using (current_user_role() = 'manager') with check (current_user_role() = 'manager');

create policy policy_categories_select on policy_categories for select using (auth.role() = 'authenticated');
create policy policy_categories_write on policy_categories for all
  using (current_user_role() = 'manager') with check (current_user_role() = 'manager');

-- customers: manager sees all; sales sees own; accounting sees only
-- customers with at least one won policy (their payment-verification scope).
create policy customers_select on customers for select using (
  current_user_role() = 'manager'
  or owner_id = auth.uid()
  or (current_user_role() = 'accounting'
      and exists (select 1 from policies p where p.customer_id = customers.id and p.deal_status = 'win'))
);

create policy customers_insert on customers for insert with check (
  current_user_role() in ('manager', 'sales')
  and (current_user_role() = 'manager' or owner_id = auth.uid())
);

create policy customers_update on customers for update
  using (current_user_role() = 'manager' or owner_id = auth.uid())
  with check (current_user_role() = 'manager' or owner_id = auth.uid());
-- (owner_id itself can still only change via enforce_owner_change, which
-- raises unless the caller is a manager — see trigger above.)

-- policies: same visibility shape as customers, joined through ownership.
create policy policies_select on policies for select using (
  current_user_role() = 'manager'
  or exists (select 1 from customers c where c.id = policies.customer_id and c.owner_id = auth.uid())
  or (current_user_role() = 'accounting' and deal_status = 'win')
);

create policy policies_insert on policies for insert with check (
  current_user_role() = 'manager'
  or exists (select 1 from customers c where c.id = policies.customer_id and c.owner_id = auth.uid())
);

create policy policies_update on policies for update
  using (
    current_user_role() = 'manager'
    or exists (select 1 from customers c where c.id = policies.customer_id and c.owner_id = auth.uid())
    or (current_user_role() = 'accounting' and deal_status = 'win')
  )
  with check (
    current_user_role() = 'manager'
    or exists (select 1 from customers c where c.id = policies.customer_id and c.owner_id = auth.uid())
    or (current_user_role() = 'accounting' and deal_status = 'win')
  );

-- follow_up_notes: append-only — no update/delete policy at all.
create policy follow_up_notes_select on follow_up_notes for select using (
  current_user_role() = 'manager'
  or exists (select 1 from customers c where c.id = follow_up_notes.customer_id and c.owner_id = auth.uid())
);

create policy follow_up_notes_insert on follow_up_notes for insert with check (
  author_id = auth.uid()
  and (current_user_role() = 'manager'
       or exists (select 1 from customers c where c.id = follow_up_notes.customer_id and c.owner_id = auth.uid()))
);

-- Audit logs: manager-only, read-only via RLS. Rows are written exclusively
-- by the security-definer trigger functions above, which bypass RLS.
create policy owner_change_log_select on owner_change_log for select
  using (current_user_role() = 'manager');
create policy payment_status_log_select on payment_status_log for select
  using (current_user_role() = 'manager');
