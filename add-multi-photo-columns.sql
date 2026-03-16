-- ============================================================
-- ADD MULTI-PHOTO COLUMNS
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add array columns
ALTER TABLE public.submissions 
ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS image_keys text[] DEFAULT '{}';

-- 2. Backfill existing records
UPDATE public.submissions
SET 
  image_urls = ARRAY[image_url],
  image_keys = ARRAY[image_key]
WHERE 
  image_url IS NOT NULL 
  AND (image_urls IS NULL OR array_length(image_urls, 1) IS NULL);

-- 3. Update the Workers Read/Insert policies? 
-- The existing policies use submitted_by or get_my_role(), they don't depend on columns.
-- But let's verify if image_urls needs to be populated. The app will send it.
