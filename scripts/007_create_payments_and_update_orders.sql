-- ==============================================================
-- Migration: Complete Setup for Orders & Chapa Payments
-- Safe to run on empty databases or existing databases
-- ==============================================================

-- 1. Create handle_updated_at helper function if missing
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. Create orders table if it doesn't exist
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  phone_id uuid,
  amount numeric(10, 2) not null,
  currency text not null default 'ETB',
  payment_method text not null check (payment_method in ('telebirr', 'cbe', 'chapa', 'other')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'completed', 'failed', 'cancelled')),
  fulfillment_status text not null default 'unfulfilled' check (fulfillment_status in ('unfulfilled', 'processing', 'fulfilled', 'cancelled')),
  transaction_ref text,
  customer_name text,
  customer_phone text,
  customer_email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Ensure newly added columns exist if the table was created previously
alter table public.orders 
  add column if not exists currency text not null default 'ETB',
  add column if not exists fulfillment_status text not null default 'unfulfilled',
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists customer_email text;

-- 3. Create payments table
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_id uuid not null,
  provider text not null default 'chapa',
  transaction_ref text unique not null,
  provider_tx_id text,
  amount numeric(10, 2) not null,
  currency text not null default 'ETB',
  status text not null default 'pending' check (status in ('pending', 'successful', 'failed', 'cancelled')),
  raw_verification jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. Fast lookup indexes
create index if not exists idx_orders_client_id on public.orders(client_id);
create index if not exists idx_orders_transaction_ref on public.orders(transaction_ref);
create index if not exists idx_payments_transaction_ref on public.payments(transaction_ref);
create index if not exists idx_payments_order_id on public.payments(order_id);
create index if not exists idx_payments_customer_id on public.payments(customer_id);

-- 5. Row Level Security (RLS)
alter table public.orders enable row level security;
alter table public.payments enable row level security;

-- Orders policies
drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders for select to authenticated using (client_id = auth.uid());

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own" on public.orders for insert to authenticated with check (client_id = auth.uid());

drop policy if exists "orders_all_admin" on public.orders;
create policy "orders_all_admin" on public.orders for all to authenticated using (true);

-- Payments policies
drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own" on public.payments for select to authenticated using (customer_id = auth.uid());

drop policy if exists "payments_all_admin" on public.payments;
create policy "payments_all_admin" on public.payments for all to authenticated using (true);

-- 6. Updated_at auto-triggers
drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at before update on public.orders for each row execute function public.handle_updated_at();

drop trigger if exists set_payments_updated_at on public.payments;
create trigger set_payments_updated_at before update on public.payments for each row execute function public.handle_updated_at();
