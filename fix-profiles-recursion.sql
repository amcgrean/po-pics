-- ============================================================
-- FINAL FIX: Infinite recursion in profiles RLS policy
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Create a recursion-proof role check function
create or replace function public.get_my_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  -- Checks JWT metadata first (fast, zero recursion risk)
  -- Falls back to table lookup if metadata is missing
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role', ''),
    (select role from public.profiles where id = auth.uid()),
    'worker'
  )::text
$$;

-- 2. Drop existing policies to ensure a clean state
drop policy if exists "Users read own profile" on public.profiles;
drop policy if exists "Supervisors read all profiles" on public.profiles;
drop policy if exists "Supervisors full access" on public.submissions;
drop policy if exists "Workers can submit" on public.submissions;
drop policy if exists "Workers read own submissions" on public.submissions;

-- 3. Profiles policies
-- Simple check for own profile (never recurses)
create policy "Users read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Use helper for supervisor check
create policy "Supervisors read all profiles"
  on public.profiles for select
  using (public.get_my_role() = 'supervisor');

-- 4. Submissions policies
create policy "Workers can submit"
  on public.submissions for insert
  with check (auth.uid() = submitted_by);

create policy "Workers read own submissions"
  on public.submissions for select
  using (auth.uid() = submitted_by);

create policy "Supervisors full access"
  on public.submissions for all
  using (public.get_my_role() = 'supervisor');
