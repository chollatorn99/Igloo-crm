-- Branch / site label on a policy. For commercial accounts that span several
-- sites (e.g. a petrol-station chain buying IAR + PL + พ.ร.บ. + ประกันเงิน per
-- branch), this lets the daily report count one unit per branch instead of one
-- per policy. Blank for ordinary single-site / motor policies.
alter table policies add column if not exists branch_name text;
