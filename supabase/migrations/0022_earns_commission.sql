-- Which salespeople personally earn the broker commission on their own book
-- (e.g. Chanpimook, the motor telesales partner) vs. those who don't (e.g.
-- Jenjira, salaried). Drives the dashboard: earners see their own commission;
-- non-earners see only agent commission + discounts; the manager books earners'
-- commission as a sales-promotion expense.
alter table profiles add column if not exists earns_commission boolean not null default false;

-- Chanpimook earns her commission.
update profiles set earns_commission = true where id = '3275c3e2-2c5e-4787-abba-54c10df39127';
