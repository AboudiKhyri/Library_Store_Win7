/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Hardware abstraction layer (browser-safe, client-side)
// Receipt printer / barcode scanner / cash drawer providers.
// The browser cannot talk to POS hardware directly, so:
//  - Printer  → renders a hidden #qx-receipt node (print CSS lives in globals.css)
//               and hands it to window.print() (the OS print dialog targets the
//               receipt printer).
//  - Scanner  → keyboard-wedge detector: scanners emulate a fast keyboard.
//               We accumulate rapid keystrokes and fire on the configured suffix.
//  - Drawer   → simulated pulse + audible beep (clearly labeled "محاكاة").
// This module imports nothing server-only and is safe to import from any client
// component. It must never be imported by an API route.

import type { BusinessConfig, HardwareConfig } from './types'

export interface HardwareResult {
  ok: boolean
  message: string
}

const DEVICE_DISABLED: HardwareResult = { ok: false, message: 'الجهاز معطل في الإعدادات' }

export interface ScannerKeyInfo {
  key: string
  gapMs: number | null
  rapid: boolean
}

export interface ScannerTestHandle {
  stop: () => void
}

// ============================================================
// Printer
// ============================================================

export const PrinterProvider = {
  isConfigured(hw: HardwareConfig): boolean {
    return !!hw.printerEnabled
  },

  async testPrint(hw: HardwareConfig, _business?: BusinessConfig | null): Promise<HardwareResult> {
    if (!hw.printerEnabled) return DEVICE_DISABLED
    if (typeof window === 'undefined') return { ok: false, message: 'الطباعة متاحة داخل المتصفح فقط' }
    try {
      window.print()
      return { ok: true, message: 'تم إرسال أمر الطباعة بنجاح' }
    } catch {
      return { ok: false, message: 'تعذر إرسال أمر الطباعة' }
    }
  },
}

// ============================================================
// Scanner
// ============================================================

export const ScannerProvider = {
  isConfigured(hw: HardwareConfig): boolean {
    return !!hw.scannerEnabled
  },

  listen(hw: HardwareConfig, onScan: (code: string) => void): () => void {
    if (typeof window === 'undefined') return () => undefined
    if (!hw.scannerEnabled) return () => undefined

    const maxGap = Math.max(15, (hw.scannerMinIntervalMs || 30) * 3)
    const settleMs = Math.max(80, maxGap * 3)
    let buffer = ''
    let lastAt = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    const fire = () => {
      if (buffer.length >= 2) {
        const code = buffer
        buffer = ''
        onScan(code)
      } else {
        buffer = ''
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const now = Date.now()
      const gap = lastAt ? now - lastAt : Number.POSITIVE_INFINITY
      lastAt = now
      if (timer) {
        clearTimeout(timer)
        timer = null
      }

      if (e.key === 'Enter' || e.key === 'Tab') {
        const isSuffix =
          (hw.scannerSuffix === 'Enter' && e.key === 'Enter') ||
          (hw.scannerSuffix === 'Tab' && e.key === 'Tab')
        if (isSuffix && buffer && gap <= maxGap) fire()
        else buffer = ''
        return
      }
      if (e.key.length === 1) {
        buffer = gap <= maxGap ? buffer + e.key : e.key
        if (hw.scannerSuffix === 'None' && buffer.length >= 4) {
          timer = setTimeout(fire, settleMs)
        }
      } else {
        buffer = ''
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      if (timer) clearTimeout(timer)
    }
  },
}

/**
 * Test-mode helper for the settings screen: wraps ScannerProvider.listen and
 * additionally reports every keypress + gap so the UI can show live feedback
 * (which keys were seen, how fast, and whether they qualify as scanner speed).
 */
export function startScannerTest(
  hw: HardwareConfig,
  callbacks: { onScan: (code: string) => void; onKey?: (info: ScannerKeyInfo) => void }
): ScannerTestHandle {
  if (typeof window === 'undefined' || !hw.scannerEnabled) {
    return { stop: () => undefined }
  }
  const maxGap = Math.max(15, (hw.scannerMinIntervalMs || 30) * 3)
  let lastAt = 0
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const now = Date.now()
    const gap = lastAt ? now - lastAt : null
    lastAt = now
    if (e.key.length === 1 || e.key === 'Enter' || e.key === 'Tab') {
      callbacks.onKey?.({ key: e.key, gapMs: gap, rapid: gap != null && gap <= maxGap })
    }
  }
  window.addEventListener('keydown', onKeyDown, true)
  const stopListen = ScannerProvider.listen(hw, callbacks.onScan)
  return {
    stop: () => {
      window.removeEventListener('keydown', onKeyDown, true)
      stopListen()
    },
  }
}

// ============================================================
// Cash drawer (simulated pulse)
// ============================================================

function beep(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = 880
      gain.gain.value = 0.06
      osc.connect(gain)
      gain.connect(ctx.destination)
      const t0 = ctx.currentTime + i * 0.18
      osc.start(t0)
      osc.stop(t0 + 0.09)
    }
    window.setTimeout(() => void ctx.close().catch(() => undefined), 800)
  } catch {
    // audio is best-effort only
  }
}

export const CashDrawerProvider = {
  isConfigured(hw: HardwareConfig): boolean {
    return !!hw.cashDrawerEnabled
  },

  /** Simulated drawer kick: browsers cannot pulse the RJ11 line directly. */
  async test(hw: HardwareConfig): Promise<HardwareResult> {
    if (!hw.cashDrawerEnabled) return DEVICE_DISABLED
    if (typeof window === 'undefined') return { ok: false, message: 'الاختبار متاح داخل المتصفح فقط' }
    beep()
    return {
      ok: true,
      message: 'محاكاة: تم إرسال نبضة فتح درج النقدية مع تنبيه صوتي — المتصفح لا يستطيع تشغيل الدرج مباشرة، يتم الفتح فعلياً عبر الطابعة عند طباعة إيصال',
    }
  },
}

// ============================================================
// Facade
// ============================================================

export interface HardwareProvider {
  printer: {
    isConfigured: () => boolean
    testPrint: (business?: BusinessConfig | null) => Promise<HardwareResult>
  }
  scanner: {
    isConfigured: () => boolean
    listen: (onScan: (code: string) => void) => () => void
  }
  drawer: {
    isConfigured: () => boolean
    test: () => Promise<HardwareResult>
  }
}

/** Unified device provider bound to one hardware config; respects enabled flags. */
export function getHardwareProvider(hw: HardwareConfig): HardwareProvider {
  return {
    printer: {
      isConfigured: () => PrinterProvider.isConfigured(hw),
      testPrint: (business) => PrinterProvider.testPrint(hw, business),
    },
    scanner: {
      isConfigured: () => ScannerProvider.isConfigured(hw),
      listen: (onScan) => ScannerProvider.listen(hw, onScan),
    },
    drawer: {
      isConfigured: () => CashDrawerProvider.isConfigured(hw),
      test: () => CashDrawerProvider.test(hw),
    },
  }
}
