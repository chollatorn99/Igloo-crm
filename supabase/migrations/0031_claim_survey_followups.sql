-- Two follow-up stages after the surveyor's inspection: chasing the survey
-- result, and following up with the customer.
alter table claims add column if not exists survey_followup_date date;
alter table claims add column if not exists survey_followup_note text;
alter table claims add column if not exists customer_followup_date date;
alter table claims add column if not exists customer_followup_note text;
