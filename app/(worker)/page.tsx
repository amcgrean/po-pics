'use client'

import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'

const BarcodeScanner = dynamic(() => import('@/components/BarcodeScanner'), { ssr: false })
const CameraCapture = dynamic(() => import('@/components/CameraCapture'), { ssr: false })

type Step = 'idle' | 'scanning' | 'camera' | 'done'

export default function WorkerPage() {
  const [step, setStep] = useState<Step>('idle')
  const [poNumber, setPoNumber] = useState('')
  const [poInput, setPoInput] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [poError, setPoError] = useState<string | null>(null)
  const [username, setUsername] = useState('')

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, display_name')
          .eq('id', user.id)
          .single()
        setUsername(profile?.display_name || profile?.username || '')
      }
    }
    loadUser()
  }, [])

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

  const handlePhotoCapture = useCallback((file: File) => {
    setPhoto(file)
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoPreview(URL.createObjectURL(file))
    setStep('idle')
  }, [photoPreview])

  const clearPo = () => {
    setPoNumber('')
    setPoInput('')
    setPoError(null)
  }

  const clearPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhoto(null)
    setPhotoPreview(null)
  }

  const reset = () => {
    clearPhoto()
    setPoNumber('')
    setPoInput('')
    setNotes('')
    setError(null)
    setPoError(null)
    setSuccess(false)
  }

  async function handleSubmit() {
    if (!poNumber || !photo) return
    setSubmitting(true)
    setError(null)

    try {
      // Upload image
      const formData = new FormData()
      formData.append('image', photo)
      formData.append('po_number', poNumber)

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!uploadRes.ok) {
        const err = await uploadRes.json()
        throw new Error(err.error || 'Upload failed')
      }

      const { url, key } = await uploadRes.json()

      // Create submission record
      const submitRes = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          po_number: poNumber,
          image_url: url,
          image_key: key,
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
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
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
          PO <span className="font-bold" style={{ color: '#006834' }}>{poNumber}</span>
        </p>
        <p className="text-sm text-gray-400 mt-4">Resetting in a moment…</p>
      </div>
    )
  }

  const canSubmit = !!poNumber && !!photo && !submitting

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="text-white px-4 py-4 safe-top" style={{ backgroundColor: '#006834' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">PO Check-In</h1>
            {username && (
              <p className="text-sm text-white/70">Hi, {username}</p>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="text-white/70 text-sm active:text-white"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="px-4 py-6 space-y-4 max-w-lg mx-auto">
        {/* Step 1: PO Number */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: poNumber ? '#006834' : '#6b7280' }}
            >
              {poNumber ? '✓' : '1'}
            </div>
            <h2 className="font-semibold text-gray-800">PO Number</h2>
          </div>

          {poNumber ? (
            <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ backgroundColor: '#e8f5ee' }}>
              <span className="font-bold text-xl" style={{ color: '#006834' }}>{poNumber}</span>
              <button onClick={clearPo} className="text-sm text-gray-500 underline">Clear</button>
            </div>
          ) : (
            <>
              <button
                onClick={() => setStep('scanning')}
                className="w-full py-4 rounded-xl text-white text-base font-semibold mb-3 active:opacity-90"
                style={{ backgroundColor: '#006834' }}
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base text-gray-800 placeholder-gray-400 focus:outline-none"
                  onFocus={e => e.target.style.borderColor = '#006834'}
                  onBlur={e => e.target.style.borderColor = '#d1d5db'}
                  maxLength={10}
                />
              </div>
              {poError && (
                <p className="text-red-600 text-sm mt-2 px-1">{poError}</p>
              )}
            </>
          )}
        </div>

        {/* Step 2: Photo */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: photo ? '#006834' : (poNumber ? '#6b7280' : '#d1d5db') }}
            >
              {photo ? '✓' : '2'}
            </div>
            <h2 className={`font-semibold ${poNumber ? 'text-gray-800' : 'text-gray-400'}`}>
              Take Photo
            </h2>
          </div>

          {photo && photoPreview ? (
            <div className="relative">
              <img
                src={photoPreview}
                alt="Captured"
                className="w-full h-48 object-cover rounded-xl"
              />
              <button
                onClick={clearPhoto}
                className="absolute top-2 right-2 bg-black/50 text-white text-xs px-3 py-1.5 rounded-full"
              >
                Retake
              </button>
            </div>
          ) : (
            <button
              onClick={() => setStep('camera')}
              disabled={!poNumber}
              className="w-full py-4 rounded-xl text-base font-semibold border-2 border-dashed transition-colors disabled:opacity-40"
              style={{
                borderColor: poNumber ? '#006834' : '#d1d5db',
                color: poNumber ? '#006834' : '#9ca3af',
              }}
            >
              <span className="text-2xl block mb-1">📷</span>
              Open Camera
            </button>
          )}
        </div>

        {/* Step 3: Submit */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: canSubmit ? '#006834' : '#d1d5db' }}
            >
              3
            </div>
            <h2 className={`font-semibold ${canSubmit ? 'text-gray-800' : 'text-gray-400'}`}>
              Submit
            </h2>
          </div>

          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Optional notes (damage, quantity, etc.)"
            rows={2}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none resize-none mb-3"
            onFocus={e => e.target.style.borderColor = '#006834'}
            onBlur={e => e.target.style.borderColor = '#d1d5db'}
          />

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-3">
              {error}
              <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-4 rounded-xl text-white text-base font-bold transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ backgroundColor: '#006834' }}
          >
            {submitting ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Uploading…
              </>
            ) : (
              'Submit'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
