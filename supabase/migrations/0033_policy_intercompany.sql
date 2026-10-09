-- Mark a policy as intercompany / group work (บริษัทในเครือ) so its premium and
-- commission are shown as a SEPARATE bucket on the dashboard instead of counting
-- toward a salesperson's normal sales/commission figures. Ticked per policy at
-- entry time; defaults false so all existing policies keep counting as before.
alter table policies add column if not exists is_intercompany boolean not null default false;

create index if not exists policies_is_intercompany_idx on policies (is_intercompany) where is_intercompany;
