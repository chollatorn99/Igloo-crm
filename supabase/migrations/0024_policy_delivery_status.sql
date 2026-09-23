-- Track the physical policy document: received from the insurer, then delivered
-- to the customer (with tracking number + send date).
alter table policies add column if not exists policy_received boolean not null default false;
alter table policies add column if not exists policy_received_date date;
alter table policies add column if not exists policy_sent boolean not null default false;
alter table policies add column if not exists tracking_number text;
alter table policies add column if not exists sent_date date;
