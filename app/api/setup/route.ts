import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getEnv, logEnvironmentHealthOnce } from '@/lib/env'
import { logError, logWarn } from '@/lib/logger'

function checkSecret(request: NextRequest): boolean {
  const secret = getEnv('SETUP_SECRET')
  if (!secret) {
    logWarn('SETUP_SECRET is missing; setup route is effectively disabled')
    return false
  }

  const provided =
    request.nextUrl.searchParams.get('secret') || request.headers.get('x-setup-secret')

  return provided === secret
}

export async function POST(request: NextRequest) {
  logEnvironmentHealthOnce('api-setup-post')

  if (!checkSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServiceClient()
    const body = await request.json()
    const { username, display_name, password, role, branch } = body

    if (!username || !password || !role) {
      return NextResponse.json(
        { error: 'username, password, and role are required' },
        { status: 400 }
      )
    }

    const email = `${username}@checkin.internal`

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name, role },
    })

    if (error) throw error

    await supabase
      .from('profiles')
      .update({ username, display_name, role, branch })
      .eq('id', data.user.id)

    return NextResponse.json({ success: true, userId: data.user.id }, { status: 201 })
  } catch (error: any) {
    logError('Create user error', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create user' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  logEnvironmentHealthOnce('api-setup-get')

  if (!checkSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, role, branch, created_at')
      .order('created_at', { ascending: true })

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    logError('Fetch setup users error', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  logEnvironmentHealthOnce('api-setup-delete')

  if (!checkSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServiceClient()
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const { error } = await supabase.auth.admin.deleteUser(userId)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    logError('Delete user error', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
