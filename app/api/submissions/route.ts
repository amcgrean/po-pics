import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('username, branch')
      .eq('id', user.id)
      .single()

    const body = await request.json()
    const { po_number, image_url, image_key, notes } = body

    if (!po_number || !image_url || !image_key) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('submissions')
      .insert({
        po_number: po_number.trim().toUpperCase(),
        image_url,
        image_key,
        submitted_by: user.id,
        submitted_username: profile?.username || user.email?.split('@')[0],
        branch: profile?.branch,
        notes: notes?.trim() || null,
        status: 'pending',
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Submission error:', error)
    return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const { searchParams } = new URL(request.url)
    const poSearch = searchParams.get('po_number')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const days = parseInt(searchParams.get('days') || '7')

    let query = supabase
      .from('submissions')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Workers only see their own; supervisors see all
    if (profile?.role !== 'supervisor') {
      query = query.eq('submitted_by', user.id)
    }

    if (poSearch) {
      query = query.ilike('po_number', `%${poSearch}%`)
    }

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (profile?.role === 'supervisor' && !poSearch) {
      const since = new Date()
      since.setDate(since.getDate() - days)
      query = query.gte('created_at', since.toISOString())
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Fetch submissions error:', error)
    return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 })
  }
}
