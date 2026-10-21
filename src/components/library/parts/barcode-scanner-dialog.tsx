'use client'

/**
 * LIBRARY_STORE — Barcode & QR Scanner Dialog
 * Supports:
 * 1. Live camera video feed with native BarcodeDetector
 * 2. Instant track teardown on close/unmount (camera hardware light off)
 * 3. Graceful fallback & error reporting (denied, missing, busy, unsupported)
 * 4. Hardware USB keyboard-wedge capture mode
 * 5. Duplicate product detection with "Open Product" action
 */

import React, { useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { normalizeBarcode } from '@/lib/library/barcode-gen'
import {
  Camera,
  QrCode,
  Keyboard,
  AlertTriangle,
  RefreshCw,
  X,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react'

// Supported 1D and 2D barcode formats for BarcodeDetector
const SCAN_FORMATS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'itf',
  'qr_code',
]

export interface ScannedProductDuplicate {
  id: string
  nameAr: string
  sku: string
  barcode: string
}

export interface BarcodeScannerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScan: (barcode: string) => void
  currentProductId?: string
  existingProducts?: { id: string; nameAr: string; sku: string; barcode: string | null }[]
  onOpenExistingProduct?: (productId: string) => void
}

export function BarcodeScannerDialog({
  open,
  onOpenChange,
  onScan,
  currentProductId,
  existingProducts = [],
  onOpenExistingProduct,
}: BarcodeScannerDialogProps) {
  const [activeTab, setActiveTab] = useState<'camera' | 'usb'>('camera')
  const [cameraError, setCameraError] = useState<{ code: string; messageAr: string; messageEn: string } | null>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [usbInput, setUsbInput] = useState('')
  const [duplicateWarning, setDuplicateWarning] = useState<ScannedProductDuplicate | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const usbInputRef = useRef<HTMLInputElement | null>(null)

  // Clean up media tracks to ensure camera light turns off immediately
  function stopCameraTracks() {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch {
          // ignore
        }
      })
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsCameraActive(false)
  }

  // Check duplicate barcode against existing products
  function checkForDuplicate(rawBarcode: string): ScannedProductDuplicate | null {
    const norm = normalizeBarcode(rawBarcode)
    if (!norm) return null

    const match = existingProducts.find(
      (p) => p.id !== currentProductId && normalizeBarcode(p.barcode) === norm
    )
    if (match) {
      return {
        id: match.id,
        nameAr: match.nameAr,
        sku: match.sku,
        barcode: norm,
      }
    }
    return null
  }

  // Handle successful barcode acquisition
  function handleDetectedCode(code: string) {
    const clean = normalizeBarcode(code)
    if (!clean) return

    // Play subtle audio confirmation
    playScanBeep()

    // Check duplicate
    const dup = checkForDuplicate(clean)
    if (dup) {
      setDuplicateWarning(dup)
      stopCameraTracks()
      return
    }

    stopCameraTracks()
    onScan(clean)
    onOpenChange(false)
  }

  function playScanBeep() {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(1760, ctx.currentTime) // A6 note
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.12)
    } catch {
      // Audio is non-critical
    }
  }

  // Start camera stream
  async function startCamera() {
    stopCameraTracks()
    setCameraError(null)
    setDuplicateWarning(null)

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError({
        code: 'UNSUPPORTED',
        messageAr: 'الوصول إلى الكاميرا غير مدعوم في هذه البيئة',
        messageEn: 'Camera access is not supported in this environment',
      })
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setIsCameraActive(true)
        startScanningLoop()
      }
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string }
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setCameraError({
          code: 'DENIED',
          messageAr: 'تم رفض إذن الوصول إلى الكاميرا من النظام أو المتصفح',
          messageEn: 'Camera access permission was denied',
        })
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setCameraError({
          code: 'MISSING',
          messageAr: 'لم يتم العثور على أي كاميرا متصلة بالجهاز',
          messageEn: 'No camera hardware found on this device',
        })
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        setCameraError({
          code: 'BUSY',
          messageAr: 'الكاميرا قيد الاستخدام بواسطة تطبيق آخر في النظام',
          messageEn: 'Camera is busy or in use by another application',
        })
      } else {
        setCameraError({
          code: 'ERROR',
          messageAr: error.message || 'تعذر تشغيل الكاميرا',
          messageEn: error.message || 'Failed to initialize camera',
        })
      }
    }
  }

  // Detection loop using BarcodeDetector API
  function startScanningLoop() {
    const hasBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window

    if (!hasBarcodeDetector) {
      // BarcodeDetector not available in this engine
      setCameraError({
        code: 'DETECTOR_UNSUPPORTED',
        messageAr: 'التعرف المباشر عبر الكاميرا يتطلب محرك متوافق. يرجى استخدام وضع ماسح الـ USB',
        messageEn: 'BarcodeDetector API is not supported. Please use USB scanner mode',
      })
      stopCameraTracks()
      setActiveTab('usb')
      return
    }

    try {
      const BarcodeDetectorClass = (window as unknown as { BarcodeDetector: new (opts?: { formats: string[] }) => { detect: (source: ImageBitmapSource) => Promise<{ rawValue: string }[]> } }).BarcodeDetector
      const detector = new BarcodeDetectorClass({ formats: SCAN_FORMATS })

      async function scanFrame() {
        if (!videoRef.current || !streamRef.current || videoRef.current.readyState < 2) {
          animFrameRef.current = requestAnimationFrame(scanFrame)
          return
        }

        try {
          const barcodes = await detector.detect(videoRef.current)
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            handleDetectedCode(barcodes[0].rawValue)
            return
          }
        } catch {
          // Frame detection transient error, continue loop
        }

        animFrameRef.current = requestAnimationFrame(scanFrame)
      }

      animFrameRef.current = requestAnimationFrame(scanFrame)
    } catch {
      setActiveTab('usb')
    }
  }

  // Handle open / close lifecycle
  useEffect(() => {
    if (open) {
      setDuplicateWarning(null)
      setUsbInput('')
      if (activeTab === 'camera') {
        void startCamera()
      } else {
        requestAnimationFrame(() => usbInputRef.current?.focus())
      }
    } else {
      stopCameraTracks()
    }
    return () => {
      stopCameraTracks()
    }
  }, [open, activeTab])

  // Handle USB Keyboard wedge submit on Enter
  function handleUsbKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      if (usbInput.trim()) {
        handleDetectedCode(usbInput)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <QrCode className="h-5 w-5 text-primary" />
            <span>مسح باركود أو QR · Scan Barcode</span>
          </DialogTitle>
          <DialogDescription>
            امسح الباركود باستخدام الكاميرا أو قارئ الباركود (USB) لتعيينه للمنتج
          </DialogDescription>
        </DialogHeader>

        {/* Duplicate Warning Dialog Overlay */}
        {duplicateWarning ? (
          <div className="rounded-xl border border-[var(--warning)]/50 bg-[var(--warning)]/10 p-4 text-start">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--warning)]" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-[var(--warning)]">
                  الباركود مستخدم بالفعل
                </p>
                <p className="text-xs text-muted-foreground">
                  تم العثور على هذا الباركود (<span className="font-mono font-semibold" dir="ltr">{duplicateWarning.barcode}</span>) مسجلاً لصالح:
                </p>
                <div className="rounded-lg bg-background/80 p-2 text-xs">
                  <p className="font-bold">{duplicateWarning.nameAr}</p>
                  <p className="font-mono text-muted-foreground" dir="ltr">SKU: {duplicateWarning.sku}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDuplicateWarning(null)
                  if (activeTab === 'camera') void startCamera()
                }}
              >
                مسح رمز آخر
              </Button>
              {onOpenExistingProduct && (
                <Button
                  size="sm"
                  onClick={() => {
                    onOpenExistingProduct(duplicateWarning.id)
                    onOpenChange(false)
                  }}
                >
                  <ExternalLink className="me-1.5 h-3.5 w-3.5" />
                  فتح الصنف المسجل
                </Button>
              )}
            </div>
          </div>
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v as 'camera' | 'usb')
              if (v === 'usb') {
                stopCameraTracks()
                requestAnimationFrame(() => usbInputRef.current?.focus())
              } else {
                void startCamera()
              }
            }}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="camera" className="gap-1.5 text-xs">
                <Camera className="h-4 w-4" />
                الكاميرا · Camera
              </TabsTrigger>
              <TabsTrigger value="usb" className="gap-1.5 text-xs">
                <Keyboard className="h-4 w-4" />
                ماسح USB · Wedge
              </TabsTrigger>
            </TabsList>

            {/* Camera Tab Content */}
            <TabsContent value="camera" className="mt-3 space-y-3">
              <div className="relative aspect-video w-full overflow-hidden rounded-xl border bg-black shadow-inner">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />

                {/* Target Scan Frame Overlay */}
                {isCameraActive && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                    <div className="relative h-36 w-56 rounded-lg border-2 border-primary/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                      <div className="absolute -top-1 -start-1 h-4 w-4 border-t-2 border-s-2 border-primary" />
                      <div className="absolute -top-1 -end-1 h-4 w-4 border-t-2 border-e-2 border-primary" />
                      <div className="absolute -bottom-1 -start-1 h-4 w-4 border-b-2 border-s-2 border-primary" />
                      <div className="absolute -bottom-1 -end-1 h-4 w-4 border-b-2 border-e-2 border-primary" />
                      <div className="absolute inset-x-2 top-1/2 h-0.5 -translate-y-1/2 bg-red-500/70 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                    </div>
                  </div>
                )}

                {/* Camera Error / State Overlay */}
                {cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-background/95">
                    <AlertTriangle className="h-8 w-8 text-[var(--danger)]" />
                    <p className="mt-2 text-sm font-bold text-[var(--danger)]">
                      {cameraError.messageAr}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground" dir="ltr">
                      {cameraError.messageEn}
                    </p>
                    <div className="mt-4 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => void startCamera()}>
                        <RefreshCw className="me-1.5 h-3.5 w-3.5" />
                        إعادة المحاولة
                      </Button>
                      <Button size="sm" onClick={() => setActiveTab('usb')}>
                        <Keyboard className="me-1.5 h-3.5 w-3.5" />
                        التبديل إلى ماسح USB
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-center text-[11px] text-muted-foreground">
                وجّه الكاميرا نحو كود الباركود أو QR ليتم قراءته تلقائياً
              </p>
            </TabsContent>

            {/* USB Keyboard Wedge Tab Content */}
            <TabsContent value="usb" className="mt-3 space-y-3">
              <div className="rounded-xl border bg-muted/20 p-4 text-start">
                <label htmlFor="usb-scanner-input" className="block text-xs font-semibold mb-1.5">
                  التقاط من ماسح الباركود السلكي / اللاسلكي:
                </label>
                <div className="relative">
                  <Input
                    id="usb-scanner-input"
                    ref={usbInputRef}
                    value={usbInput}
                    onChange={(e) => setUsbInput(e.target.value)}
                    onKeyDown={handleUsbKeyDown}
                    placeholder="امسح بالباركود ثم اضغط Enter..."
                    className="font-mono text-sm pe-10"
                    dir="ltr"
                    autoComplete="off"
                  />
                  {usbInput && (
                    <button
                      type="button"
                      onClick={() => setUsbInput('')}
                      className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  عند استخدام قارئ الباركود المحمول (Barcode Gun / Wedge)، يتلقى هذا الحقل الرمز تلقائياً ويقوم بتثبيته عند الضغط على Enter.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  disabled={!usbInput.trim()}
                  onClick={() => handleDetectedCode(usbInput)}
                >
                  <CheckCircle2 className="me-1.5 h-4 w-4" />
                  تأكيد الرمز
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter className="mt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              stopCameraTracks()
              onOpenChange(false)
            }}
          >
            إلغاء · Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
