'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Alert Ticker
// Slim, dismissible operational alert strip under the header: low-stock items.
// Auto-refreshes every 5 minutes; clicks deep-link into the inventory screen.

import { useEffect, useState } from 'react'
import { useLibraryStore } from '../store'
import { api } from '../api'
import { cn } from '@/lib/utils'
import { PackageX, X } from 'lucide-react'

interface AlertData {
  lowStockCount: number
}

const REFRESH_MS = 5 * 60 * 1000
const DISMISS_KEY = 'qx-alerts-dismissed-at'

export function AlertTicker() {
  const setView = useLibraryStore((s) => s.setView)
  const has = useLibraryStore((s) => s.has)
  const [data, setData] = useState<AlertData | null>(null)
  // hydration-safe lazy dismissal state: the ticker only becomes visible after
  // the async dashboard fetch resolves (client-only), so SSR never renders it.
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    const raw = localStorage.getItem(DISMISS_KEY)
    return !!raw && Date.now() - Number(raw) < 30 * 60 * 1000
  })

  useEffect(() => {
    if (!has('INVENTORY_VIEW')) return
    let alive = true
    async function load() {
      try {
        const d = await api<{ lowStockCount: number }>('/dashboard')
        if (alive) setData({ lowStockCount: d.lowStockCount })
      } catch {
        // offline — keep last known
      }
    }
    void load()
    const interval = setInterval(load, REFRESH_MS)
    return () => {
      alive = false
      clearInterval(interval)
    }
  }, [has])

  if (!data || dismissed) return null

  const low = data.lowStockCount > 0
  if (!low) return null

  const tone = 'border-[var(--warning)]/30 bg-[var(--warning)]/8 text-[var(--warning)]'

  function dismiss() {
    setDismissed(true)
    if (typeof window !== 'undefined') localStorage.setItem(DISMISS_KEY, String(Date.now()))
  }

  return (
    <div className={cn('flex items-center gap-2 border-b px-4 py-1.5 text-[11px] font-medium', tone)} role="alert">
      <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1">
        {low && (
          <button className="flex items-center gap-1.5 hover:underline" onClick={() => setView('inventory')}>
            <PackageX className="h-3.5 w-3.5" />
            <span>
              <span className="font-bold tabular-nums">{data.lowStockCount}</span> صنف تحت حد الطلب
            </span>
          </button>
        )}
      </div>
      <button onClick={dismiss} aria-label="إخفاء التنبيهات" className="shrink-0 rounded p-0.5 opacity-60 transition hover:opacity-100">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
