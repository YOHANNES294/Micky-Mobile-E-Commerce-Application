-- ==============================================================
-- 011: Complete AliExpress-Style Notifications System
-- Tables: notifications, notification_preferences, push_subscriptions, email_logs
-- Run this in your Supabase SQL Editor
-- ==============================================================

-- 1. Create notifications table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  title text not null,
  message text not null,
  category text not null check (category in ('orders', 'messages', 'products', 'promotions', 'account')),
  target_type text default 'url', -- 'order', 'chat', 'phone', 'url'
  target_id text,
  is_read boolean not null default false,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Fast lookup indexes
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_is_read on public.notifications(is_read);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);

-- 1b. Ensure messages table has persistent is_read tracking
alter table public.messages add column if not exists is_read boolean not null default false;
create index if not exists idx_messages_unread on public.messages(chat_id, is_read) where is_read = false;

drop policy if exists "messages_update" on public.messages;
create policy "messages_update"
  on public.messages for update
  to authenticated
  using (
    public.is_admin() or
    exists (
      select 1 from public.chats
      where id = chat_id and client_id = auth.uid()
    )
  );

-- 2. Create notification_preferences table
create table if not exists public.notification_preferences (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  in_app_enabled boolean not null default true,
  push_enabled boolean not null default true,
  email_enabled boolean not null default true,
  order_updates boolean not null default true,
  support_messages boolean not null default true,
  promotional_updates boolean not null default false,
  sound_enabled boolean not null default true,
  dont_ask_again boolean not null default false,
  updated_at timestamptz not null default now()
);

-- 3. Create push_subscriptions table
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text,
  auth text,
  device_type text not null default 'web' check (device_type in ('web', 'android', 'ios')),
  device_token text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_user_endpoint unique(user_id, endpoint)
);

create index if not exists idx_push_subs_user on public.push_subscriptions(user_id);

-- 4. Create email_logs table for transactional email tracking
create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.user_profiles(id) on delete set null,
  recipient_email text not null,
  subject text not null,
  category text not null,
  status text not null check (status in ('sent', 'failed', 'pending_config')),
  error_message text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_logs_recipient on public.email_logs(recipient_email);
create index if not exists idx_email_logs_created on public.email_logs(created_at desc);

-- 5. Enable Row Level Security (RLS)
alter table public.notifications enable row level security;
alter table public.notifications replica identity full;

alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.email_logs enable row level security;

-- Drop old policies if any
drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_insert_all" on public.notifications;
drop policy if exists "notifications_update_own" on public.notifications;
drop policy if exists "notifications_delete_own" on public.notifications;

drop policy if exists "prefs_select_own" on public.notification_preferences;
drop policy if exists "prefs_upsert_own" on public.notification_preferences;

drop policy if exists "push_subs_select_own" on public.push_subscriptions;
drop policy if exists "push_subs_insert_own" on public.push_subscriptions;
drop policy if exists "push_subs_delete_own" on public.push_subscriptions;

drop policy if exists "email_logs_admin" on public.email_logs;

-- Policies for notifications:
-- Users see only their own notifications
create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- System or authenticated users can create notifications
create policy "notifications_insert_all"
  on public.notifications for insert
  to authenticated
  with check (true);

-- Users can update (mark as read) their own notifications
create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Users can delete their own notifications
create policy "notifications_delete_own"
  on public.notifications for delete
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Policies for preferences:
create policy "prefs_select_own"
  on public.notification_preferences for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "prefs_upsert_own"
  on public.notification_preferences for all
  to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- Policies for push subscriptions:
create policy "push_subs_select_own"
  on public.push_subscriptions for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "push_subs_insert_own"
  on public.push_subscriptions for all
  to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- Policies for email logs:
create policy "email_logs_admin"
  on public.email_logs for select
  to authenticated
  using (public.is_admin());

-- Enable Realtime publication for notifications table
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
