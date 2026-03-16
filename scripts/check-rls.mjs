#!/usr/bin/env node
/**
 * check-rls.mjs
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

async function check() {
  console.log('--- RLS Policy Check ---')

  // Try to query pg_policies using an RPC or direct SQL if possible
  // Since we might not have a helper RPC, we'll try to use the 'pg_policies' view via a regular select if enabled for service role
  // If not, we'll try to infer it by doing a test insert with and without a session (imitating the user)
  
  const { data: policies, error: polErr } = await supabase.rpc('inspect_policies', { table_name: 'submissions' })

  if (polErr) {
    console.log('RPC inspect_policies failed. Trying manual inference...')
    
    // Check if RLS is enabled
    const { data: rlsInfo, error: rlsErr } = await supabase.rpc('is_rls_enabled', { table_name: 'submissions' })
    if (rlsErr) {
      console.log('Could not check if RLS is enabled via RPC.')
    } else {
      console.log('RLS Enabled:', rlsInfo)
    }
  } else {
    console.log('Policies:', policies)
  }

  // Check the table properties via a generic query if possible
  const { data: tableDetails, error: tableErr } = await supabase
    .from('submissions')
    .select('*')
    .limit(0)
  
  console.log('Access check:', tableErr ? `FAILED: ${tableErr.message}` : 'SUCCESS')
}

check()
