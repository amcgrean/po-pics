import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logError, logWarn } from '@/lib/logger'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      logWarn('Unauthorized submission detail attempt', { submissionId: params.id })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    logError('Fetch submission error', error, { submissionId: params.id })
    return NextResponse.json({ error: 'Failed to fetch submission' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      logWarn('Unauthorized submission patch attempt', { submissionId: params.id })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, username')
      .eq('id', user.id)
      .single()

    const isElevated = profile?.role === 'supervisor' || profile?.role === 'manager'
    const actorUsername = profile?.username || user.email?.split('@')[0]

    const body = await request.json()

    // --- Worker: add photos to own submission ---
    if (body.action === 'add_photos') {
      const { new_image_urls, new_image_keys } = body as {
        new_image_urls: string[]
        new_image_keys: string[]
      }

      if (!new_image_urls?.length || !new_image_keys?.length) {
        return NextResponse.json({ error: 'No photos provided' }, { status: 400 })
      }

      const { data: existing, error: fetchErr } = await supabase
        .from('submissions')
        .select('id, submitted_by, image_urls, image_keys, image_url, image_key')
        .eq('id', params.id)
        .single()

      if (fetchErr || !existing) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }

      if (existing.submitted_by !== user.id && !isElevated) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const updatedUrls = [...(existing.image_urls || []), ...new_image_urls]
      const updatedKeys = [...(existing.image_keys || []), ...new_image_keys]

      const { data, error } = await supabase
        .from('submissions')
        .update({
          image_urls: updatedUrls,
          image_keys: updatedKeys,
          image_url: updatedUrls[0],
          image_key: updatedKeys[0],
        })
        .eq('id', params.id)
        .select()
        .single()

      if (error) throw error

      await supabase.from('submission_audit_log').insert({
        submission_id: params.id,
        action: 'photos_added',
        changed_by: user.id,
        changed_by_username: actorUsername,
        photo_count_added: new_image_urls.length,
      })

      return NextResponse.json(data)
    }

    // --- Supervisor / Manager: update status ---
    if (!isElevated) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: existing, error: fetchErr } = await supabase
      .from('submissions')
      .select('status')
      .eq('id', params.id)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { status, reviewer_notes } = body

    if (reviewer_notes && reviewer_notes.trim().length > 500) {
      return NextResponse.json({ error: 'Reviewer notes must be 500 characters or fewer' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('submissions')
      .update({
        status,
        reviewer_notes: reviewer_notes?.trim() || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

    await supabase.from('submission_audit_log').insert({
      submission_id: params.id,
      action: 'status_changed',
      old_status: existing.status,
      new_status: status,
      changed_by: user.id,
      changed_by_username: actorUsername,
      notes: reviewer_notes?.trim() || null,
    })

    return NextResponse.json(data)
  } catch (error) {
    logError('Update submission error', error, { submissionId: params.id })
    return NextResponse.json({ error: 'Failed to update submission' }, { status: 500 })
  }
}
