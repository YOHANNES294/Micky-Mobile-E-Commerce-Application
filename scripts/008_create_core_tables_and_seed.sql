-- ==============================================================
-- 008: Core Schema & Seed for User Profiles and Phones Inventory
-- Run this in Supabase SQL Editor
-- ==============================================================

-- 1. Create user_profiles table
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role text not null default 'client' check (role in ('client', 'admin')),
  created_at timestamptz default now()
);

alter table public.user_profiles enable row level security;

drop policy if exists "user_profiles_select_all" on public.user_profiles;
create policy "user_profiles_select_all" on public.user_profiles for select to authenticated using (true);

drop policy if exists "user_profiles_update_own" on public.user_profiles;
create policy "user_profiles_update_own" on public.user_profiles for update to authenticated using (auth.uid() = id);

drop policy if exists "user_profiles_insert_own" on public.user_profiles;
create policy "user_profiles_insert_own" on public.user_profiles for insert to authenticated with check (auth.uid() = id);

-- Ensure public.users view points to user_profiles for backwards compatibility
create or replace view public.users as select * from public.user_profiles;

-- 2. Create trigger to auto-create user_profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'role', 'client')
  )
  on conflict (id) do update set 
    role = coalesce(new.raw_user_meta_data ->> 'role', public.user_profiles.role);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Insert existing users from auth.users into user_profiles
insert into public.user_profiles (id, email, role)
select 
  id, 
  email, 
  case when email = 'yohannesm294@gmail.com' then 'admin' else coalesce(raw_user_meta_data ->> 'role', 'client') end
from auth.users
on conflict (id) do update set 
  role = excluded.role;

-- 3. Create phones table
create table if not exists public.phones (
  id uuid primary key default gen_random_uuid(),
  brand text not null check (brand in ('Samsung', 'iPhone')),
  model text not null,
  storage text not null,
  ram text not null,
  battery text, -- Only for iPhone
  network text, -- Only for Samsung
  sim text not null,
  price text not null,
  image text,
  message text,
  start_date timestamptz default now(),
  end_date timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.phones enable row level security;

drop policy if exists "phones_select_all" on public.phones;
create policy "phones_select_all" on public.phones for select to authenticated using (true);

drop policy if exists "phones_admin_all" on public.phones;
create policy "phones_admin_all" on public.phones for all to authenticated using (true);

-- 4. Seed Phones for Micky Mobile marketplace
insert into public.phones (brand, model, storage, ram, battery, network, sim, price, image, message)
values
  ('Samsung', 'Galaxy S24 Ultra', '512GB', '12GB', null, '5G', 'Dual SIM', '135,000', 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800', 'Titanium Gray, 200MP Camera, S-Pen included'),
  ('Samsung', 'Galaxy S23 FE', '256GB', '8GB', null, '5G', 'Dual SIM', '62,000', 'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=800', 'Mint Green, Brand new in box with warranty'),
  ('iPhone', 'iPhone 15 Pro Max', '256GB', '8GB', '4422 mAh', null, 'Nano-SIM + eSIM', '140,000', 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800', 'Natural Titanium, A17 Pro Chip, 100% Battery health'),
  ('iPhone', 'iPhone 14 Pro', '128GB', '6GB', '3200 mAh', null, 'Dual SIM', '85,000', 'https://images.unsplash.com/photo-1663499482523-1c0c1bae4ce1?w=800', 'Deep Purple, Dynamic Island, Premium condition')
on conflict do nothing;
