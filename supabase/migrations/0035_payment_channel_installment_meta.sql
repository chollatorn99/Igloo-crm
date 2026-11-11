-- (B) How the customer actually paid — recorded in the payment queue. Free text;
-- the UI offers a fixed list including "จ่ายตรงกับบริษัทประกัน" (Igloo never
-- collected the premium).
alter table policies add column if not exists payment_channel text;

-- (C) Installment program metadata:
--   installment_with: ผ่อนกับใคร — 'igloo' หรือ 'insurer' (บริษัทประกัน)
--   installment_interest_rate: ดอกเบี้ย % ต่อโปรแกรม (0 = 0% ไม่มีดอกเบี้ย)
alter table policies add column if not exists installment_with text;
alter table policies add column if not exists installment_interest_rate numeric(5,2) not null default 0;
