-- Create phones table for Samsung and iPhone products
create table if not exists public.phones (
  id uuid primary key default gen_random_uuid(),
  brand text not null check (brand in ('Samsung', 'iPhone')),
  model text not null,
  storage text not null,
  ram text not null,
  battery text, -- Only for iPhone
  sim text not null,
  price numeric(10, 2) not null,
  image text,
  message text, -- Additional message/description for the phone
  start_date timestamptz default now(),
  end_date timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.phones enable row level security;

-- Allow all authenticated users to read phones
create policy "phones_select_all"
  on public.phones for select
  to authenticated
  using (true);

-- Only admins can insert phones
create policy "phones_insert_admin"
  on public.phones for insert
  to authenticated
  with check (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- Only admins can update phones
create policy "phones_update_admin"
  on public.phones for update
  to authenticated
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- Only admins can delete phones
create policy "phones_delete_admin"
  on public.phones for delete
  to authenticated
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- Create function to auto-update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Create trigger to auto-update updated_at
drop trigger if exists set_updated_at on public.phones;

create trigger set_updated_at
  before update on public.phones
  for each row
  execute function public.handle_updated_at();
