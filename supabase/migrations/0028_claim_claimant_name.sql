-- For group health policies the customer is the company, but the actual
-- claimant is an individual member — record their name on the claim.
alter table claims add column if not exists claimant_name text;
