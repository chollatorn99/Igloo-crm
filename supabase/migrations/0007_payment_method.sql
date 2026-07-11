-- How the customer actually paid, captured when reporting a transfer.
-- installment_count / installment_amount are used for credit-card
-- installments and pay-with-Igloo installment plans.
create type payment_method as enum (
  'transfer_igloo',    -- โอนเข้าอิกลู
  'transfer_insurer',  -- โอนให้บริษัทประกันโดยตรง
  'credit_card',       -- บัตรเครดิต (อาจผ่อน)
  'installment_igloo'  -- ผ่อนกับอิกลู
);

alter table policies
  add column payment_method payment_method,
  add column installment_count integer,
  add column installment_amount numeric(12,2);
