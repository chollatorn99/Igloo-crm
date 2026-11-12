-- Which daily-report layout a salesperson uses by default. Most people send the
-- general Igloo Broker report; the BRG Motors desk (พี่มุก) sends the motor
-- layout with the per-brand car breakdown. Staff can still switch per view with
-- the ทั่วไป / BRG Motors toggle; this only sets the default.
alter table profiles add column if not exists report_template text not null default 'general';

-- พี่มุก (Chanpimook) defaults to the BRG Motors layout.
update profiles set report_template = 'motor' where id = '3275c3e2-2c5e-4787-abba-54c10df39127';
