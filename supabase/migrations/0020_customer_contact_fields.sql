-- Extra contact fields staff can fill in per customer (telesales needs these to
-- reach people for renewals). All nullable — existing rows stay valid.
-- RLS customers_update already lets the owner / their support / a manager / a
-- shared-prospect salesperson edit the row, so no policy change is needed.
alter table customers add column if not exists email text;
alter table customers add column if not exists address text;
alter table customers add column if not exists line_id text;
