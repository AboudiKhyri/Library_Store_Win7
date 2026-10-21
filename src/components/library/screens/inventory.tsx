'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Inventory screen (المخزون)
// Tab 1: current stock overview · Tab 2: batches overview · Tab 3: movement ledger
import { useEffect, useMemo, useState } from 'react'
import { useLibraryStore } from '../store'
import { api, errMessage } from '../api'
import { PageHeader, DataTable, Pagination, ConfirmDialog, StatusBadge, SectionCard, type Column } from '../parts/kit'
import { movementTypeLabel } from '../parts/labels'
import { formatQty } from '../parts/format'
import { useToast } from '@/hooks/use-toast'
import type { Paged } from '@/lib/library/types'
import { daysUntil } from '@/lib/library/money'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Boxes,
  RefreshCw,
  Search,
  PackageX,
  CalendarX,
  Timer,
  SlidersHorizontal,
  Layers,
  History,
  ShieldAlert,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------- API row types ----------

interface StockRow {
  productId: string
  nameAr: string
  sku: string
  barcode: string | null
  categoryName: string | null
  unit: string
  reorderLevel: number
  stockAvailable: number
  stockTotal: number
  stockValue: number
  batchCount: number
}

interface BatchRow {
  id: string
  productId: string
  productName: string
  sku: string
  batchNo: string
  daysLeft: number | null
  quantity: number
  costPrice: number
  status: string
  supplierName: string | null
  purchaseInvoiceNo: string | null
  createdAt: string
}

interface MovementRow {
  id: string
  productId: string
  productName: string
  sku: string
  batchNo: string | null
  type: string
  quantity: number
  unitCost: number | null
  note: string | null
  refType: string | null
  refId: string | null
  username: string | null
  createdAt: string
}

interface CategoryLite {
  id: string
  nameAr: string
}

const MOVEMENT_TYPES = [
  'PURCHASE_RECEIVE',
  'SALE',
  'SALE_CANCEL_RESTOCK',
  'RETURN_IN',
  'ADJUSTMENT',
  'DAMAGE',
  'STOCKTAKE',
  'INITIAL',
]

function num(v: string): number {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

function Chip({
  active,
  tone = 'default',
  children,
  onClick,
}: {
  active: boolean
  tone?: 'default' | 'warning' | 'danger'
  children: React.ReactNode
  onClick: () => void
}) {
  const toneActive =
    tone === 'danger'
      ? 'border-[var(--danger)] bg-[var(--danger)]/12 text-[var(--danger)]'
      : tone === 'warning'
        ? 'border-[var(--warning)] bg-[var(--warning)]/12 text-[var(--warning)]'
        : 'border-primary bg-primary/10 text-primary'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition',
        active ? toneActive : 'bg-background text-muted-foreground hover:bg-muted/60'
      )}
    >
      {children}
    </button>
  )
}

// ==================================================================

export function InventoryScreen() {
  const t = useLibraryStore((s) => s.t)
  const status = useLibraryStore((s) => s.status)

  // shared adjust dialog (used by batches tab + product batches dialog)
  const [adjustBatch, setAdjustBatch] = useState<BatchRow | null>(null)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('inv.title')}
        description={t('inv.fifo')}
        icon={<Boxes className="h-5 w-5" />}
      />

      <Tabs defaultValue="stock" dir="rtl">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 sm:w-auto">
          <TabsTrigger value="stock" className="gap-1.5">
            <Boxes className="h-4 w-4" />
            {t('inv.stock')}
          </TabsTrigger>
          <TabsTrigger value="batches" className="gap-1.5">
            <Layers className="h-4 w-4" />
            الباتشات
          </TabsTrigger>
          <TabsTrigger value="movements" className="gap-1.5">
            <History className="h-4 w-4" />
            {t('inv.movements')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="mt-4">
          <CurrentStockTab warningDays={warningDays} onAdjust={(b) => setAdjustBatch(b)} />
        </TabsContent>
        <TabsContent value="batches" className="mt-4">
          <BatchesTab warningDays={warningDays} onAdjust={(b) => setAdjustBatch(b)} />
        </TabsContent>
        <TabsContent value="movements" className="mt-4">
          <MovementsTab />
        </TabsContent>
      </Tabs>

      <AdjustDialog batch={adjustBatch} onClose={() => setAdjustBatch(null)} />
    </div>
  )
}

