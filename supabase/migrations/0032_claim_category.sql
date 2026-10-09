-- Let staff pick the insurance type of a claim directly (drives the close-by
-- SLA: health/golf 14 days, else 30), independent of whether a policy is linked.
alter table claims add column if not exists category_id uuid references policy_categories(id);
