-- The actual amount the customer paid for a given payment reference (a combined
-- payment can cover several policies). The dashboard/payments page compares it
-- against the policy total to surface the difference (WHT withheld, a discount,
-- a short/over payment).
alter table policies add column if not exists amount_received numeric(12,2);
