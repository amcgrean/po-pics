#!/usr/bin/env node
/**
 * reset-password.mjs
 * 
 * stand-alone script to reset any user's password using the Service Role Key.
 * 
 * Usage:
 *   node scripts/reset-password.mjs <username> <new_password>
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

const args = process.argv.slice(2)
if (args.length < 2) {
  console.log('Usage: node scripts/reset-password.mjs <username> <new_password>')
  process.exit(1)
}

const [username, newPassword] = args
const supabase = createClient(supabaseUrl, serviceRoleKey)

async function reset() {
  console.log(`Looking for user with username "${username}" …`)
  
  // 1. Find user ID from profiles table
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .single()

  if (profileErr || !profile) {
    console.error('User not found in profiles table:', profileErr?.message || 'Check username exists')
    process.exit(1)
  }

  const userId = profile.id
  console.log(`Found User ID: ${userId}. Resetting password …`)

  // 2. Update password via admin API
  const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, {
    password: newPassword
  })

  if (updateErr) {
    console.error('Failed to update password:', updateErr.message)
    process.exit(1)
  }

  console.log('SUCCESS: Password updated successfully.')
}

reset()
