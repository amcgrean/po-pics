import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logEnvironmentHealthOnce } from '@/lib/env'
import { logError, logWarn } from '@/lib/logger'

async function requireAdminUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError) {
    logWarn('Setup API role check failed', { userId: user.id, error: profileError.message })
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  if (!['supervisor', 'manager'].includes(profile?.role || '')) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { user }
}

export async function POST(request: NextRequest) {
  logEnvironmentHealthOnce('api-setup-post')

  const auth = await requireAdminUser()
  if (auth.error) return auth.error

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

export async function GET() {
  logEnvironmentHealthOnce('api-setup-get')

  const auth = await requireAdminUser()
  if (auth.error) return auth.error

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

export async function PATCH(request: NextRequest) {
  logEnvironmentHealthOnce('api-setup-patch')

  const auth = await requireAdminUser()
  if (auth.error) return auth.error

  try {
    const supabase = createServiceClient()
    const { userId, password } = await request.json()

    if (!userId || !password) {
      return NextResponse.json({ error: 'userId and password are required' }, { status: 400 })
    }

    const { error } = await supabase.auth.admin.updateUserById(userId, { password })
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    logError('Reset password error', error)
    return NextResponse.json({ error: error.message || 'Failed to reset password' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  logEnvironmentHealthOnce('api-setup-delete')

  const auth = await requireAdminUser()
  if (auth.error) return auth.error

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
