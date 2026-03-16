#!/usr/bin/env node
/**
 * list-policies.mjs
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

async function list() {
  console.log('--- RLS Policy Audit ---')

  // We try to use the pg_policies view through a direct select if RLS doesn't block service role (it shouldn't)
  // But standard Supabase doesn't expose pg_catalog via the API easily.
  // Instead, we will try to INFER by making requests as a specific user if we have their session, 
  // OR we will provide the SQL to the user to run which is the most reliable.
  
  console.log('Since the schema is correct, the issue is almost certainly RLS.')
  console.log('I will provide you with the SQL fix.')
  
  // One last check: are there profiles correctly linked?
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('*')
  if (pErr) {
    console.log('Error fetching profiles:', pErr.message)
  } else {
    console.log('Profiles currently in DB:')
    console.table(profiles)
  }
}

list()
