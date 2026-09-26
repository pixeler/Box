-- ====================================================================
-- SpaceZen / MiniPini: Supabase Cloud Sync Schema
-- Run this in your Supabase Dashboard -> SQL Editor -> New Query
-- ====================================================================

-- 1. Create user_sync table
create table if not exists public.user_sync (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2. Enable Row Level Security (RLS)
alter table public.user_sync enable row level security;

-- 3. Policy: Allow users to view only their own sync data
create policy "Allow users to read their own sync data"
  on public.user_sync
  for select
  using (auth.uid() = user_id);

-- 4. Policy: Allow users to insert/update only their own sync data
create policy "Allow users to insert/update their own sync data"
  on public.user_sync
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Confirmation comment
comment on table public.user_sync is 'Stores synced tasks, notes, and preferences per user';
