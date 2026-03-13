'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils'
import StatusBadge from '@/components/StatusBadge'

interface Submission {
  id: string
  po_number: string
  image_url: string
  submitted_username: string
  branch: string | null
  notes: string | null
  status: string
  reviewer_notes: string | null
  reviewed_at: string | null
  created_at: string
}

export default function SubmissionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [submission, setSubmission] = useState<Submission | null>(null)
  const [loading, setLoading] = useState(true)
  const [reviewerNotes, setReviewerNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/submissions/${id}`)
        if (!res.ok) throw new Error('Not found')
        const data = await res.json()
        setSubmission(data)
        setReviewerNotes(data.reviewer_notes || '')
      } catch {
        router.push('/supervisor')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, router])

  async function updateStatus(newStatus: string) {
    if (!submission) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/submissions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, reviewer_notes: reviewerNotes }),
      })
      if (!res.ok) throw new Error('Failed to save')
      const updated = await res.json()
      setSubmission(updated)
      setReviewerNotes(updated.reviewer_notes || '')
    } catch (err: any) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <svg className="animate-spin w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  if (!submission) return null

  return (
    <>
      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          onClick={() => setLightbox(false)}
        >
          <img src={submission.image_url} alt="Full size" className="max-w-full max-h-full object-contain" />
          <button
            className="absolute top-4 right-4 text-white text-4xl w-12 h-12 flex items-center justify-center rounded-full bg-black/50"
            onClick={() => setLightbox(false)}
          >
            ×
          </button>
        </div>
      )}

      {/* Back nav */}
      <div className="mb-6">
        <Link href="/supervisor" className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Photo */}
        <div>
          <div
            className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 cursor-zoom-in"
            onClick={() => setLightbox(true)}
          >
            <img
              src={submission.image_url}
              alt={`PO ${submission.po_number}`}
              className="w-full aspect-video object-cover"
            />
            <p className="text-xs text-gray-400 text-center py-2">Click to zoom</p>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-4">
          {/* PO Info */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">PO Number</p>
                <p className="text-3xl font-bold text-gray-900">{submission.po_number}</p>
              </div>
              <StatusBadge status={submission.status} />
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500">Submitted by</p>
                <p className="font-medium text-gray-900">{submission.submitted_username}</p>
              </div>
              {submission.branch && (
                <div>
                  <p className="text-gray-500">Branch</p>
                  <p className="font-medium text-gray-900">{submission.branch}</p>
                </div>
              )}
              <div>
                <p className="text-gray-500">Date / Time</p>
                <p className="font-medium text-gray-900">{formatDateTime(submission.created_at)}</p>
              </div>
            </div>

            {submission.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500 mb-1">Worker Notes</p>
                <p className="text-sm text-gray-800 italic">"{submission.notes}"</p>
              </div>
            )}
          </div>

          {/* Review Actions */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-3">Review</h3>

            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1">Reviewer Notes</label>
              <textarea
                value={reviewerNotes}
                onChange={e => setReviewerNotes(e.target.value)}
                placeholder="Add notes for your records…"
                rows={3}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-green-600 resize-none"
              />
            </div>

            {saveError && (
              <p className="text-red-600 text-sm mb-3">{saveError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => updateStatus('reviewed')}
                disabled={saving}
                className="flex-1 py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
                style={{ backgroundColor: '#006834' }}
              >
                {saving ? 'Saving…' : '✓ Mark Reviewed'}
              </button>
              <button
                onClick={() => updateStatus('flagged')}
                disabled={saving}
                className="flex-1 py-3 rounded-xl text-white font-semibold text-sm bg-red-600 disabled:opacity-50"
              >
                ⚑ Flag
              </button>
            </div>

            {submission.status !== 'pending' && (
              <button
                onClick={() => updateStatus('pending')}
                disabled={saving}
                className="w-full mt-2 py-2 rounded-xl text-gray-600 text-sm border border-gray-300 disabled:opacity-50"
              >
                Reset to Pending
              </button>
            )}

            {submission.reviewed_at && (
              <p className="text-xs text-gray-400 mt-3 text-center">
                Last reviewed: {formatDateTime(submission.reviewed_at)}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
