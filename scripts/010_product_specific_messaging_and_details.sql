-- ==============================================================
-- 010: Product-Specific Messaging & Phone Specifications Migration
-- Run this in your Supabase SQL Editor
-- ==============================================================

-- 1. Enhance chats table with product reference and status
alter table public.chats 
  add column if not exists phone_id uuid references public.phones(id) on delete set null,
  add column if not exists status text default 'open',
  add column if not exists product_snapshot jsonb;

create index if not exists idx_chats_phone_id on public.chats(phone_id);
create index if not exists idx_chats_status on public.chats(status);

-- 2. Enhance phones table with condition, battery health, inspection and warranty fields
alter table public.phones 
  add column if not exists condition text default 'New',
  add column if not exists battery_health text,
  add column if not exists defects text,
  add column if not exists warranty text default '1 Year Official Micky Mobile Warranty',
  add column if not exists stock integer default 5,
  add column if not exists colors text default 'Default',
  add column if not exists display text,
  add column if not exists camera text,
  add column if not exists os text;

-- 3. Populate default condition & warranty for existing records if null
update public.phones set condition = 'New' where condition is null;
update public.phones set warranty = '1 Year Official Micky Mobile Warranty' where warranty is null;
update public.phones set stock = 5 where stock is null;
