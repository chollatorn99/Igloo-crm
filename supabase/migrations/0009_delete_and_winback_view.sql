-- (1) Allow deleting a policy when it was created by mistake. Same scope as
-- editing: the owning salesperson or a manager. (There was no DELETE policy
-- before, so RLS denied all deletes.) payment_status_log rows cascade.
create policy policies_delete on policies for delete
  using (
    current_user_role() = 'manager'
    or customer_owner_id(policies.customer_id) = auth.uid()
  );

-- (2) Speed: the win-back page used to pull ALL ~6,000 win policies to the
-- server and aggregate per-customer in JS on every load. This view does the
-- aggregation in Postgres so the page can fetch one paginated slice (50 rows)
-- instead. security_invoker = on makes the base-table RLS apply to the caller,
-- so sales still see only their own customers.
create or replace view customer_winback
with (security_invoker = on) as
with agg as (
  select
    p.customer_id,
    count(*)                                            as policy_count,
    coalesce(sum(p.net_premium), 0)                     as total_premium,
    max(extract(year from p.closed_date))::int          as latest_year,
    count(distinct extract(year from p.closed_date))::int as years_count,
    bool_or(p.coverage_end_date >= current_date)        as active,
    bool_or(p.renewal_outcome = 'not_renewed')          as not_renewed,
    bool_or(p.renewal_outcome = 'renewed')              as renewed
  from policies p
  where p.deal_status = 'win' and p.closed_date is not null
  group by p.customer_id
),
latest as (
  -- newest policy per customer (drives the "last ..." columns)
  select distinct on (p.customer_id)
    p.customer_id,
    p.category_id                    as last_category_id,
    pc.name                          as last_category,
    p.insurance_company              as last_insurer,
    p.net_premium                    as last_premium,
    p.coverage_end_date              as last_coverage_end
  from policies p
  left join policy_categories pc on pc.id = p.category_id
  where p.deal_status = 'win' and p.closed_date is not null
  order by p.customer_id, p.closed_date desc, p.created_at desc
)
select
  c.id as customer_id, c.name, c.phone, c.owner_id,
  a.policy_count, a.total_premium, a.latest_year, a.years_count,
  a.active, a.not_renewed, a.renewed,
  l.last_category_id, l.last_category, l.last_insurer, l.last_premium, l.last_coverage_end,
  -- days from today to the next anniversary of the latest expiry, ignoring
  -- the year (policies are 1-year) — same ordering as the renewals page.
  case
    when l.last_coverage_end is null then 999
    else (
      extract(doy from make_date(2001,
        extract(month from l.last_coverage_end)::int,
        extract(day   from l.last_coverage_end)::int))::int
      - extract(doy from make_date(2001,
        extract(month from current_date)::int,
        extract(day   from current_date)::int))::int
      + 366
    ) % 366
  end as anniv_offset
from customers c
join agg a    on a.customer_id = c.id
join latest l on l.customer_id = c.id;

grant select on customer_winback to authenticated;