// ==================================================================
// Tab 1 — current stock per product

function CurrentStockTab({
  warningDays,
  onAdjust,
}: {
  warningDays: number
  onAdjust: (b: BatchRow) => void
}) {
  const t = useLibraryStore((s) => s.t)
  const money = useLibraryStore((s) => s.money)
  const fmtDate = useLibraryStore((s) => s.fmtDate)

  const [rows, setRows] = useState<StockRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pageSize = 15

  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [filter, setFilter] = useState('')
  const [categories, setCategories] = useState<CategoryLite[]>([])

  // product batches dialog
  const [batchesTarget, setBatchesTarget] = useState<StockRow | null>(null)
  const [productBatches, setProductBatches] = useState<BatchRow[] | null>(null)
  const [batchesLoading, setBatchesLoading] = useState(false)

  useEffect(() => {
    const h = setTimeout(() => setDebouncedQ(q), 400)
    return () => clearTimeout(h)
  }, [q])

  useEffect(() => {
    setPage(1)
  }, [debouncedQ, categoryId, filter])

  useEffect(() => {
    void (async () => {
      try {
        const res = await api<Paged<CategoryLite>>('/categories?pageSize=100')
        setCategories(Array.isArray(res) ? res : (res?.items ?? []))
      } catch {
        setCategories([])
      }
    })()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (debouncedQ) params.set('q', debouncedQ)
      if (categoryId !== 'all') params.set('categoryId', categoryId)
      if (filter) params.set('filter', filter)
      const res = await api<Paged<StockRow>>(`/inventory?${params.toString()}`)
      setRows(res.items)
      setTotal(res.total)
    } catch (e) {
      setError(errMessage(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [page, debouncedQ, categoryId, filter])

  useEffect(() => {
    if (!batchesTarget) {
      setProductBatches(null)
      return
    }
    let alive = true
    setBatchesLoading(true)
    void (async () => {
      try {
        const res = await api<Paged<BatchRow>>(`/inventory/batches?productId=${batchesTarget.productId}&pageSize=100`)
        if (alive) setProductBatches(res.items)
      } catch {
        if (alive) setProductBatches([])
      } finally {
        if (alive) setBatchesLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [batchesTarget])

  const columns: Column<StockRow>[] = [
    {
      key: 'product',
      header: t('nav.products'),
      render: (r) => (
        <div className="min-w-44">
          <p className="font-semibold">{r.nameAr}</p>
          <p className="font-mono text-[11px] text-muted-foreground qx-num" dir="ltr">
            {r.sku}
          </p>
        </div>
      ),
    },
    {
      key: 'categoryName',
      header: t('nav.categories'),
      render: (r) => <span className="text-xs text-muted-foreground">{r.categoryName ?? '—'}</span>,
    },
    {
      key: 'stockAvailable',
      header: 'المتاح',
      render: (r) => {
        const low = r.stockAvailable <= r.reorderLevel
        return (
          <span className={cn('font-extrabold tabular-nums', low ? 'text-[var(--warning)]' : 'text-foreground')}>
            {formatQty(r.stockAvailable, !Number.isInteger(r.stockAvailable))}
            {low && <span className="ms-1 text-[10px] font-semibold">≤ {r.reorderLevel}</span>}
          </span>
        )
      },
    },
    {
      key: 'stockTotal',
      header: 'الإجمالي',
      render: (r) => <span className="tabular-nums text-muted-foreground">{formatQty(r.stockTotal, !Number.isInteger(r.stockTotal))}</span>,
    },
    {
      key: 'stockValue',
      header: t('inv.value'),
      render: (r) => <span className="font-semibold tabular-nums">{money(r.stockValue)}</span>,
      headerClassName: 'text-end',
      className: 'text-end',
    },
    {
      key: 'batchCount',
      header: t('nav.batches'),
      render: (r) => <span className="tabular-nums">{r.batchCount}</span>,
    },
  ]

  return (
    <div className="space-y-4">
      <SectionCard>
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث بالاسم / SKU / الباركود..."
              className="ps-9"
              aria-label="بحث"
            />
          </div>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-full lg:w-48" aria-label="التصنيف">
              <SelectValue placeholder={t('nav.categories')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('app.all')}</SelectItem>
              {(categories ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nameAr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap items-center gap-2">
            <Chip active={filter === 'low'} tone="warning" onClick={() => setFilter(filter === 'low' ? '' : 'low')}>
              <PackageX className="h-3.5 w-3.5" />
              تحت حد الطلب
            </Chip>
          </div>
        </div>
      </SectionCard>

      <DataTable
        columns={columns}
        rows={rows ?? undefined}
        loading={loading}
        error={error ?? undefined}
        onRetry={load}
        onRowClick={(r) => setBatchesTarget(r)}
        emptyTitle={t('inv.emptyTitle')}
        emptyHint="لا توجد أصناف مطابقة — جرّب تغيير البحث أو عوامل التصفية"
      />

      {!loading && !error && rows && rows.length > 0 && (
        <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} />
      )}

      {/* product batches dialog */}
      <Dialog open={!!batchesTarget} onOpenChange={(v) => !v && setBatchesTarget(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>باتشات: {batchesTarget?.nameAr}</DialogTitle>
            <DialogDescription>
              {batchesTarget
                ? `المتاح ${batchesTarget.stockAvailable} · الإجمالي ${batchesTarget.stockTotal} · القيمة ${money(batchesTarget.stockValue)}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {batchesLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : productBatches && productBatches.length > 0 ? (
            <div className="qx-scroll max-h-[55vh] overflow-y-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/95 text-xs text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="px-3 py-2 text-start font-medium">{t('inv.batchNo')}</th>
                    <th className="px-3 py-2 text-start font-medium">{t('app.quantity')}</th>
                    <th className="px-3 py-2 text-start font-medium">{t('inv.cost')}</th>
                    <th className="px-3 py-2 text-start font-medium">{t('app.status')}</th>
                    <th className="px-3 py-2 text-end font-medium">{t('app.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {productBatches.map((b) => {
                    return (
                      <tr key={b.id} className="border-t">
                        <td className="px-3 py-2 font-mono text-xs qx-num" dir="ltr">
                          {b.batchNo}
                        </td>
                        <td className="px-3 py-2 font-semibold tabular-nums">{formatQty(b.quantity, !Number.isInteger(b.quantity))}</td>
                        <td className="px-3 py-2 tabular-nums">{money(b.costPrice)}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={b.status} />
                        </td>
                        <td className="px-3 py-2 text-end">
                          <Button variant="outline" size="sm" className="h-8" onClick={() => onAdjust(b)}>
                            <SlidersHorizontal className="me-1.5 h-3.5 w-3.5" />
                            تسوية
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              لا توجد باتشات لهذا الصنف
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ==================================================================
// Tab 2 — batches overview

function BatchesTab({
  warningDays,
  onAdjust,
}: {
  warningDays: number
  onAdjust: (b: BatchRow) => void
}) {
  const t = useLibraryStore((s) => s.t)
  const money = useLibraryStore((s) => s.money)
  const fmtDate = useLibraryStore((s) => s.fmtDate)
  const has = useLibraryStore((s) => s.has)
  const { toast } = useToast()

  const [rows, setRows] = useState<BatchRow[] | null>(null)
  const [stats, setStats] = useState<{ valid: number; depleted?: number }>({ valid: 0, depleted: 0 })
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pageSize = 15

  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [filter, setFilter] = useState('')

  useEffect(() => {
    const h = setTimeout(() => setDebouncedQ(q), 400)
    return () => clearTimeout(h)
  }, [q])

  useEffect(() => {
    setPage(1)
  }, [debouncedQ, filter])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (debouncedQ) params.set('q', debouncedQ)
      if (filter) params.set('filter', filter)
      const res = await api<Paged<BatchRow> & { stats: { valid: number; depleted?: number } }>(
        `/inventory/batches?${params.toString()}`
      )
      setRows(res.items)
      setStats(res.stats)
      setTotal(res.total)
    } catch (e) {
      setError(errMessage(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [page, debouncedQ, filter])


  const columns: Column<BatchRow>[] = [
    {
      key: 'productName',
      header: t('nav.products'),
      render: (r) => (
        <div className="min-w-40">
          <p className="font-semibold">{r.productName}</p>
          <p className="font-mono text-[11px] text-muted-foreground qx-num" dir="ltr">
            {r.sku}
          </p>
        </div>
      ),
    },
    {
      key: 'batchNo',
      header: t('inv.batchNo'),
      render: (r) => (
        <span className="font-mono text-xs font-semibold qx-num" dir="ltr">
          {r.batchNo}
        </span>
      ),
    },
    {
      key: 'quantity',
      header: t('app.quantity'),
      render: (r) => <span className="font-bold tabular-nums">{formatQty(r.quantity, !Number.isInteger(r.quantity))}</span>,
    },
    {
      key: 'costPrice',
      header: t('inv.cost'),
      render: (r) => <span className="tabular-nums">{money(r.costPrice)}</span>,
    },
    {
      key: 'status',
      header: t('app.status'),
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'supplierName',
      header: t('purchases.supplier'),
      render: (r) => (
        <div className="min-w-32">
          <p className="text-xs">{r.supplierName ?? '—'}</p>
          {r.purchaseInvoiceNo && (
            <p className="font-mono text-[10px] text-muted-foreground qx-num" dir="ltr">
              {r.purchaseInvoiceNo}
            </p>
          )}
        </div>
      ),
    },
    ...(has('INVENTORY_ADJUST')
      ? [
          {
            key: 'actions',
            header: t('app.actions'),
            render: (r: BatchRow) => (
              <Button variant="outline" size="sm" className="h-8" onClick={() => onAdjust(r)}>
                <SlidersHorizontal className="me-1.5 h-3.5 w-3.5" />
                تسوية
              </Button>
            ),
            className: 'whitespace-nowrap',
          } as Column<BatchRow>,
        ]
      : []),
  ]

  return (
    <div className="space-y-4">
      {/* summary strip */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryStat label="الباتشات النشطة" value={stats.valid} tone="success" icon={<ShieldAlert className="h-4 w-4" />} />
        <SummaryStat label="المستنفدة" value={stats.depleted ?? 0} tone="default" icon={<Boxes className="h-4 w-4" />} />
      </div>

      <SectionCard>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث بالصنف أو رقم الباتش..."
              className="ps-9"
              aria-label="بحث"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip active={filter === 'active' || filter === 'valid'} onClick={() => setFilter(filter === 'active' ? '' : 'active')}>
              النشطة
            </Chip>
            <Chip active={filter === 'depleted'} onClick={() => setFilter(filter === 'depleted' ? '' : 'depleted')}>
              المستنفدة
            </Chip>
          </div>
        </div>
      </SectionCard>

      <DataTable
        columns={columns}
        rows={rows ?? undefined}
        loading={loading}
        error={error ?? undefined}
        onRetry={load}
        emptyTitle={t('inv.emptyTitle')}
        emptyHint="لا توجد باتشات مطابقة"
      />

      {!loading && !error && rows && rows.length > 0 && (
        <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} />
      )}
    </div>
  )
}

function SummaryStat({
  label,
  value,
  tone,
  icon,
}: {
  label: string
  value: number
  tone: 'danger' | 'warning' | 'success'
  icon: React.ReactNode
}) {
  const toneText =
    tone === 'danger'
      ? 'text-[var(--danger)]'
      : tone === 'warning'
        ? 'text-[var(--warning)]'
        : 'text-[var(--success)]'
  const toneBg =
    tone === 'danger'
      ? 'bg-[var(--danger)]/10 text-[var(--danger)]'
      : tone === 'warning'
        ? 'bg-[var(--warning)]/10 text-[var(--warning)]'
        : 'bg-[var(--success)]/10 text-[var(--success)]'
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4">
      <div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={cn('mt-1 text-2xl font-extrabold tabular-nums', toneText)}>{value}</p>
      </div>
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', toneBg)}>{icon}</div>
    </div>
  )
}

// ==================================================================
// Tab 3 — movements ledger

function MovementsTab() {
  const t = useLibraryStore((s) => s.t)
  const money = useLibraryStore((s) => s.money)
  const fmtDateTime = useLibraryStore((s) => s.fmtDateTime)
  const lang = useLibraryStore((s) => s.lang)

  const [rows, setRows] = useState<MovementRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pageSize = 30

  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [type, setType] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    const h = setTimeout(() => setDebouncedQ(q), 400)
    return () => clearTimeout(h)
  }, [q])

  useEffect(() => {
    setPage(1)
  }, [debouncedQ, type, from, to])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (debouncedQ) params.set('q', debouncedQ)
      if (type !== 'all') params.set('type', type)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const res = await api<Paged<MovementRow>>(`/inventory/movements?${params.toString()}`)
      setRows(res.items)
      setTotal(res.total)
    } catch (e) {
      setError(errMessage(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [page, debouncedQ, type, from, to])

  const columns: Column<MovementRow>[] = [
    {
      key: 'createdAt',
      header: t('app.date'),
      render: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{fmtDateTime(r.createdAt)}</span>,
    },
    {
      key: 'productName',
      header: t('nav.products'),
      render: (r) => (
        <div className="min-w-36">
          <p className="font-medium">{r.productName}</p>
          <p className="font-mono text-[11px] text-muted-foreground qx-num" dir="ltr">
            {r.sku}
          </p>
        </div>
      ),
    },
    {
      key: 'batchNo',
      header: t('inv.batchNo'),
      render: (r) => (
        <span className="font-mono text-xs qx-num" dir="ltr">
          {r.batchNo ?? '—'}
        </span>
      ),
    },
    {
      key: 'type',
      header: t('inv.type'),
      render: (r) => <span className="text-xs font-semibold">{movementTypeLabel(r.type, lang)}</span>,
    },
    {
      key: 'quantity',
      header: t('app.quantity'),
      render: (r) => (
        <span
          className={cn(
            'font-extrabold tabular-nums',
            r.quantity >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'
          )}
        >
          {r.quantity > 0 ? `+${formatQty(r.quantity, !Number.isInteger(r.quantity))}` : formatQty(r.quantity, !Number.isInteger(r.quantity))}
        </span>
      ),
    },
    {
      key: 'unitCost',
      header: t('inv.cost'),
      render: (r) => <span className="text-xs tabular-nums text-muted-foreground">{r.unitCost != null ? money(r.unitCost) : '—'}</span>,
    },
    {
      key: 'note',
      header: t('app.note'),
      render: (r) => <span className="text-xs text-muted-foreground">{r.note ?? '—'}</span>,
    },
    {
      key: 'username',
      header: 'المستخدم',
      render: (r) => <span className="text-xs">{r.username ?? '—'}</span>,
    },
  ]

  return (
    <div className="space-y-4">
      <SectionCard>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث باسم الصنف..."
              className="ps-9"
              aria-label="بحث"
            />
          </div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger aria-label={t('inv.type')}>
              <SelectValue placeholder={t('inv.type')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('app.all')}</SelectItem>
              {MOVEMENT_TYPES.map((mt) => (
                <SelectItem key={mt} value={mt}>
                  {movementTypeLabel(mt, lang)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="من تاريخ" className="qx-num" />
            <span className="shrink-0 text-xs text-muted-foreground">{t('app.to')}</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="إلى تاريخ" className="qx-num" />
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading} className="justify-self-start">
            <RefreshCw className={`me-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </Button>
        </div>
      </SectionCard>

      <DataTable
        columns={columns}
        rows={rows ?? undefined}
        loading={loading}
        error={error ?? undefined}
        onRetry={load}
        emptyTitle="لا توجد حركات مخزون"
        emptyHint="ستظهر هنا كل حركات المخزون — استلام الشراء، البيع، التسويات والجرد"
      />

      {!loading && !error && rows && rows.length > 0 && (
        <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} />
      )}
    </div>
  )
}

// ==================================================================
// Shared adjust dialog

function AdjustDialog({ batch, onClose }: { batch: BatchRow | null; onClose: () => void }) {
  const t = useLibraryStore((s) => s.t)
  const money = useLibraryStore((s) => s.money)
  const fmtDate = useLibraryStore((s) => s.fmtDate)
  const lang = useLibraryStore((s) => s.lang)
  const { toast } = useToast()

  const [countedQty, setCountedQty] = useState('')
  const [type, setType] = useState('ADJUSTMENT')
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (batch) {
      setCountedQty(String(batch.quantity))
      setType('ADJUSTMENT')
      setReason('')
    }
  }, [batch])

  const delta = useMemo(() => num(countedQty) - (batch?.quantity ?? 0), [countedQty, batch])

  async function submit() {
    if (!batch) return
    if (num(countedQty) < 0 || !Number.isInteger(num(countedQty))) {
      toast({ variant: 'destructive', title: 'كمية غير صالحة', description: 'أدخل كمية صحيحة غير سالبة' })
      return
    }
    setPending(true)
    try {
      const res = await api<{ batchId: string; delta: number }>('/inventory/adjust', {
        method: 'POST',
        body: {
          batchId: batch.id,
          countedQty: num(countedQty),
          type,
          reason: reason.trim() || undefined,
        },
      })
      toast({
        title: 'تم تطبيق التسوية',
        description: `${batch.productName} (${batch.batchNo}) — التغيير: ${res.delta > 0 ? `+${res.delta}` : res.delta}`,
      })
      onClose()
    } catch (e) {
      toast({ variant: 'destructive', title: 'تعذر تطبيق التسوية', description: errMessage(e) })
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={!!batch} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('inv.adjust')}</DialogTitle>
          <DialogDescription>
            سيتم تحديث كمية الباتش الدفترية وتسجيل حركة مخزون موقّعة بالفرق — لا يمكن التراجع
          </DialogDescription>
        </DialogHeader>

        {batch && (
          <div className="space-y-4">
            <div className="space-y-1 rounded-xl border bg-muted/20 p-3 text-sm">
              <p className="font-semibold">{batch.productName}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  {t('inv.batchNo')}: <span className="font-mono qx-num" dir="ltr">{batch.batchNo}</span>
                </span>
                <span>
                                  </span>
                <span>
                  {t('inv.cost')}: <span className="tabular-nums">{money(batch.costPrice)}</span>
                </span>
                <span>
                  {t('inv.systemQty')}: <span className="font-bold text-foreground tabular-nums">{formatQty(batch.quantity, !Number.isInteger(batch.quantity))}</span>
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t('inv.countedQty')}</Label>
                <Input
                  type="number"
                  min={0}
                  dir="ltr"
                  className="text-end qx-num"
                  value={countedQty}
                  onChange={(e) => setCountedQty(e.target.value)}
                />
                {delta !== 0 && (
                  <p className={cn('text-xs font-semibold', delta > 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]')}>
                    {t('inv.difference')}: {delta > 0 ? `+${delta}` : delta}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>{t('inv.type')}</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADJUSTMENT">{movementTypeLabel('ADJUSTMENT', lang)}</SelectItem>
                    <SelectItem value="DAMAGE">{movementTypeLabel('DAMAGE', lang)}</SelectItem>
                        </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>
                {t('app.reason')} <span className="text-muted-foreground/60">({t('app.optional')})</span>
              </Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="سبب التسوية — يُسجَّل مع الحركة"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            {t('app.cancel')}
          </Button>
          <Button onClick={() => void submit()} disabled={pending || delta === 0}>
            {pending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
            تطبيق التسوية
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
