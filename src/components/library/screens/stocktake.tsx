'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Stocktaking screen (جرد المخزون)
// Sessions list + counting screen with inline counted quantities + FEFO-safe apply.
import { useEffect, useMemo, useState } from 'react'
import { useLibraryStore } from '../store'
import { api, errMessage } from '../api'
import { PageHeader, DataTable, Pagination, ConfirmDialog, StatusBadge, SectionCard, type Column } from '../parts/kit'
import { formatQty } from '../parts/format'
import { useToast } from '@/hooks/use-toast'
import type { Paged } from '@/lib/library/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ClipboardList, Plus, RefreshCw, Search, ArrowRight, Trash2, Loader2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------- API row types ----------

interface SessionRow {
  id: string
  name: string
  status: string
  linesCount: number
  createdAt: string
  appliedAt: string | null
  username: string | null
}

interface CountLine {
  productId: string
  nameAr: string
  sku: string
  systemQty: number
  countedQty: number
  difference: number
  currentQty: number
  batches: { id: string; batchNo: string; qty: number; expiryDate: string | null }[]
}

interface SessionDetail {
  id: string
  name: string
  status: string
  createdAt: string
  appliedAt: string | null
  lines: CountLine[]
}

const num = (v: string): number => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

// ==================================================================

export function StocktakeScreen() {
  const t = useLibraryStore((s) => s.t)
  const fmtDateTime = useLibraryStore((s) => s.fmtDateTime)
  const lang = useLibraryStore((s) => s.lang)
  const { toast } = useToast()

  // sessions list
  const [sessions, setSessions] = useState<SessionRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pageSize = 15

  // new session dialog
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  // counting view
  const [active, setActive] = useState<SessionDetail | null>(null)
  const [activeLoading, setActiveLoading] = useState(false)
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [lineSearch, setLineSearch] = useState('')
  const [applyOpen, setApplyOpen] = useState(false)
  const [applying, setApplying] = useState(false)

  // cancel session
  const [cancelTarget, setCancelTarget] = useState<SessionRow | null>(null)
  const [cancelling, setCancelling] = useState(false)

  async function loadSessions() {
    setLoading(true)
    setError(null)
    try {
      const res = await api<Paged<SessionRow>>(`/inventory/stocktake?page=${page}&pageSize=${pageSize}`)
      setSessions(Array.isArray(res) ? res : (res?.items ?? []))
      setTotal(res?.total ?? (Array.isArray(res) ? res.length : (res?.items?.length ?? 0)))
    } catch (e) {
      setError(errMessage(e))
      setSessions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSessions()
  }, [page])

  async function openSession(id: string) {
    setActiveLoading(true)
    try {
      const res = await api<SessionDetail>(`/inventory/stocktake/${id}`)
      setActive(res)
      setCounts(Object.fromEntries((res?.lines ?? []).map((l) => [l.productId, String(l.countedQty)])))
      setLineSearch('')
    } catch (e) {
      toast({ variant: 'destructive', title: 'تعذر فتح الجلسة', description: errMessage(e) })
    } finally {
      setActiveLoading(false)
    }
  }

  async function createSession() {
    if (!newName.trim()) {
      toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'أدخل اسم جلسة الجرد' })
      return
    }
    setCreating(true)
    try {
      const res = await api<{ sessionId: string }>('/inventory/stocktake', {
        method: 'POST',
        body: { name: newName.trim() },
      })
      toast({ title: 'تم إنشاء جلسة الجرد', description: 'تم تجميد الكميات الدفترية وبدء العد' })
      setNewOpen(false)
      setNewName('')
      await loadSessions()
      await openSession(res.sessionId)
    } catch (e) {
      toast({ variant: 'destructive', title: 'تعذر إنشاء الجلسة', description: errMessage(e) })
    } finally {
      setCreating(false)
    }
  }

  async function applySession() {
    if (!active) return
    setApplying(true)
    try {
      const counted = active.lines.map((l) => ({
        productId: l.productId,
        countedQty: Math.max(0, num(counts[l.productId] ?? String(l.countedQty))),
      }))
      const res = await api<{ adjusted: number }>(`/inventory/stocktake/${active.id}`, {
        method: 'POST',
        body: { counted },
      })
      toast({
        title: 'تم تطبيق الجرد',
        description: `تم تعديل ${res.adjusted} صنفاً ليطابق الكميات الفعلية`,
      })
      setActive(null)
      setPage(1)
      await loadSessions()
    } catch (e) {
      toast({ variant: 'destructive', title: 'تعذر تطبيق الجرد', description: errMessage(e) })
    } finally {
      setApplying(false)
      setApplyOpen(false)
    }
  }

  async function cancelSession() {
    if (!cancelTarget) return
    setCancelling(true)
    try {
      await api(`/inventory/stocktake/${cancelTarget.id}`, { method: 'DELETE' })
      toast({ title: 'تم إلغاء جلسة الجرد', description: cancelTarget.name })
      setCancelTarget(null)
      await loadSessions()
    } catch (e) {
      toast({ variant: 'destructive', title: 'تعذر الإلغاء', description: errMessage(e) })
    } finally {
      setCancelling(false)
    }
  }

  // ---------- counting view ----------

  const changedCount = useMemo(() => {
    if (!active) return 0
    return active.lines.filter((l) => num(counts[l.productId] ?? String(l.countedQty)) !== l.systemQty).length
  }, [active, counts])

  const filteredLines = useMemo(() => {
    if (!active) return []
    const s = lineSearch.trim()
    if (!s) return active.lines
    return active.lines.filter(
      (l) => l.nameAr.includes(s) || l.sku.toLowerCase().includes(s.toLowerCase())
    )
  }, [active, lineSearch])

  const countColumns: Column<CountLine>[] = [
    {
      key: 'nameAr',
      header: t('nav.products'),
      render: (l) => (
        <div className="min-w-44">
          <p className="font-semibold">{l.nameAr}</p>
          <p className="font-mono text-[11px] text-muted-foreground qx-num" dir="ltr">
            {l.sku}
          </p>
        </div>
      ),
    },
    {
      key: 'systemQty',
      header: t('inv.systemQty'),
      render: (l) => <span className="font-bold tabular-nums">{formatQty(l.systemQty, !Number.isInteger(l.systemQty))}</span>,
    },
    {
      key: 'countedQty',
      header: t('inv.countedQty'),
      render: (l) => (
        <Input
          type="number"
          min={0}
          step={0.001}
          dir="ltr"
          className="h-9 w-24 text-end qx-num"
          value={counts[l.productId] ?? String(l.countedQty)}
          onChange={(e) => setCounts((prev) => ({ ...prev, [l.productId]: e.target.value }))}
          aria-label={`الكمية الفعلية لـ ${l.nameAr}`}
        />
      ),
    },
    {
      key: 'difference',
      header: t('inv.difference'),
      render: (l) => {
        const counted = num(counts[l.productId] ?? String(l.countedQty))
        const diff = Math.round((counted - l.systemQty) * 1000) / 1000
        if (diff === 0) return <span className="text-xs text-muted-foreground">—</span>
        return (
          <span className={cn('font-extrabold tabular-nums', diff > 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]')}>
            {diff > 0 ? `+${formatQty(diff, !Number.isInteger(diff))}` : formatQty(diff, !Number.isInteger(diff))}
          </span>
        )
      },
    },
    {
      key: 'batches',
      header: t('nav.batches'),
      render: (l) => (
        <span className="text-[11px] text-muted-foreground">
          {l.batches.length === 0
            ? '—'
            : l.batches
                .map((b) => `${b.batchNo}: ${b.qty}`)
                .join(' · ')}
        </span>
      ),
    },
  ]

  // ---------- render ----------

  if (activeLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('stocktake.title')} icon={<ClipboardList className="h-5 w-5" />} />
        <div className="flex items-center justify-center gap-2 rounded-xl border p-10 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          جارٍ تحميل جلسة الجرد...
        </div>
      </div>
    )
  }

  if (active) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={`${t('stocktake.session')}: ${active.name}`}
          description={`افتُتحت ${fmtDateTime(active.createdAt)} — ${active.lines.length} صنف في العد`}
          icon={<ClipboardList className="h-5 w-5" />}
          actions={
            <Button variant="outline" size="sm" onClick={() => setActive(null)}>
              <ArrowRight className="me-2 h-4 w-4" />
              {t('app.back')}
            </Button>
          }
        />

        <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            عدّ الكميات الفعلية لكل صنف على الرف ثم اضغط «{t('stocktake.apply')}» — سيتم تعديل المخزون عبر
            التخصيص الآمن <span className="font-semibold">FIFO</span> (استهلاك الباتشات الأقدم وصولاً أولاً)،
            وإنشاء باتش مستقل لأي فائض مع تسجيل كل الفروق في حركات المخزون.
          </p>
        </div>

        <SectionCard>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={lineSearch}
                onChange={(e) => setLineSearch(e.target.value)}
                placeholder="تصفية أصناف الجرد..."
                className="ps-9"
                aria-label="تصفية"
              />
            </div>
            <div className="flex items-center gap-3">
              {changedCount > 0 && (
                <span className="rounded-full border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-3 py-1 text-xs font-semibold text-[var(--warning)]">
                  {changedCount} صنف متغيّر
                </span>
              )}
              <Button onClick={() => setApplyOpen(true)}>
                <ClipboardList className="me-2 h-4 w-4" />
                {t('stocktake.apply')}
              </Button>
            </div>
          </div>
        </SectionCard>

        <DataTable
          columns={countColumns}
          rows={filteredLines}
          emptyTitle="لا توجد أصناف مطابقة"
          emptyHint="جرّب مصطلح بحث آخر"
        />

        <ConfirmDialog
          open={applyOpen}
          onOpenChange={setApplyOpen}
          title={t('stocktake.apply')}
          description={`${t('stocktake.applyConfirm')} — سيتم تعديل ${changedCount} صنفاً فعلياً.`}
          confirmLabel="تطبيق الجرد"
          destructive={false}
          pending={applying}
          onConfirm={() => void applySession()}
        />
      </div>
    )
  }

  // ---------- sessions list ----------

  const sessionColumns: Column<SessionRow>[] = [
    { key: 'name', header: t('stocktake.session'), className: 'min-w-40 font-semibold' },
    {
      key: 'status',
      header: t('app.status'),
      render: (s) => <StatusBadge status={s.status} label={s.status === 'OPEN' ? t('stocktake.open') : s.status === 'APPLIED' ? t('stocktake.applied') : t('purchases.cancelled')} />,
    },
    {
      key: 'linesCount',
      header: 'عدد الأصناف',
      render: (s) => <span className="tabular-nums">{s.linesCount}</span>,
    },
    {
      key: 'createdAt',
      header: t('app.date'),
      render: (s) => <span className="whitespace-nowrap text-xs">{fmtDateTime(s.createdAt)}</span>,
    },
    {
      key: 'appliedAt',
      header: 'تاريخ التطبيق',
      render: (s) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {s.appliedAt ? fmtDateTime(s.appliedAt) : '—'}
        </span>
      ),
    },
    {
      key: 'username',
      header: 'المستخدم',
      render: (s) => <span className="text-xs">{s.username ?? '—'}</span>,
    },
    {
      key: 'actions',
      header: t('app.actions'),
      render: (s) => (
        <div className="flex items-center gap-1">
          {s.status === 'OPEN' && (
            <Button variant="outline" size="sm" className="h-9" onClick={() => void openSession(s.id)}>
              متابعة العد
            </Button>
          )}
          {s.status === 'OPEN' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-[var(--danger)]"
              title="إلغاء الجلسة"
              aria-label="إلغاء الجلسة"
              onClick={() => setCancelTarget(s)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
      className: 'whitespace-nowrap',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('stocktake.title')}
        description="جلسات جرد دورية — كل تطبيق يُسجَّل في حركات المخزون ويعزّز دقة الرصيد الدفتري"
        icon={<ClipboardList className="h-5 w-5" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadSessions()} disabled={loading}>
              <RefreshCw className={`me-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              تحديث
            </Button>
            <Button size="sm" onClick={() => setNewOpen(true)}>
              <Plus className="me-2 h-4 w-4" />
              {t('stocktake.new')}
            </Button>
          </div>
        }
      />

      <DataTable
        columns={sessionColumns}
        rows={sessions ?? undefined}
        loading={loading}
        error={error ?? undefined}
        onRetry={loadSessions}
        emptyTitle={t('stocktake.emptyTitle')}
        emptyHint="أنشئ جلسة جرد لتجميد الكميات الدفترية وبدء العد الفعلي للأصناف"
      />

      {!loading && !error && sessions && sessions.length > 0 && (
        <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} />
      )}

      {/* new session dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('stocktake.new')}</DialogTitle>
            <DialogDescription>
              سيتم إنشاء لقطة للكميات الدفترية لكل الأصناف النشطة لبدء العد — دون تجميد البيع أثناء الجرد
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="qx-stocktake-name">اسم الجلسة</Label>
            <Input
              id="qx-stocktake-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="مثال: جرد نهاية الشهر"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void createSession()
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)} disabled={creating}>
              {t('app.cancel')}
            </Button>
            <Button onClick={() => void createSession()} disabled={creating}>
              {creating ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Plus className="me-2 h-4 w-4" />}
              بدء الجرد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(v) => !v && setCancelTarget(null)}
        title={`إلغاء جلسة «${cancelTarget?.name ?? ''}»`}
        description="سيتم إلغاء الجلسة نهائياً دون أي تعديل على المخزون."
        confirmLabel="تأكيد الإلغاء"
        destructive
        pending={cancelling}
        onConfirm={() => void cancelSession()}
      />
    </div>
  )
}
