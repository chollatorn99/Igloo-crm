-- (1) Company customers sometimes withhold 1% tax (หัก ณ ที่จ่าย) on the net
-- premium. A boolean flag drives a generated 1%-of-net-premium amount, so it
-- always tracks the premium and needs no manual recalculation.
alter table policies add column withholding_tax_1pct boolean not null default false;

-- The original withholding_tax_amount was a plain unused column (default 0).
-- Replace it with a generated column so ticking the box computes it. Nothing
-- references it (net_commission_to_igloo / customer_winback don't), so the
-- drop is safe.
alter table policies drop column withholding_tax_amount;
alter table policies add column withholding_tax_amount numeric(12,2)
  generated always as (
    case when withholding_tax_1pct then round(coalesce(net_premium, 0) * 0.01, 2) else 0 end
  ) stored;

-- (2) Agents' commission is paid net of a 3% withholding tax. Store the 3%
-- amount as a generated column; the net-to-agent is shown in the UI as
-- agent_commission_amount − agent_wht_amount (kept in the UI so gross/wht/net
-- always reconcile without double-rounding).
alter table policies add column agent_wht_amount numeric(12,2)
  generated always as (
    round(coalesce(net_premium, 0) * coalesce(agent_commission_rate, 0) / 100 * 0.03, 2)
  ) stored;
