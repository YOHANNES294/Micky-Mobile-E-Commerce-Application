-- ==============================================================
-- Migration 012: AliExpress-Style Order Workflow & Tracking Timeline
-- Safe, idempotent migration for Micky Mobile Ethiopia
-- ==============================================================

-- 1. Extend orders table with rich workflow, tracking and timeline columns
alter table public.orders
  add column if not exists order_status text not null default 'placed',
  add column if not exists items jsonb default '[]'::jsonb,
  add column if not exists pickup_method text default 'pickup',
  add column if not exists delivery_address text,
  add column if not exists shipping_carrier text,
  add column if not exists tracking_number text,
  add column if not exists estimated_delivery text,
  add column if not exists delivery_notes text,
  add column if not exists status_history jsonb default '[]'::jsonb;

-- Ensure constraint on order_status
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_order_status_check'
  ) then
    alter table public.orders 
      add constraint orders_order_status_check 
      check (order_status in ('placed', 'payment_confirmed', 'confirmed', 'processing', 'ready_for_dispatch', 'shipped', 'delivered', 'cancelled', 'refunded'));
  end if;
end;
$$;

-- Ensure constraint on pickup_method
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_pickup_method_check'
  ) then
    alter table public.orders 
      add constraint orders_pickup_method_check 
      check (pickup_method in ('pickup', 'delivery'));
  end if;
end;
$$;

-- 2. Create order_status_history table for immutable audit trail
create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  title text,
  notes text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- Fast lookup indexes
create index if not exists idx_orders_order_status on public.orders(order_status);
create index if not exists idx_orders_client_status on public.orders(client_id, order_status);
create index if not exists idx_order_status_history_order_id on public.order_status_history(order_id);
create index if not exists idx_order_status_history_created_at on public.order_status_history(created_at asc);

-- 3. Row Level Security for order_status_history
alter table public.order_status_history enable row level security;

-- Customers can view status history for their own orders
drop policy if exists "status_history_select_own" on public.order_status_history;
create policy "status_history_select_own"
  on public.order_status_history for select
  to authenticated
  using (
    exists (
      select 1 from public.orders
      where public.orders.id = public.order_status_history.order_id
        and (public.orders.client_id = auth.uid() or public.is_admin())
    )
  );

-- Admins can insert status history
drop policy if exists "status_history_insert_admin" on public.order_status_history;
create policy "status_history_insert_admin"
  on public.order_status_history for insert
  to authenticated
  with check (
    public.is_admin()
  );

-- 4. Enable Realtime Replication for orders and status history
alter table public.orders replica identity full;
alter table public.order_status_history replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.orders;
  exception when duplicate_object then
    null;
  end;
  begin
    alter publication supabase_realtime add table public.order_status_history;
  exception when duplicate_object then
    null;
  end;
end;
$$;

-- 5. Backfill existing orders with sensible default order_status & initial milestone
update public.orders
set 
  order_status = case 
    when payment_status in ('completed', 'successful') and fulfillment_status = 'fulfilled' then 'delivered'
    when payment_status in ('completed', 'successful') and fulfillment_status = 'processing' then 'processing'
    when payment_status in ('completed', 'successful') then 'payment_confirmed'
    when payment_status = 'cancelled' or fulfillment_status = 'cancelled' then 'cancelled'
    else 'placed'
  end,
  status_history = case
    when jsonb_array_length(coalesce(status_history, '[]'::jsonb)) = 0 then
      jsonb_build_array(
        jsonb_build_object(
          'status', 'placed',
          'title', 'Order Placed',
          'description', 'Order created in Micky Mobile store',
          'timestamp', created_at
        ),
        case 
          when payment_status in ('completed', 'successful') then
            jsonb_build_object(
              'status', 'payment_confirmed',
              'title', 'Payment Confirmed',
              'description', 'Payment verified securely with Chapa',
              'timestamp', coalesce(updated_at, created_at)
            )
          else null
        end
      ) - 'null'
    else status_history
  end
where order_status is null or order_status = 'placed';
