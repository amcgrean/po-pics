'use client'

import { useRef, useState, useCallback } from 'react'
import imageCompression from 'browser-image-compression'

interface CameraCaptureProps {
  onCapture: (file: File) => void
  onClose: () => void
}

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<'camera' | 'fallback'>('camera')
  const [preview, setPreview] = useState<string | null>(null)
  const [capturedFile, setCapturedFile] = useState<File | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => setCameraReady(true)
      }
    } catch (err: any) {
      // Fall back to file input on iOS or permission denied
      setMode('fallback')
    }
  }, [])

  // Start camera when component mounts (camera mode)
  const handleCameraStart = useCallback(
    (el: HTMLVideoElement | null) => {
      if (el && !streamRef.current) {
        startCamera()
      }
    },
    [startCamera]
  )

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }

  async function compressImage(file: File): Promise<File> {
    return imageCompression(file, {
      maxWidthOrHeight: 1920,
      initialQuality: 0.8,
      useWebWorker: true,
      fileType: 'image/jpeg',
    })
  }

  async function captureFromVideo() {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)

    canvas.toBlob(async (blob) => {
      if (!blob) return
      const rawFile = new File([blob], 'photo.jpg', { type: 'image/jpeg' })
      const compressed = await compressImage(rawFile)
      const url = URL.createObjectURL(compressed)
      setPreview(url)
      setCapturedFile(compressed)
      stopCamera()
    }, 'image/jpeg', 0.92)
  }

  async function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const compressed = await compressImage(file)
      const url = URL.createObjectURL(compressed)
      setPreview(url)
      setCapturedFile(compressed)
    } catch {
      setError('Failed to process image. Please try again.')
    }
  }

  function retake() {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setCapturedFile(null)
    if (mode === 'camera') {
      startCamera()
    }
  }

  function confirmPhoto() {
    if (capturedFile) {
      stopCamera()
      onCapture(capturedFile)
    }
  }

  function handleClose() {
    stopCamera()
    if (preview) URL.revokeObjectURL(preview)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black safe-top">
        <h2 className="text-white text-lg font-semibold">
          {preview ? 'Review Photo' : 'Take Photo'}
        </h2>
        <button
          onClick={handleClose}
          className="text-white text-3xl leading-none w-10 h-10 flex items-center justify-center rounded-full active:bg-white/20"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center bg-black overflow-hidden">
        {preview ? (
          <img
            src={preview}
            alt="Captured"
            className="max-w-full max-h-full object-contain"
          />
        ) : mode === 'camera' ? (
          <>
            <video
              ref={(el) => {
                ;(videoRef as any).current = el
                handleCameraStart(el)
              }}
              autoPlay
              playsInline
              muted
              className="max-w-full max-h-full object-contain"
            />
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-white/70 text-sm">Starting camera…</p>
              </div>
            )}
          </>
        ) : (
          <div className="px-6 text-center">
            <div className="text-5xl mb-4">📷</div>
            <p className="text-white text-base mb-6">
              Tap below to select a photo from your camera
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 bg-white text-gray-900 rounded-xl font-semibold text-base"
            >
              Open Camera Roll
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Footer actions */}
      <div className="bg-black px-6 py-6 safe-bottom">
        {error && (
          <p className="text-red-400 text-sm text-center mb-3">{error}</p>
        )}

        {preview ? (
          <div className="flex gap-3">
            <button
              onClick={retake}
              className="flex-1 py-3 rounded-xl border border-white/30 text-white font-semibold text-base"
            >
              Retake
            </button>
            <button
              onClick={confirmPhoto}
              className="flex-1 py-3 rounded-xl text-white font-semibold text-base"
              style={{ backgroundColor: '#006834' }}
            >
              Use Photo
            </button>
          </div>
        ) : mode === 'camera' ? (
          <div className="flex items-center justify-center">
            <button
              onClick={captureFromVideo}
              disabled={!cameraReady}
              className="w-20 h-20 rounded-full border-4 border-white bg-white/20 active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center"
              aria-label="Capture photo"
            >
              <div className="w-14 h-14 rounded-full bg-white" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
