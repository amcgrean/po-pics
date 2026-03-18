'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'

const BarcodeScanner = dynamic(() => import('@/components/BarcodeScanner'), { ssr: false })
const CameraCapture = dynamic(() => import('@/components/CameraCapture'), { ssr: false })

type Step = 'idle' | 'scanning' | 'camera' | 'done'

const MAX_PHOTOS = 10
const MAX_NOTES_LENGTH = 500

export default function WorkerPage() {
  const [step, setStep] = useState<Step>('idle')
  const [poNumber, setPoNumber] = useState('')
  const [poInput, setPoInput] = useState('')
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [poError, setPoError] = useState<string | null>(null)

  const handleBarcodeScan = useCallback((value: string) => {
    const digits = value.trim().replace(/\D/g, '')
    if (/^\d{6,10}$/.test(digits)) {
      setPoNumber(digits)
      setPoInput(digits)
      setPoError(null)
    } else {
      setPoError(`Barcode must be 6–10 digits (got "${value.trim()}"). Please scan again.`)
    }
    setStep('idle')
  }, [])

  const handlePoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '')
    setPoInput(val)
    if (val.length === 0) {
      setPoError(null)
      setPoNumber('')
    } else if (val.length < 6) {
      setPoError(`PO number must be at least 6 digits (${val.length} entered)`)
      setPoNumber('')
    } else if (val.length > 10) {
      setPoError('PO number must be at most 10 digits')
      setPoNumber('')
    } else {
      setPoError(null)
      setPoNumber(val)
    }
  }

  const handlePhotoCapture = useCallback((files: File[]) => {
    setPhotos(prev => {
      const remaining = MAX_PHOTOS - prev.length
      const toAdd = files.slice(0, remaining)
      const newPhotos = toAdd.map(file => ({
        file,
        preview: URL.createObjectURL(file)
      }))
      return [...prev, ...newPhotos]
    })
    setStep('idle')
  }, [])

  const clearPo = () => {
    setPoNumber('')
    setPoInput('')
    setPoError(null)
  }

  const removePhoto = (index: number) => {
    setPhotos(prev => {
      const next = [...prev]
      URL.revokeObjectURL(next[index].preview)
      next.splice(index, 1)
      return next
    })
  }

  const clearPhotos = () => {
    photos.forEach(p => URL.revokeObjectURL(p.preview))
    setPhotos([])
  }

  const reset = () => {
    clearPhotos()
    setPoNumber('')
    setPoInput('')
    setNotes('')
    setError(null)
    setPoError(null)
    setSuccess(false)
  }

  async function handleSubmit() {
    if (!poNumber || photos.length === 0) return
    setSubmitting(true)
    setError(null)

    try {
      // 1. Upload all images in parallel
      const uploadPromises = photos.map(async ({ file }) => {
        const formData = new FormData()
        formData.append('image', file)
        formData.append('po_number', poNumber)

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Upload failed')
        }

        return res.json() as Promise<{ url: string; key: string }>
      })

      const uploadResults = await Promise.all(uploadPromises)
      const imageUrls = uploadResults.map(r => r.url)
      const imageKeys = uploadResults.map(r => r.key)

      // 2. Create submission record with arrays
      const submitRes = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          po_number: poNumber,
          image_url: imageUrls[0], // backward compatibility
          image_key: imageKeys[0], // backward compatibility
          image_urls: imageUrls,
          image_keys: imageKeys,
          notes: notes.trim() || null,
        }),
      })

      if (!submitRes.ok) {
        const err = await submitRes.json()
        throw new Error(err.error || 'Submission failed')
      }

      setSuccess(true)
      setStep('done')

      // Auto-reset after 3 seconds
      setTimeout(() => {
        reset()
        setStep('idle')
      }, 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Scanner overlay
  if (step === 'scanning') {
    return (
      <BarcodeScanner
        onScan={handleBarcodeScan}
        onClose={() => setStep('idle')}
      />
    )
  }

  // Camera overlay
  if (step === 'camera') {
    return (
      <CameraCapture
        onCapture={handlePhotoCapture}
        onClose={() => setStep('idle')}
      />
    )
  }

  // Success screen
  if (success) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center mb-6 text-5xl"
          style={{ backgroundColor: '#e8f5ee' }}
        >
          ✓
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Submitted!</h2>
        <p className="text-lg text-gray-600">
          PO <span className="font-bold text-brand">{poNumber}</span>
        </p>
        <p className="text-sm text-gray-400 mt-4">Resetting in a moment…</p>
      </div>
    )
  }

  const canSubmit = !!poNumber && photos.length > 0 && !submitting

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 py-6 space-y-4 max-w-lg mx-auto">
        {/* Step 1: PO Number */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${poNumber ? 'bg-brand' : 'bg-gray-500'}`}
            >
              {poNumber ? '✓' : '1'}
            </div>
            <h2 className="font-semibold text-gray-800">PO Number</h2>
          </div>

          {poNumber ? (
            <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ backgroundColor: '#e8f5ee' }}>
              <span className="font-bold text-xl text-brand">{poNumber}</span>
              <button onClick={clearPo} className="text-sm text-gray-500 underline">Clear</button>
            </div>
          ) : (
            <>
              <button
                onClick={() => setStep('scanning')}
                className="w-full py-4 rounded-xl text-white text-base font-semibold mb-3 active:opacity-90 bg-brand"
              >
                <span className="text-xl mr-2">▦</span>
                Scan Barcode
              </button>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={poInput}
                  onChange={handlePoInputChange}
                  placeholder="Or type PO number (6–10 digits)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base text-gray-800 placeholder-gray-400 focus:outline-none focus:border-brand"
                  maxLength={10}
                />
              </div>
              {poError && (
                <p className="text-red-600 text-sm mt-2 px-1">{poError}</p>
              )}
            </>
          )}
        </div>

        {/* Step 2: Photos */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${photos.length > 0 ? 'bg-brand' : (poNumber ? 'bg-gray-500' : 'bg-gray-300')}`}
              >
                {photos.length > 0 ? '✓' : '2'}
              </div>
              <h2 className={`font-semibold ${poNumber ? 'text-gray-800' : 'text-gray-400'}`}>
                Attach Photos {photos.length > 0 && `(${photos.length})`}
              </h2>
            </div>
            {photos.length > 0 && (
              <span className={`text-xs font-medium ${photos.length >= MAX_PHOTOS ? 'text-red-500' : 'text-gray-400'}`}>
                {photos.length}/{MAX_PHOTOS}
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {photos.map((p, i) => (
              <div key={i} className="relative aspect-square">
                <img
                  src={p.preview}
                  alt=""
                  className="w-full h-full object-cover rounded-xl"
                />
                <button
                  onClick={() => removePhoto(i)}
                  className="absolute -top-1 -right-1 bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold border border-white"
                >
                  ×
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button
                onClick={() => setStep('camera')}
                disabled={!poNumber}
                className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-colors disabled:opacity-40 ${poNumber ? 'border-brand text-brand' : 'border-gray-300 text-gray-400'}`}
              >
                <span className="text-2xl mb-1">📷</span>
                <span className="text-xs font-semibold">Add</span>
              </button>
            )}
          </div>
          {photos.length >= MAX_PHOTOS && (
            <p className="text-xs text-red-500 mt-2 px-1">Maximum of {MAX_PHOTOS} photos reached.</p>
          )}
        </div>

        {/* Step 3: Submit */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${canSubmit ? 'bg-brand' : 'bg-gray-300'}`}
            >
              3
            </div>
            <h2 className={`font-semibold ${canSubmit ? 'text-gray-800' : 'text-gray-400'}`}>
              Submit
            </h2>
          </div>

          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value.slice(0, MAX_NOTES_LENGTH))}
            placeholder="Optional notes (damage, quantity, etc.)"
            rows={2}
            maxLength={MAX_NOTES_LENGTH}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-brand resize-none"
          />
          <p className={`text-xs text-right mb-3 mt-1 ${notes.length >= MAX_NOTES_LENGTH ? 'text-red-500' : 'text-gray-400'}`}>
            {notes.length}/{MAX_NOTES_LENGTH}
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-3">
              {error}
              <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-4 rounded-xl text-white text-base font-bold transition-opacity disabled:opacity-40 flex items-center justify-center gap-2 bg-brand"
          >
            {submitting ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Processing {photos.length} photos…
              </>
            ) : (
              'Submit Check-In'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
