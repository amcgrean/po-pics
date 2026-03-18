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

export default function ManagerSubmissionDetailPage() {
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
        router.push('/manager')
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
    <div className="max-w-6xl mx-auto px-4 py-8">
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
        <Link href="/manager" className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Gallery */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2 text-lg">
              <span>🖼️</span> Submission Photos ({photos.length})
            </h3>

            <div className="space-y-6">
              {photos.map((url, i) => (
                <div
                  key={i}
                  className="bg-gray-50 rounded-2xl overflow-hidden cursor-zoom-in border border-gray-100 hover:border-green-300 transition-all hover:shadow-md"
                  onClick={() => setActiveImageIndex(i)}
                >
                  <img
                    src={url}
                    alt={`Submission photo ${i + 1}`}
                    className="w-full object-cover"
                    style={{ maxHeight: '600px' }}
                  />
                  <div className="bg-white/80 backdrop-blur-sm py-2 text-center border-t border-gray-100">
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                      Photo {i + 1} • Click to enlarge
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-6">
          {/* PO Info */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full -mr-16 -mt-16 opacity-50" />

            <div className="flex items-start justify-between mb-8 relative z-10">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">PO Number</p>
                <p className="text-5xl font-black text-gray-900 tracking-tight">{submission.po_number}</p>
              </div>
              <StatusBadge status={submission.status} />
            </div>

            <div className="grid grid-cols-2 gap-8 text-sm relative z-10">
              <div>
                <p className="text-gray-400 font-medium mb-1">Submitted by</p>
                <p className="font-bold text-gray-900 text-base">{submission.submitted_username}</p>
              </div>
              {submission.branch && (
                <div>
                  <p className="text-gray-400 font-medium mb-1">Branch</p>
                  <p className="font-bold text-gray-900 text-base">{submission.branch}</p>
                </div>
              )}
              <div className="col-span-2">
                <p className="text-gray-400 font-medium mb-1">Date / Time</p>
                <p className="font-bold text-gray-900 text-base">{formatDateTime(submission.created_at)}</p>
              </div>
            </div>

            {submission.notes && (
              <div className="mt-8 pt-8 border-t border-gray-100 relative z-10">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Worker Notes</p>
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <p className="text-gray-700 italic text-base">"{submission.notes}"</p>
                </div>
              </div>
            )}
          </div>

          {/* Review Actions */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Review & Audit</h3>

            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Reviewer Notes</label>
              <textarea
                value={reviewerNotes}
                onChange={e => setReviewerNotes(e.target.value)}
                placeholder="Add audit notes or instructions…"
                rows={4}
                className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-base focus:outline-none focus:border-green-600 focus:bg-white transition-all resize-none"
              />
            </div>

            {saveError && (
              <p className="text-red-600 font-bold text-sm mb-4">⚠️ {saveError}</p>
            )}

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => updateStatus('reviewed')}
                disabled={saving}
                className="flex-1 py-4 bg-green-700 hover:bg-green-800 text-white font-black rounded-2xl text-lg transition-all shadow-lg shadow-green-900/10 disabled:opacity-50"
              >
                {saving ? 'Saving…' : '✓ Mark Reviewed'}
              </button>
              <button
                onClick={() => updateStatus('flagged')}
                disabled={saving}
                className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl text-lg transition-all shadow-lg shadow-red-900/10 disabled:opacity-50"
              >
                ⚑ Flag Issue
              </button>
            </div>

            {canReset && (
              <button
                onClick={() => updateStatus('submitted')}
                disabled={saving}
                className="w-full mt-4 py-3 bg-white hover:bg-gray-50 text-gray-500 font-bold rounded-2xl text-sm border border-gray-200 transition-all disabled:opacity-50"
              >
                Reset to Submitted
              </button>
            )}

            {submission.reviewed_at && (
              <p className="text-xs text-gray-400 mt-6 text-center font-medium">
                Last modified: {formatDateTime(submission.reviewed_at)}
              </p>
            )}
          </div>

          {/* Audit History */}
          {auditLog.length > 0 && (
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Audit History</h3>
              <div className="relative">
                <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-100" />
                <div className="space-y-5">
                  {auditLog.map((entry) => (
                    <div key={entry.id} className="flex gap-4 relative">
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex-shrink-0 flex items-center justify-center z-10 mt-0.5">
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
                        <p className="text-base font-medium text-gray-800">{auditLabel(entry)}</p>
                        <p className="text-sm text-gray-400 mt-0.5">
                          {entry.changed_by_username && (
                            <span className="font-semibold text-gray-600">{entry.changed_by_username} · </span>
                          )}
                          {formatDateTime(entry.created_at)}
                        </p>
                        {entry.notes && (
                          <div className="mt-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
                            <p className="text-sm text-gray-600 italic">"{entry.notes}"</p>
                          </div>
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
    </div>
  )
}
