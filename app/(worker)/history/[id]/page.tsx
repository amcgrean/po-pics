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

export default function WorkerSubmissionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [submission, setSubmission] = useState<Submission | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/submissions/${id}`)
        if (!res.ok) throw new Error('Not found')
        const data = await res.json()
        setSubmission(data)
      } catch {
        router.push('/history')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, router])

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
            onClick={(e) => { e.stopPropagation(); setActiveImageIndex(null) }}
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

      <div className="px-4 py-4 max-w-lg mx-auto">
        {/* Back nav */}
        <div className="mb-4">
          <Link href="/history" className="flex items-center gap-2 text-sm text-gray-600 active:text-gray-900">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to History
          </Link>
        </div>

        <div className="space-y-4">
          {/* Photos */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">
              Photos ({photos.length})
            </h3>
            <div className="space-y-3">
              {photos.map((url, i) => (
                <div
                  key={i}
                  className="bg-gray-50 rounded-xl overflow-hidden cursor-zoom-in border border-gray-100"
                  onClick={() => setActiveImageIndex(i)}
                >
                  <img
                    src={url}
                    alt={`Submission photo ${i + 1}`}
                    className="w-full object-cover"
                    style={{ maxHeight: '400px' }}
                  />
                  <p className="text-[10px] text-gray-400 text-center py-1.5 uppercase tracking-wider">
                    Photo {i + 1} · Tap to enlarge
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* PO Info */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">PO Number</p>
                <p className="text-3xl font-bold text-gray-900">{submission.po_number}</p>
              </div>
              <StatusBadge status={submission.status} />
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500">Submitted</p>
                <p className="font-medium text-gray-900">{formatDateTime(submission.created_at)}</p>
              </div>
              {submission.branch && (
                <div>
                  <p className="text-gray-500">Branch</p>
                  <p className="font-medium text-gray-900">{submission.branch}</p>
                </div>
              )}
            </div>

            {submission.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Your Notes</p>
                <p className="text-sm text-gray-800 italic">"{submission.notes}"</p>
              </div>
            )}
          </div>

          {/* Reviewer Notes (read-only) */}
          {(submission.reviewer_notes || submission.reviewed_at) && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">Reviewer Feedback</h3>
              {submission.reviewer_notes && (
                <p className="text-sm text-gray-800 italic">"{submission.reviewer_notes}"</p>
              )}
              {submission.reviewed_at && (
                <p className="text-xs text-gray-400 mt-2">
                  Reviewed {formatDateTime(submission.reviewed_at)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
