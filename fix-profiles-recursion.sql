-- ============================================================
-- FIX: Infinite recursion in profiles RLS policy
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================
--
-- ROOT CAUSE:
-- The "Supervisors read all profiles" policy queried public.profiles
-- from within a profiles policy, causing PostgreSQL to recurse
-- infinitely (error code 42P17).
--
-- FIX:
-- Use a SECURITY DEFINER function to check the role. This function
-- runs with the privileges of its owner (bypassing RLS), so it
-- reads profiles directly without triggering the policies again.
-- ============================================================

-- Step 1: Create the helper function
create or replace function public.get_my_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Step 2: Drop the recursive policies
drop policy if exists "Supervisors read all profiles" on public.profiles;
drop policy if exists "Supervisors full access" on public.submissions;

-- Step 3: Re-create policies using the safe helper function
create policy "Supervisors read all profiles"
  on public.profiles
  for select
  using (public.get_my_role() = 'supervisor');

create policy "Supervisors full access"
  on public.submissions
  for all
  using (public.get_my_role() = 'supervisor');

-- Done. Test by submitting a PO as a worker — should succeed now.
