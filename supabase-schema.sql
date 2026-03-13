-- ============================================
-- PO Check-In App - Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Profiles table (extends Supabase Auth users)
create table public.profiles (
  id uuid references auth.users primary key,
  username text unique not null,
  display_name text,
  role text not null default 'worker', -- 'worker' or 'supervisor'
  branch text, -- optional: '10FD', '20GR', etc.
  created_at timestamptz default now()
);

-- Submissions table
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  po_number text not null,
  image_url text not null,
  image_key text not null, -- R2 storage key
  submitted_by uuid references public.profiles(id),
  submitted_username text, -- denormalized for easy display
  branch text,
  notes text,
  status text default 'pending', -- 'pending', 'reviewed', 'flagged'
  reviewer_notes text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

-- Indexes for fast lookups
create index idx_submissions_po_number on public.submissions(po_number);
create index idx_submissions_created_at on public.submissions(created_at desc);
create index idx_submissions_submitted_by on public.submissions(submitted_by);

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.submissions enable row level security;

-- ---- RLS Policies ----

-- Users can read their own profile
create policy "Users read own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

-- Supervisors can read all profiles
create policy "Supervisors read all profiles"
  on public.profiles
  for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'supervisor')
  );

-- Workers can insert submissions (only as themselves)
create policy "Workers can submit"
  on public.submissions
  for insert
  with check (auth.uid() = submitted_by);

-- Workers can read their own submissions
create policy "Workers read own submissions"
  on public.submissions
  for select
  using (auth.uid() = submitted_by);

-- Supervisors have full access to all submissions
create policy "Supervisors full access"
  on public.submissions
  for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'supervisor')
  );

-- ---- Trigger: auto-create profile on signup ----
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name, role)
  values (
    new.id,
    split_part(new.email, '@', 1),
    new.raw_user_meta_data->>'display_name',
    coalesce(new.raw_user_meta_data->>'role', 'worker')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- Initial seed users (run after schema setup)
-- Use Supabase Dashboard or /setup route to create users
-- Default users: jeffw, andrewc, nigelc, bradf, mariol
-- ============================================
