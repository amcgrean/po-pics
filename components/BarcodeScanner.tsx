'use client'

import { useEffect, useRef, useState } from 'react'

interface BarcodeScannerProps {
  onScan: (value: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<any>(null)
  const containerId = 'html5-qrcode-reader'
  const [error, setError] = useState<string | null>(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    let scanner: any = null

    function isPermissionError(err: any): boolean {
      return (
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        err?.message?.toLowerCase().includes('permission') ||
        err?.message?.toLowerCase().includes('notallowed') ||
        String(err).toLowerCase().includes('permission')
      )
    }

    async function startScanner() {
      // Pre-check camera permission where the Permissions API is supported (not iOS Safari).
      // On iOS Safari this API is unavailable, so we fall through and let the scanner prompt.
      try {
        const permResult = await navigator.permissions.query({ name: 'camera' as PermissionName })
        if (permResult.state === 'denied') {
          setError(
            'Camera access was denied. On iPhone, go to Settings > Safari > Camera and set it to "Allow", then reload the page.'
          )
          return
        }
      } catch {
        // navigator.permissions not supported (iOS Safari) — proceed normally
      }

      try {
        const { Html5QrcodeScanner, Html5QrcodeSupportedFormats } = await import('html5-qrcode')

        scanner = new Html5QrcodeScanner(
          containerId,
          {
            fps: 10,
            qrbox: { width: 280, height: 180 },
            aspectRatio: 1.0,
            supportedScanTypes: [],
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
            rememberLastUsedCamera: true,
            showTorchButtonIfSupported: true,
          },
          false
        )

        scannerRef.current = scanner

        scanner.render(
          (decodedText: string) => {
            // Play beep
            try {
              const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
              const oscillator = ctx.createOscillator()
              const gainNode = ctx.createGain()
              oscillator.connect(gainNode)
              gainNode.connect(ctx.destination)
              oscillator.frequency.value = 1000
              gainNode.gain.value = 0.3
              oscillator.start()
              oscillator.stop(ctx.currentTime + 0.15)
            } catch {}

            onScan(decodedText)
          },
          (errorMsg: string) => {
            // The error callback fires for every unrecognised frame (normal during scanning).
            // But it can also carry camera permission errors — detect and surface those.
            if (isPermissionError({ message: errorMsg, name: errorMsg })) {
              setError(
                'Camera access was denied. On iPhone, go to Settings > Safari > Camera and set it to "Allow", then reload the page.'
              )
            }
          }
        )

        setStarted(true)
      } catch (err: any) {
        if (isPermissionError(err)) {
          setError(
            'Camera access was denied. On iPhone, go to Settings > Safari > Camera and set it to "Allow", then reload the page.'
          )
        } else {
          setError('Could not start camera. Please try again.')
        }
      }
    }

    startScanner()

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {})
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
              Point your camera at the barcode
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
