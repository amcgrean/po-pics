#!/usr/bin/env node
/**
 * fix-admin-email.mjs
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

async function fix() {
  const oldEmail = 'amcgrean@beisserlumber.com'
  const newEmail = 'admin@checkin.internal'

  console.log(`Searching for user with email "${oldEmail}" …`)
  
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers()
  if (listErr) throw listErr

  const user = users.find(u => u.email === oldEmail)
  if (!user) {
    console.error('User not found.')
    process.exit(1)
  }

  console.log(`Found User ID: ${user.id}. Updating email to ${newEmail} …`)

  const { error: updateErr } = await supabase.auth.admin.updateUserById(user.id, {
    email: newEmail,
    email_confirm: true
  })

  if (updateErr) {
    console.error('Update failed:', updateErr.message)
    process.exit(1)
  }

  console.log('SUCCESS: Admin email updated to admin@checkin.internal')
}

fix()
