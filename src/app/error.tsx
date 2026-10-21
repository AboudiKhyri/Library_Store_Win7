'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// Root route-segment error boundary: any uncaught render or
// lifecycle exception inside the application shows a meaningful recovery
// screen instead of an empty WebView. global-error.tsx covers the root
// layout itself; this file covers everything below it.
import { useEffect, useMemo } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

function generateErrorRef(): string {
  return 'QX-' + Math.random().toString(36).slice(2, 8).toUpperCase()
}

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const ref = useMemo(() => error?.digest || generateErrorRef(), [error])

  useEffect(() => {
    // Surface the failure with its reference code for runtime log correlation
    console.error(`[LIBRARY_STORE][FRONTEND-ERROR][${ref}]`, {
      ref,
      name: error?.name,
      message: error?.message,
      digest: error?.digest,
      stack: error?.stack || String(error),
    })
  }, [error, ref])

  return (
    <div
      role="alert"
      dir="rtl"
      className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background p-6 text-center text-foreground"
    >
      <AlertTriangle className="h-12 w-12 text-[var(--danger)]" aria-hidden="true" />
      <div>
        <h1 className="text-xl font-extrabold">خطأ في تحميل النظام</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          حدث خطأ غير متوقع أثناء تشغيل واجهة Library Store. حاول إعادة المحاولة، وإن استمر
          الخطأ برجاء إبلاغ الدعم الفني بالرقم المرجعي الموضح أدناه.
        </p>
      </div>
      <Button onClick={() => reset()} className="gap-2">
        <RefreshCw className="h-4 w-4" />
        إعادة المحاولة
      </Button>
      <p className="font-mono text-xs text-muted-foreground" dir="ltr">
        Error Reference: {ref}
      </p>
    </div>
  )
}
