'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// Root-LEVEL error boundary: catches failures in the root
// layout itself (fonts, providers, theme crash). Next.js requires this
// component to render its own <html>/<body>.
import { useEffect, useMemo } from 'react'

function generateErrorRef(): string {
  return 'QX-' + Math.random().toString(36).slice(2, 8).toUpperCase()
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const ref = useMemo(() => error?.digest || generateErrorRef(), [error])

  useEffect(() => {
    console.error(`[LIBRARY_STORE][GLOBAL-ERROR][${ref}]`, {
      ref,
      name: error?.name,
      message: error?.message,
      digest: error?.digest,
      stack: error?.stack || String(error),
    })
  }, [error, ref])

  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          padding: '24px',
          textAlign: 'center',
          background: '#10141d',
          color: '#f2f6fb',
          fontFamily: 'Tahoma, "Segoe UI", sans-serif',
        }}
      >
        <div style={{ fontSize: '48px', lineHeight: 1 }} aria-hidden="true">
          ⚠️
        </div>
        <div>
          <h1 style={{ fontSize: '20px', margin: 0 }}>Library Store</h1>
          <h2 style={{ fontSize: '17px', margin: '8px 0 0' }}>خطأ غير متوقع في النظام الأساسي</h2>
          <p style={{ fontSize: '13px', color: '#9fb0c3', margin: '10px 0 0', lineHeight: 2 }}>
            حدث خطأ أثناء تحميل الواجهة الأساسية. اضغط إعادة المحاولة أدناه.
          </p>
        </div>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            cursor: 'pointer',
            border: 0,
            borderRadius: 10,
            padding: '10px 26px',
            fontWeight: 700,
            fontSize: 14,
            background: '#00c8e0',
            color: '#06222a',
          }}
        >
          إعادة المحاولة
        </button>
        <p style={{ fontSize: 12, color: '#9fb0c3', direction: 'ltr' }}>
          Error Reference: {ref}
        </p>
      </body>
    </html>
  )
}
