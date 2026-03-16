-- ============================================================
-- ADD MANAGER ROLE POLICIES
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Update profiles policy to include managers
DROP POLICY IF EXISTS "Supervisors read all profiles" ON public.profiles;
CREATE POLICY "Elevated roles read all profiles"
  ON public.profiles FOR SELECT
  USING (public.get_my_role() IN ('supervisor', 'manager'));

-- 2. Update submissions policy to include managers
DROP POLICY IF EXISTS "Supervisors full access" ON public.submissions;
CREATE POLICY "Elevated roles full access"
  ON public.submissions FOR ALL
  USING (public.get_my_role() IN ('supervisor', 'manager'));
