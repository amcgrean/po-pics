#!/usr/bin/env node
/**
 * debug-auth.mjs
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

async function debug() {
  console.log('--- Auth Debug ---')
  console.log(`Project: ${supabaseUrl}`)

  // 1. List users
  const { data: { users }, error: usersErr } = await supabase.auth.admin.listUsers()
  
  if (usersErr) {
    console.error('Failed to list users:', usersErr.message)
    process.exit(1)
  }

  console.log(`Total users found: ${users.length}`)
  users.forEach(u => {
    console.log(` - ID: ${u.id}`)
    console.log(`   Email: ${u.email}`)
    console.log(`   Confirmed: ${u.email_confirmed_at ? 'YES' : 'NO'}`)
    console.log(`   Metadata:`, u.user_metadata)
    console.log('---')
  })

  // 2. Check profiles
  console.log('\n--- Profiles Table ---')
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('*')

  if (profErr) {
    console.error('Failed to fetch profiles:', profErr.message)
  } else {
    profiles.forEach(p => {
      console.log(` - Profile: ${p.username} (${p.role}) ID: ${p.id}`)
    })
  }
}

debug()
