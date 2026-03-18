'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils'
import StatusBadge from '@/components/StatusBadge'
import CameraCapture from '@/components/CameraCapture'
import imageCompression from 'browser-image-compression'

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

export default function WorkerSubmissionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [submission, setSubmission] = useState<Submission | null>(null)
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

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
        setAuditLog(Array.isArray(auditData) ? auditData : [])
      } catch {
        router.push('/history')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, router])

  async function compressImage(file: File): Promise<File> {
    return imageCompression(file, {
      maxWidthOrHeight: 1600,
      initialQuality: 0.7,
      useWebWorker: true,
      fileType: 'image/jpeg',
    })
  }

  async function uploadAndAttachPhotos(files: File[]) {
    if (!submission) return
    setUploadingPhotos(true)
    setUploadError(null)
    try {
      const uploaded = await Promise.all(
        files.map(async (file) => {
          const compressed = await compressImage(file)
          const form = new FormData()
          form.append('image', compressed)
          form.append('po_number', submission.po_number)
          const res = await fetch('/api/upload', { method: 'POST', body: form })
          if (!res.ok) throw new Error('Upload failed')
          return res.json() as Promise<{ url: string; key: string }>
        })
      )

      const new_image_urls = uploaded.map(u => u.url)
      const new_image_keys = uploaded.map(u => u.key)

      const patchRes = await fetch(`/api/submissions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_photos', new_image_urls, new_image_keys }),
      })
      if (!patchRes.ok) throw new Error('Failed to attach photos')

      const [updated, updatedAudit] = await Promise.all([
        patchRes.json(),
        fetch(`/api/submissions/${id}/audit`).then(r => r.json()),
      ])
      setSubmission(updated)
      setAuditLog(Array.isArray(updatedAudit) ? updatedAudit : [])
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload photos')
    } finally {
      setUploadingPhotos(false)
    }
  }

  async function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    if (fileInputRef.current) fileInputRef.current.value = ''
    await uploadAndAttachPhotos(files)
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
        return `Status changed: ${from} → ${to}`
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

  return (
    <>
      {/* Camera overlay */}
      {showCamera && (
        <CameraCapture
          onCapture={async (files) => {
            setShowCamera(false)
            await uploadAndAttachPhotos(files)
          }}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* Hidden file input for gallery picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileInput}
      />

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
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">
                Photos ({photos.length})
              </h3>
              <button
                onClick={() => setShowCamera(true)}
                disabled={uploadingPhotos}
                className="flex items-center gap-1.5 text-xs font-medium text-white px-3 py-1.5 rounded-lg disabled:opacity-50 bg-brand"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Photos
              </button>
            </div>

            {uploadingPhotos && (
              <div className="flex items-center gap-2 text-sm text-blue-600 mb-3 bg-blue-50 rounded-xl px-3 py-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Uploading photos…
              </div>
            )}

            {uploadError && (
              <p className="text-red-600 text-sm mb-3 bg-red-50 rounded-xl px-3 py-2">{uploadError}</p>
            )}

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

            {/* Add from gallery option */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhotos}
              className="w-full mt-3 py-2.5 rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 disabled:opacity-50"
            >
              + Add from Gallery
            </button>
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

          {/* Reviewer Feedback (read-only) */}
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

          {/* Audit History */}
          {auditLog.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-800 mb-4 text-sm uppercase tracking-wide">History</h3>
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
                            <span className="font-medium text-gray-500">{entry.changed_by_username} · </span>
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
