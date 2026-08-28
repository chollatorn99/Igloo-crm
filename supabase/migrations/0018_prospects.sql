-- Dealer prospects: car buyers (Kia/Deepal/BRG) whose year-1 insurance came
-- free from the manufacturer — leads to chase for renewal, NOT our sales.
--   is_prospect : excluded from sales/revenue; shown in call/win-back lists.
--   is_shared   : both salespeople may see & act (used for ≤2024 buyers);
--                 2025/2026 buyers are owned by Chanpimook only.
alter table customers add column if not exists is_prospect boolean not null default false;
alter table customers add column if not exists is_shared boolean not null default false;
alter table policies  add column if not exists is_prospect boolean not null default false;

create index if not exists customers_is_shared_idx on customers(is_shared) where is_shared;
create index if not exists policies_is_prospect_idx on policies(is_prospect);

create or replace function customer_is_shared(p_customer_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_shared from customers where id = p_customer_id), false);
$$;

-- ===== RLS: let any salesperson see & act on SHARED prospects =====
drop policy customers_select on customers;
create policy customers_select on customers for select using (
  current_user_role() = 'manager'
  or owner_id = auth.uid()
  or (current_user_role() = 'accounting' and customer_has_win_policy(customers.id))
  or (current_user_role() = 'support' and owner_id = current_user_supports())
  or (current_user_role() = 'sales' and is_shared)
);
drop policy customers_update on customers;
create policy customers_update on customers for update
  using (current_user_role() = 'manager' or owner_id = auth.uid()
         or (current_user_role() = 'support' and owner_id = current_user_supports())
         or (current_user_role() = 'sales' and is_shared))
  with check (current_user_role() = 'manager' or owner_id = auth.uid()
         or (current_user_role() = 'support' and owner_id = current_user_supports())
         or (current_user_role() = 'sales' and is_shared));

drop policy policies_select on policies;
create policy policies_select on policies for select using (
  current_user_role() = 'manager'
  or customer_owner_id(policies.customer_id) = auth.uid()
  or (current_user_role() = 'accounting' and deal_status = 'win')
  or (current_user_role() = 'support' and customer_owner_id(policies.customer_id) = current_user_supports())
  or (current_user_role() = 'sales' and customer_is_shared(policies.customer_id))
);
drop policy policies_insert on policies;
create policy policies_insert on policies for insert with check (
  current_user_role() = 'manager'
  or customer_owner_id(policies.customer_id) = auth.uid()
  or (current_user_role() = 'support' and customer_owner_id(policies.customer_id) = current_user_supports())
  or (current_user_role() = 'sales' and customer_is_shared(policies.customer_id))
);
drop policy policies_update on policies;
create policy policies_update on policies for update
  using (
    current_user_role() = 'manager' or customer_owner_id(policies.customer_id) = auth.uid()
    or (current_user_role() = 'accounting' and deal_status = 'win')
    or (current_user_role() = 'support' and customer_owner_id(policies.customer_id) = current_user_supports())
    or (current_user_role() = 'sales' and customer_is_shared(policies.customer_id))
  )
  with check (
    current_user_role() = 'manager' or customer_owner_id(policies.customer_id) = auth.uid()
    or (current_user_role() = 'accounting' and deal_status = 'win')
    or (current_user_role() = 'support' and customer_owner_id(policies.customer_id) = current_user_supports())
    or (current_user_role() = 'sales' and customer_is_shared(policies.customer_id))
  );
drop policy policies_delete on policies;
create policy policies_delete on policies for delete using (
  current_user_role() = 'manager'
  or customer_owner_id(policies.customer_id) = auth.uid()
  or (current_user_role() = 'support' and customer_owner_id(policies.customer_id) = current_user_supports())
  or (current_user_role() = 'sales' and customer_is_shared(policies.customer_id))
);

drop policy follow_up_notes_select on follow_up_notes;
create policy follow_up_notes_select on follow_up_notes for select using (
  current_user_role() = 'manager'
  or customer_owner_id(follow_up_notes.customer_id) = auth.uid()
  or (current_user_role() = 'support' and customer_owner_id(follow_up_notes.customer_id) = current_user_supports())
  or (current_user_role() = 'sales' and customer_is_shared(follow_up_notes.customer_id))
);
drop policy follow_up_notes_insert on follow_up_notes;
create policy follow_up_notes_insert on follow_up_notes for insert with check (
  author_id = auth.uid()
  and (current_user_role() = 'manager'
       or customer_owner_id(follow_up_notes.customer_id) = auth.uid()
       or (current_user_role() = 'support' and customer_owner_id(follow_up_notes.customer_id) = current_user_supports())
       or (current_user_role() = 'sales' and customer_is_shared(follow_up_notes.customer_id)))
);

-- ===== win-back view: expose is_prospect (append column) =====
create or replace view customer_winback
with (security_invoker = on) as
with base as (
  select p.* from policies p
  where p.deal_status = 'win' and p.closed_date is not null
    and p.category_id not in (select id from policy_categories where name in ('Covid', 'TA'))
),
agg as (
  select b.customer_id, count(*) as policy_count, coalesce(sum(b.net_premium),0) as total_premium,
    max(extract(year from b.closed_date))::int as latest_year,
    count(distinct extract(year from b.closed_date))::int as years_count,
    bool_or(b.coverage_end_date >= current_date) as active,
    bool_or(b.renewal_outcome='not_renewed') as not_renewed,
    bool_or(b.renewal_outcome='renewed') as renewed,
    string_agg(distinct b.policy_detail, ' | ') as all_details
  from base b group by b.customer_id
),
latest as (
  select distinct on (b.customer_id) b.customer_id, b.category_id as last_category_id,
    pc.name as last_category, b.insurance_company as last_insurer, b.net_premium as last_premium,
    b.coverage_end_date as last_coverage_end
  from base b left join policy_categories pc on pc.id=b.category_id
  order by b.customer_id, b.closed_date desc, b.created_at desc
)
select c.id as customer_id, c.name, c.phone, c.owner_id,
  a.policy_count, a.total_premium, a.latest_year, a.years_count, a.active, a.not_renewed, a.renewed,
  l.last_category_id, l.last_category, l.last_insurer, l.last_premium, l.last_coverage_end,
  case when l.last_coverage_end is null then 999 else (
    extract(doy from make_date(2001, extract(month from l.last_coverage_end)::int, extract(day from l.last_coverage_end)::int))::int
    - extract(doy from make_date(2001, extract(month from current_date)::int, extract(day from current_date)::int))::int + 366) % 366
  end as anniv_offset,
  a.all_details, c.is_prospect
from customers c join agg a on a.customer_id=c.id join latest l on l.customer_id=c.id;
grant select on customer_winback to authenticated;
