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
  image_urls?: string[]
  submitted_username: string
  branch: string | null
  notes: string | null
  status: string
  reviewer_notes: string | null
  reviewed_at: string | null
  created_at: string
}

interface AuditEntry {
  id: string
  action: string
  old_status: string | null
  new_status: string | null
  changed_by_username: string | null
  photo_count_added: number | null
  notes: string | null
  created_at: string
}

export default function SubmissionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [submission, setSubmission] = useState<Submission | null>(null)
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewerNotes, setReviewerNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [subRes, auditRes] = await Promise.all([
          fetch(`/api/submissions/${id}`),
          fetch(`/api/submissions/${id}/audit`),
        ])
        if (!subRes.ok) throw new Error('Not found')
        const [subData, auditData] = await Promise.all([subRes.json(), auditRes.json()])
        setSubmission(subData)
        setReviewerNotes(subData.reviewer_notes || '')
        setAuditLog(Array.isArray(auditData) ? auditData : [])
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
      const [updated, updatedAudit] = await Promise.all([
        res.json(),
        fetch(`/api/submissions/${id}/audit`).then(r => r.json()),
      ])
      setSubmission(updated)
      setReviewerNotes(updated.reviewer_notes || '')
      setAuditLog(Array.isArray(updatedAudit) ? updatedAudit : [])
    } catch (err: any) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function auditLabel(entry: AuditEntry): string {
    switch (entry.action) {
      case 'created':
        return `Submitted with ${entry.photo_count_added ?? 0} photo${(entry.photo_count_added ?? 0) !== 1 ? 's' : ''}`
      case 'photos_added':
        return `Added ${entry.photo_count_added ?? 0} photo${(entry.photo_count_added ?? 0) !== 1 ? 's' : ''}`
      case 'status_changed': {
        const from = entry.old_status ? entry.old_status.charAt(0).toUpperCase() + entry.old_status.slice(1) : '?'
        const to = entry.new_status ? entry.new_status.charAt(0).toUpperCase() + entry.new_status.slice(1) : '?'
        return `Status: ${from} → ${to}`
      }
      default:
        return entry.action
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

  const photos = submission.image_urls && submission.image_urls.length > 0
    ? submission.image_urls
    : [submission.image_url]

  const canReset = submission.status === 'reviewed' || submission.status === 'flagged'

  return (
    <>
      {/* Lightbox */}
      {activeImageIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setActiveImageIndex(null)}
        >
          <img
            src={photos[activeImageIndex]}
            alt="Full size"
            className="max-w-[95%] max-h-[95%] object-contain"
          />
          <button
            className="absolute top-4 right-4 text-white text-4xl w-12 h-12 flex items-center justify-center rounded-full bg-black/50"
            onClick={(e) => { e.stopPropagation(); setActiveImageIndex(null); }}
          >
            ×
          </button>

          {photos.length > 1 && (
            <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-4 px-4" onClick={e => e.stopPropagation()}>
              <button
                disabled={activeImageIndex === 0}
                onClick={() => setActiveImageIndex(activeImageIndex - 1)}
                className="bg-white/10 text-white px-4 py-2 rounded-full disabled:opacity-20"
              >
                ← Prev
              </button>
              <span className="text-white/60 self-center text-sm">
                {activeImageIndex + 1} / {photos.length}
              </span>
              <button
                disabled={activeImageIndex === photos.length - 1}
                onClick={() => setActiveImageIndex(activeImageIndex + 1)}
                className="bg-white/10 text-white px-4 py-2 rounded-full disabled:opacity-20"
              >
                Next →
              </button>
            </div>
          )}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Gallery */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span>🖼️</span> Photos ({photos.length})
            </h3>

            <div className="space-y-4">
              {photos.map((url, i) => (
                <div
                  key={i}
                  className="bg-gray-50 rounded-xl overflow-hidden cursor-zoom-in border border-gray-100 hover:border-green-300 transition-colors"
                  onClick={() => setActiveImageIndex(i)}
                >
                  <img
                    src={url}
                    alt={`Submission photo ${i + 1}`}
                    className="w-full object-cover"
                    style={{ maxHeight: '500px' }}
                  />
                  <p className="text-[10px] text-gray-400 text-center py-1.5 uppercase tracking-wider">
                    Photo {i + 1} • Click to enlarge
                  </p>
                </div>
              ))}
            </div>
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

            {canReset && (
              <button
                onClick={() => updateStatus('submitted')}
                disabled={saving}
                className="w-full mt-2 py-2 rounded-xl text-gray-600 text-sm border border-gray-300 disabled:opacity-50"
              >
                Reset to Submitted
              </button>
            )}

            {submission.reviewed_at && (
              <p className="text-xs text-gray-400 mt-3 text-center">
                Last reviewed: {formatDateTime(submission.reviewed_at)}
              </p>
            )}
          </div>

          {/* Audit History */}
          {auditLog.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-800 mb-4 text-sm uppercase tracking-wide">Audit History</h3>
              <div className="relative">
                <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-100" />
                <div className="space-y-4">
                  {auditLog.map((entry) => (
                    <div key={entry.id} className="flex gap-3 relative">
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex-shrink-0 flex items-center justify-center z-10">
                        {entry.action === 'created' && (
                          <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                          </svg>
                        )}
                        {entry.action === 'photos_added' && (
                          <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        )}
                        {entry.action === 'status_changed' && (
                          <svg className="w-3 h-3 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <p className="text-sm text-gray-800">{auditLabel(entry)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {entry.changed_by_username && (
                            <span className="font-medium text-gray-600">{entry.changed_by_username} · </span>
                          )}
                          {formatDateTime(entry.created_at)}
                        </p>
                        {entry.notes && (
                          <p className="text-xs text-gray-500 italic mt-1">"{entry.notes}"</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
