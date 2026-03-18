-- ============================================================
-- ADD AUDIT LOG TABLE AND SUBMITTED STATUS
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Create submission audit log table
CREATE TABLE IF NOT EXISTS public.submission_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid REFERENCES public.submissions(id) ON DELETE CASCADE NOT NULL,
  action text NOT NULL, -- 'created', 'photos_added', 'status_changed'
  old_status text,
  new_status text,
  changed_by uuid REFERENCES public.profiles(id),
  changed_by_username text,
  photo_count_added int,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 2. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_audit_log_submission_id ON public.submission_audit_log(submission_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.submission_audit_log(created_at DESC);

-- 3. Enable RLS
ALTER TABLE public.submission_audit_log ENABLE ROW LEVEL SECURITY;

-- 4. Workers can read audit logs for their own submissions
CREATE POLICY "Workers read own submission audit log"
  ON public.submission_audit_log FOR SELECT
  USING (
    submission_id IN (
      SELECT id FROM public.submissions WHERE submitted_by = auth.uid()
    )
  );

-- 5. Any authenticated user can insert an audit log entry for themselves
CREATE POLICY "Users insert own audit log entries"
  ON public.submission_audit_log FOR INSERT
  WITH CHECK (auth.uid() = changed_by);

-- 6. Elevated roles have full access to all audit logs
CREATE POLICY "Elevated roles full access on audit log"
  ON public.submission_audit_log FOR ALL
  USING (public.get_my_role() IN ('supervisor', 'manager'));

-- 7. Change default status on submissions from 'pending' to 'submitted'
ALTER TABLE public.submissions ALTER COLUMN status SET DEFAULT 'submitted';

-- Optional: backfill existing 'pending' records to 'submitted'
-- (uncomment if you want all existing records updated)
-- UPDATE public.submissions SET status = 'submitted' WHERE status = 'pending';
