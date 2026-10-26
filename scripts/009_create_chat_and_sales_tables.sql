-- ==============================================================
-- 009: Realtime Live Chat (Chats & Messages) & Sales Table
-- Run this in your Supabase SQL Editor
-- ==============================================================

-- 0. Ensure user_profiles has all current auth users and admin role
insert into public.user_profiles (id, email, role)
select 
  id, 
  email, 
  case when email = 'yohannesm294@gmail.com' then 'admin' else coalesce(raw_user_meta_data ->> 'role', 'client') end
from auth.users
on conflict (id) do update set 
  role = case when excluded.email = 'yohannesm294@gmail.com' then 'admin' else public.user_profiles.role end;

-- Helper function to check if the current user is an admin without recursion
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 1. Create chats table
create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.user_profiles(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_chats_client_id on public.chats(client_id);
create index if not exists idx_chats_updated_at on public.chats(updated_at desc);

-- Enable RLS and full replica identity for realtime
alter table public.chats enable row level security;
alter table public.chats replica identity full;

-- Drop old policies if any
drop policy if exists "chats_select_own" on public.chats;
drop policy if exists "chats_select_admin" on public.chats;
drop policy if exists "chats_insert_own" on public.chats;
drop policy if exists "chats_insert_admin" on public.chats;
drop policy if exists "chats_update_all" on public.chats;
drop policy if exists "chats_all_admin" on public.chats;

-- Clients can see their own chats, admins can see all chats
create policy "chats_select_own"
  on public.chats for select
  to authenticated
  using (
    client_id = auth.uid() or public.is_admin()
  );

-- Clients can create chats for themselves, admins can create chats
create policy "chats_insert_own"
  on public.chats for insert
  to authenticated
  with check (
    client_id = auth.uid() or public.is_admin()
  );

-- Both clients and admins can update updated_at on chats
create policy "chats_update_all"
  on public.chats for update
  to authenticated
  using (
    client_id = auth.uid() or public.is_admin()
  );

-- 2. Create messages table
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid not null references public.user_profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

create index if not exists idx_messages_chat_id on public.messages(chat_id);
create index if not exists idx_messages_created_at on public.messages(created_at asc);

-- Enable RLS and full replica identity for realtime
alter table public.messages enable row level security;
alter table public.messages replica identity full;

-- Drop old policies if any
drop policy if exists "messages_select_own" on public.messages;
drop policy if exists "messages_insert_own" on public.messages;
drop policy if exists "messages_select" on public.messages;
drop policy if exists "messages_insert" on public.messages;

-- Users can see messages if they are the admin or if the chat belongs to them
create policy "messages_select"
  on public.messages for select
  to authenticated
  using (
    public.is_admin() or
    exists (
      select 1 from public.chats
      where id = chat_id and client_id = auth.uid()
    )
  );

-- Authenticated users can insert messages into their own chat (or any chat if admin)
create policy "messages_insert"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid() and (
      public.is_admin() or
      exists (
        select 1 from public.chats
        where id = chat_id and client_id = auth.uid()
      )
    )
  );

-- 3. Create updated_at trigger function if not exists
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_chats_updated_at on public.chats;
create trigger set_chats_updated_at
  before update on public.chats
  for each row
  execute function public.handle_updated_at();

-- 4. Enable Supabase Realtime for live instant messaging
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  begin
    alter publication supabase_realtime add table public.chats;
  exception when duplicate_object then
    null;
  end;
  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then
    null;
  end;
end $$;

-- 5. Create sales table for Reports Dashboard
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  phone_id uuid not null references public.phones(id) on delete cascade,
  sold_quantity integer not null default 0,
  inventory_quantity integer not null default 0,
  sale_date timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.sales enable row level security;

drop policy if exists "sales_select_all" on public.sales;
create policy "sales_select_all"
  on public.sales for select
  to authenticated
  using (true);

drop policy if exists "sales_admin_all" on public.sales;
create policy "sales_admin_all"
  on public.sales for all
  to authenticated
  using (public.is_admin());
