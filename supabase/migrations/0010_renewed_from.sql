-- Link a renewal policy back to the one it renewed, so deleting the renewal
-- can automatically return the original to the "รอติดตาม" reminder list.
-- Without this, deleting a mistaken renewal left the old policy stuck as
-- renewal_outcome='renewed' and it silently vanished from /renewals.
alter table policies
  add column renewed_from_policy_id uuid references policies(id) on delete set null;
