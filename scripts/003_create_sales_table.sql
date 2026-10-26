-- Create sales/reports table for tracking inventory and sales
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  phone_id uuid not null references public.phones(id) on delete cascade,
  sold_quantity integer not null default 0,
  inventory_quantity integer not null default 0,
  sale_date timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.sales enable row level security;

-- Allow all authenticated users to read sales data
create policy "sales_select_all"
  on public.sales for select
  to authenticated
  using (true);

-- Only admins can manage sales data
create policy "sales_insert_admin"
  on public.sales for insert
  to authenticated
  with check (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "sales_update_admin"
  on public.sales for update
  to authenticated
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "sales_delete_admin"
  on public.sales for delete
  to authenticated
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );
