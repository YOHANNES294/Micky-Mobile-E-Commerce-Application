-- Create users table with role support
-- Note: Supabase Auth handles the actual authentication
-- We'll use user_metadata to store the role (client/admin)
-- This is a reference table for additional user data if needed

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role text not null check (role in ('client', 'admin')),
  created_at timestamptz default now()
);

alter table public.users enable row level security;

-- Allow users to read their own data
create policy "users_select_own"
  on public.users for select
  using (auth.uid() = id);

-- Allow users to insert their own data (triggered on signup)
create policy "users_insert_own"
  on public.users for insert
  with check (auth.uid() = id);

-- Create function to auto-create user profile on signup
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

-- Create trigger to automatically create user profile
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
