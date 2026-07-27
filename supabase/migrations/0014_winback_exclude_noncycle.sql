-- Hide non-renewal-cycle products (Covid = discontinued, TA = ad-hoc) from the
-- win-back / lapsed list. Recreate customer_winback excluding those categories
-- from the aggregation, so a Covid/TA-only customer drops off and mixed
-- customers reflect only their renewable policies. (Policies stay in the DB;
-- sales totals/history are unaffected.)
create or replace view customer_winback
with (security_invoker = on) as
with base as (
  select p.*
  from policies p
  where p.deal_status = 'win' and p.closed_date is not null
    and p.category_id not in (select id from policy_categories where name in ('Covid', 'TA'))
),
agg as (
  select
    b.customer_id,
    count(*)                                            as policy_count,
    coalesce(sum(b.net_premium), 0)                     as total_premium,
    max(extract(year from b.closed_date))::int          as latest_year,
    count(distinct extract(year from b.closed_date))::int as years_count,
    bool_or(b.coverage_end_date >= current_date)        as active,
    bool_or(b.renewal_outcome = 'not_renewed')          as not_renewed,
    bool_or(b.renewal_outcome = 'renewed')              as renewed
  from base b
  group by b.customer_id
),
latest as (
  select distinct on (b.customer_id)
    b.customer_id,
    b.category_id                    as last_category_id,
    pc.name                          as last_category,
    b.insurance_company              as last_insurer,
    b.net_premium                    as last_premium,
    b.coverage_end_date              as last_coverage_end
  from base b
  left join policy_categories pc on pc.id = b.category_id
  order by b.customer_id, b.closed_date desc, b.created_at desc
)
select
  c.id as customer_id, c.name, c.phone, c.owner_id,
  a.policy_count, a.total_premium, a.latest_year, a.years_count,
  a.active, a.not_renewed, a.renewed,
  l.last_category_id, l.last_category, l.last_insurer, l.last_premium, l.last_coverage_end,
  case
    when l.last_coverage_end is null then 999
    else (
      extract(doy from make_date(2001, extract(month from l.last_coverage_end)::int, extract(day from l.last_coverage_end)::int))::int
      - extract(doy from make_date(2001, extract(month from current_date)::int, extract(day from current_date)::int))::int
      + 366
    ) % 366
  end as anniv_offset
from customers c
join agg a    on a.customer_id = c.id
join latest l on l.customer_id = c.id;

grant select on customer_winback to authenticated;
