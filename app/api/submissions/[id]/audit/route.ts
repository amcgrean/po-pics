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
      logWarn('Unauthorized audit log fetch attempt', { submissionId: params.id })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('submission_audit_log')
      .select('*')
      .eq('submission_id', params.id)
      .order('created_at', { ascending: true })

    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error) {
    logError('Fetch audit log error', error, { submissionId: params.id })
    return NextResponse.json({ error: 'Failed to fetch audit log' }, { status: 500 })
  }
}
