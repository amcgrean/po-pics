#!/usr/bin/env node
/**
 * debug-db.mjs
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
  console.log('--- Database Debug (Submissions Table) ---')

  // 1. Try to get table info
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'submissions' })
  
  if (error) {
    console.log('RPC get_table_columns failed, trying direct select head...')
    const { data: headData, error: headError } = await supabase
      .from('submissions')
      .select('*')
      .limit(0)
    
    if (headError) {
      console.error('Failed to access submissions table:', headError.message)
    } else {
      console.log('Successfully accessed submissions table.')
    }
  } else {
    console.log('Columns in submissions table:', data)
  }

  // 2. Check for some rows
  console.log('\n--- Recent Submissions ---')
  const { data: rows, error: rowsErr } = await supabase
    .from('submissions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  if (rowsErr) {
    console.error('Failed to fetch rows:', rowsErr.message)
  } else {
    console.log(`Found ${rows.length} rows.`)
    console.table(rows)
  }

  // 3. Try a test insert with Service Role (should always work if schema matches)
  console.log('\n--- Test Insert (Service Role) ---')
  const testSub = {
    po_number: 'DEBUG-TEST-123',
    image_url: 'https://example.com/test.jpg',
    image_key: 'test/key',
    status: 'pending'
  }
  
  const { data: insData, error: insErr } = await supabase
    .from('submissions')
    .insert(testSub)
    .select()

  if (insErr) {
    console.error('Test insert FAILED:', insErr.message)
  } else {
    console.log('Test insert SUCCESSFUL.')
    // Delete it immediately
    await supabase.from('submissions').delete().eq('po_number', 'DEBUG-TEST-123')
  }
}

debug()
