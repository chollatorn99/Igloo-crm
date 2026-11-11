-- Installment plans (ผ่อนชำระกับบริษัท). The plan lives on the policy; each
-- month's payment is a row in installment_payments so it can be tracked/ticked
-- off on a dedicated page.
alter table policies add column if not exists is_installment boolean not null default false;
alter table policies add column if not exists installment_months int;
alter table policies add column if not exists installment_amount numeric(12,2);

create table if not exists installment_payments (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references policies(id) on delete cascade,
  installment_no int not null,
  due_date date,
  amount numeric(12,2),
  paid boolean not null default false,
  paid_date date,
  note text,
  created_at timestamptz not null default now(),
  unique (policy_id, installment_no)
);
create index if not exists installment_payments_policy_idx on installment_payments(policy_id);

-- Owner of the customer a policy belongs to — lets the schedule rows reuse the
-- same ownership rules as the policy without embedding a join in every policy.
create or replace function policy_owner_id(p_policy_id uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select c.owner_id from policies p join customers c on c.id = p.customer_id where p.id = p_policy_id
$$;

alter table installment_payments enable row level security;

create policy installments_select on installment_payments for select using (
  current_user_role() in ('manager','accounting')
  or policy_owner_id(policy_id) = auth.uid()
  or (current_user_role() = 'support' and policy_owner_id(policy_id) = current_user_supports())
);
create policy installments_insert on installment_payments for insert with check (
  current_user_role() in ('manager','accounting')
  or policy_owner_id(policy_id) = auth.uid()
  or (current_user_role() = 'support' and policy_owner_id(policy_id) = current_user_supports())
);
create policy installments_update on installment_payments for update using (
  current_user_role() in ('manager','accounting')
  or policy_owner_id(policy_id) = auth.uid()
  or (current_user_role() = 'support' and policy_owner_id(policy_id) = current_user_supports())
) with check (
  current_user_role() in ('manager','accounting')
  or policy_owner_id(policy_id) = auth.uid()
  or (current_user_role() = 'support' and policy_owner_id(policy_id) = current_user_supports())
);
create policy installments_delete on installment_payments for delete using (
  current_user_role() in ('manager','accounting')
  or policy_owner_id(policy_id) = auth.uid()
  or (current_user_role() = 'support' and policy_owner_id(policy_id) = current_user_supports())
);
