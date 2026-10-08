-- Claims tracking: customers complained about claims not being followed up, so
-- this records each claim's progress through its stages (with a date per stage),
-- free-text notes, and a next-follow-up date that drives a reminder list.
--   stages: reported → insurer_notified → survey → quote → negotiate → agreed → paid
create table if not exists claims (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  policy_id uuid references policies(id) on delete set null,
  owner_id uuid not null references profiles(id),      -- responsible salesperson
  claim_number text,
  status text not null default 'reported',
  detail text,                                         -- what happened / vehicle / damage
  claim_amount numeric(12,2),
  reported_date date,          -- ลูกค้าแจ้งเคลม
  insurer_reported_date date,  -- แจ้งประกัน
  survey_date date,            -- survey เข้าสำรวจ
  quote_date date,             -- ช่างเสนอราคา
  negotiate_date date,         -- ต่อรอง
  agreed_date date,            -- ตกลง
  paid_date date,              -- จ่าย
  next_followup_date date,     -- ติดตามครั้งถัดไป (ขับเคลื่อนการแจ้งเตือน)
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists claims_owner_idx on claims(owner_id);
create index if not exists claims_followup_idx on claims(next_followup_date);
create index if not exists claims_customer_idx on claims(customer_id);

-- Security-definer helper (mirrors customer_owner_id) so claim_notes RLS can
-- check the parent claim's owner without recursive RLS.
create or replace function claim_owner_id(p_claim_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select owner_id from claims where id = p_claim_id;
$$;

alter table claims enable row level security;
create policy claims_select on claims for select using (
  current_user_role() = 'manager'
  or owner_id = auth.uid()
  or (current_user_role() = 'support' and owner_id = current_user_supports())
  or current_user_role() = 'accounting'
);
create policy claims_insert on claims for insert with check (
  current_user_role() = 'manager'
  or owner_id = auth.uid()
  or (current_user_role() = 'support' and owner_id = current_user_supports())
);
create policy claims_update on claims for update using (
  current_user_role() = 'manager'
  or owner_id = auth.uid()
  or (current_user_role() = 'support' and owner_id = current_user_supports())
) with check (
  current_user_role() = 'manager'
  or owner_id = auth.uid()
  or (current_user_role() = 'support' and owner_id = current_user_supports())
);
create policy claims_delete on claims for delete using (
  current_user_role() = 'manager' or created_by = auth.uid()
);

create table if not exists claim_notes (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references claims(id) on delete cascade,
  author_id uuid not null references profiles(id),
  note_text text not null,
  created_at timestamptz not null default now()
);
create index if not exists claim_notes_claim_idx on claim_notes(claim_id);

alter table claim_notes enable row level security;
create policy claim_notes_select on claim_notes for select using (
  current_user_role() = 'manager'
  or claim_owner_id(claim_notes.claim_id) = auth.uid()
  or (current_user_role() = 'support' and claim_owner_id(claim_notes.claim_id) = current_user_supports())
  or current_user_role() = 'accounting'
);
create policy claim_notes_insert on claim_notes for insert with check (
  author_id = auth.uid() and (
    current_user_role() = 'manager'
    or claim_owner_id(claim_notes.claim_id) = auth.uid()
    or (current_user_role() = 'support' and claim_owner_id(claim_notes.claim_id) = current_user_supports())
  )
);
