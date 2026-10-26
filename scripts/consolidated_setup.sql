-- 1. Create Handle Updated At Function (Generic)
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. Create Users Table
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role text not null check (role in ('client', 'admin')),
  created_at timestamptz default now()
);

alter table public.users enable row level security;

drop policy if exists "users_select_own" on public.users;
create policy "users_select_own" on public.users for select using (auth.uid() = id);

drop policy if exists "users_select_admin" on public.users;
create policy "users_select_admin" on public.users for select using (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own" on public.users for insert with check (auth.uid() = id);

-- 3. Create Function to auto-create user profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'role', 'client')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 4. Create Trigger to automatically create user profile
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- 5. Create Chats Table
create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.chats enable row level security;

drop policy if exists "chats_select_own" on public.chats;
create policy "chats_select_own" on public.chats for select to authenticated using (client_id = auth.uid());

drop policy if exists "chats_insert_own" on public.chats;
create policy "chats_insert_own" on public.chats for insert to authenticated with check (client_id = auth.uid());

drop policy if exists "chats_select_admin" on public.chats;
create policy "chats_select_admin" on public.chats for select to authenticated using (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

-- 6. Create Messages Table
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

alter table public.messages enable row level security;

drop policy if exists "messages_select_own" on public.messages;
create policy "messages_select_own" on public.messages for select to authenticated using (
  exists (select 1 from public.chats where id = chat_id and (client_id = auth.uid() or exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  )))
);

drop policy if exists "messages_insert_own" on public.messages;
create policy "messages_insert_own" on public.messages for insert to authenticated with check (
  sender_id = auth.uid() and exists (select 1 from public.chats where id = chat_id and (client_id = auth.uid() or exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  )))
);

-- 7. Create Orders Table
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.users(id) on delete cascade,
  phone_id bigint not null references public.phones(id) on delete cascade,
  amount numeric(10, 2) not null,
  payment_method text not null check (payment_method in ('telebirr', 'cbe', 'chapa', 'other')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'completed', 'failed')),
  transaction_ref text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.orders enable row level security;

drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders for select to authenticated using (client_id = auth.uid());

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own" on public.orders for insert to authenticated with check (client_id = auth.uid());

drop policy if exists "orders_admin_all" on public.orders;
create policy "orders_admin_all" on public.orders for all to authenticated using (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

-- 8. Triggers for updated_at
drop trigger if exists set_chats_updated_at on public.chats;
create trigger set_chats_updated_at before update on public.chats for each row execute function public.handle_updated_at();

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at before update on public.orders for each row execute function public.handle_updated_at();
