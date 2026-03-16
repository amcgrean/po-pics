#!/usr/bin/env node
/**
 * repair-db.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env if present
try {
  const envFile = readFileSync(resolve(process.cwd(), '.env'), 'utf8')
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
} catch { /* ignore */ }

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function repair() {
  console.log('--- Database Repair ---')

  // We will try to perform a multi-phase check and repair
  
  // 1. Detect missing columns by trying to insert and catching errors
  const requiredFields = ['po_number', 'image_url', 'image_key', 'submitted_by', 'submitted_username', 'branch', 'notes', 'status']
  
  console.log('Detecting schema mismatch...')
  
  // Try a select * head to get column names if possible (via error message or data)
  const { data: cols, error: colsErr } = await supabase.from('submissions').select('*').limit(1)
  
  if (colsErr) {
    console.log('Error selecting from submissions:', colsErr.message)
    // If table doesn't exist, we might need the user to run SQL
  } else if (cols && cols.length >= 0) {
     // If we got zero rows but no error, it's just empty.
     // Let's try to infer if columns are missing by doing individual selects
     for (const field of requiredFields) {
        const { error } = await supabase.from('submissions').select(field).limit(0)
        if (error) {
          console.error(`Field "${field}" seems to be MISSING or INACCESSIBLE:`, error.message)
        } else {
          console.log(`Field "${field}" exists.`)
        }
     }
  }

  console.log('\nNOTE: If any fields are missing, you must add them via the Supabase SQL Editor.')
  console.log('SQL to fix schema and RLS:')
  console.log(`
-- 1. Ensure table exists
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_number TEXT NOT NULL,
  image_url TEXT NOT NULL,
  image_key TEXT NOT NULL,
  submitted_by UUID REFERENCES auth.users(id),
  submitted_username TEXT,
  branch TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- 3. Policies
DROP POLICY IF EXISTS "Users can insert their own submissions" ON submissions;
CREATE POLICY "Users can insert their own submissions"
ON submissions FOR INSERT
WITH CHECK (auth.uid() = submitted_by);

DROP POLICY IF EXISTS "Users can view their own submissions" ON submissions;
CREATE POLICY "Users can view their own submissions"
ON submissions FOR SELECT
USING (auth.uid() = submitted_by);

DROP POLICY IF EXISTS "Supervisors can view all submissions" ON submissions;
CREATE POLICY "Supervisors can view all submissions"
ON submissions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'supervisor'
  )
);
  `)
}

repair()
