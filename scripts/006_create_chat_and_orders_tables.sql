-- Create chats table
create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS on chats
alter table public.chats enable row level security;

-- Clients can see their own chats
create policy "chats_select_own"
  on public.chats for select
  to authenticated
  using (client_id = auth.uid());

-- Clients can create their own chats
create policy "chats_insert_own"
  on public.chats for insert
  to authenticated
  with check (client_id = auth.uid());

-- Admins can see all chats
create policy "chats_select_admin"
  on public.chats for select
  to authenticated
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- Create messages table
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

-- Enable RLS on messages
alter table public.messages enable row level security;

-- Users can see messages in their own chats
create policy "messages_select_own"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.chats
      where id = chat_id and (client_id = auth.uid() or exists (
        select 1 from public.users
        where id = auth.uid() and role = 'admin'
      ))
    )
  );

-- Users can insert messages in their own chats
create policy "messages_insert_own"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid() and
    exists (
      select 1 from public.chats
      where id = chat_id and (client_id = auth.uid() or exists (
        select 1 from public.users
        where id = auth.uid() and role = 'admin'
      ))
    )
  );

-- Create orders table
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.users(id) on delete cascade,
  phone_id uuid not null references public.phones(id) on delete cascade,
  amount numeric(10, 2) not null,
  payment_method text not null check (payment_method in ('telebirr', 'cbe', 'chapa', 'other')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'completed', 'failed')),
  transaction_ref text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS on orders
alter table public.orders enable row level security;

-- Clients can see their own orders
create policy "orders_select_own"
  on public.orders for select
  to authenticated
  using (client_id = auth.uid());

-- Clients can create their own orders
create policy "orders_insert_own"
  on public.orders for insert
  to authenticated
  with check (client_id = auth.uid());

-- Admins can see and update all orders
create policy "orders_admin_all"
  on public.orders for all
  to authenticated
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- Trigger for updated_at on chats
create trigger set_chats_updated_at
  before update on public.chats
  for each row
  execute function public.handle_updated_at();

-- Trigger for updated_at on orders
create trigger set_orders_updated_at
  before update on public.orders
  for each row
  execute function public.handle_updated_at();
