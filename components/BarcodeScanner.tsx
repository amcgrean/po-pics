'use client'

import { useEffect, useRef, useState } from 'react'

interface BarcodeScannerProps {
  onScan: (value: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(true)
  const scannerRef = useRef<any>(null)
  const mountedRef = useRef(true)
  const containerId = 'html5qr-reader'

  useEffect(() => {
    mountedRef.current = true

    async function startScanner() {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode')

        const scanner = new Html5Qrcode(containerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.ITF,
          ],
          verbose: false,
        })

        scannerRef.current = scanner

        // Use ideal facingMode so iOS falls back gracefully if back camera unavailable
        await scanner.start(
          { facingMode: { ideal: 'environment' } },
          { fps: 10, qrbox: { width: 280, height: 180 } },
          (decodedText: string) => {
            try {
              const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
              const osc = ctx.createOscillator()
              const gain = ctx.createGain()
              osc.connect(gain)
              gain.connect(ctx.destination)
              osc.frequency.value = 1000
              gain.gain.value = 0.3
              osc.start()
              osc.stop(ctx.currentTime + 0.15)
            } catch {}

            if (mountedRef.current) onScan(decodedText)
          },
          () => {
            // Per-frame error — normal when no barcode visible, ignore
          }
        )

        if (mountedRef.current) setIsStarting(false)
      } catch (err: any) {
        if (!mountedRef.current) return

        const name = err?.name || ''
        const msg = (err?.message || String(err)).toLowerCase()

        if (name === 'NotAllowedError' || msg.includes('permission') || msg.includes('notallowed')) {
          setError(
            'Camera access was denied. Go to your browser settings, allow camera for this site, then reload.'
          )
        } else if (name === 'NotFoundError' || msg.includes('notfound')) {
          setError('No camera found on this device.')
        } else {
          setError('Could not start camera. Please try again.')
        }
        setIsStarting(false)
      }
    }

    startScanner()

    return () => {
      mountedRef.current = false
      const scanner = scannerRef.current
      if (scanner) {
        scanner.stop().catch(() => {}).finally(() => {
          scanner.clear().catch(() => {})
        })
      }
    }
  }, [onScan])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black safe-top">
        <h2 className="text-white text-lg font-semibold">Scan Barcode</h2>
        <button
          onClick={onClose}
          className="text-white text-3xl leading-none w-10 h-10 flex items-center justify-center rounded-full active:bg-white/20"
          aria-label="Close scanner"
        >
          ×
        </button>
      </div>

      {/* Scanner area */}
      <div className="flex-1 flex flex-col items-center justify-center bg-black">
        {error ? (
          <div className="px-6 text-center">
            <div className="text-5xl mb-4">📷</div>
            <p className="text-white text-base">{error}</p>
            <button
              onClick={onClose}
              className="mt-6 px-6 py-3 bg-white text-gray-900 rounded-xl font-semibold"
            >
              Go Back
            </button>
          </div>
        ) : (
          <>
            <div id={containerId} className="w-full max-w-sm" />
            <p className="text-white/70 text-sm mt-4 px-4 text-center">
              {isStarting ? 'Starting camera…' : 'Point your camera at the barcode'}
            </p>
          </>
        )}
      </div>

      {/* Footer hint */}
      {!error && (
        <div className="px-4 py-4 bg-black safe-bottom">
          <p className="text-white/50 text-xs text-center">
            Supports Code 128, Code 39, QR, EAN, UPC
          </p>
        </div>
      )}
    </div>
  )
}
