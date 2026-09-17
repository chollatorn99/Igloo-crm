-- Group health/life corporate accounts book many mid-term "สลักหลัง"
-- (endorsement) rows — member add/remove adjustments — alongside the main
-- annual policy. They keep their premium (still counted as sales) but should
-- NOT each surface as a separate renewal reminder; only the main policy drives
-- the reminder. This flag marks the endorsement rows so the reminders page
-- filters them out.
alter table policies add column if not exists is_endorsement boolean not null default false;
create index if not exists policies_is_endorsement_idx on policies(is_endorsement) where is_endorsement;
