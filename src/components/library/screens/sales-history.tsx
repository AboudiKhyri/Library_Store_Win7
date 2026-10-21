'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — sales history screen (سجل المبيعات)
// Filters + paged table + detail dialog (batch traceability, receipt print,
// cancel with reason, return hand-off).
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLibraryStore } from '../store'
import { api, errMessage } from '../api'
import { useToast } from '@/hooks/use-toast'
import {
  PageHeader,
  DataTable,
  type Column,
  Pagination,
  StatusBadge,
} from '../parts/kit'
import { paymentLabel, saleStatusLabel } from '../parts/labels'
import { formatQty } from '../parts/format'
import { ReceiptView } from '../parts/receipt'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ReceiptData, BusinessConfig, BrandingConfig, Paged } from '@/lib/library/types'
import {
  History,
  Search,
  RotateCcw,
  Printer,
  Ban,
  Undo2,
  Loader2,
  ReceiptText,
} from 'lucide-react'

interface SaleRow {
  id: string
  invoiceNo: string
  createdAt: string
  cashierName: string
  customerName: string | null
  status: string
  total: number
  paidAmount: number
  paymentMethod: string
  itemsCount: number
}

interface CashierOption {
  id: string
  displayName: string
}

interface SaleItemRow {
  id: string
  productName: string
  batchNo: string | null
  expiryDate: string | null
  quantity: number
  returnedQty: number
  unitPrice: number
  discount: number
  total: number
}

interface SaleDetail {
  sale: {
    id: string
    invoiceNo: string
    createdAt: string
    status: string
    subtotal: number
    discount: number
    tax: number
    total: number
    paidAmount: number
    changeAmount: number
    paymentMethod: string
    notes: string | null
    cashierName: string
    customerName: string | null
    items: SaleItemRow[]
  }
  receipt: ReceiptData
}

const STATUS_OPTIONS = ['COMPLETED', 'PARTIALLY_RETURNED', 'RETURNED', 'CANCELLED']

// quick date ranges for cashier workflow speed
const QUICK_RANGES: { key: string; label: string; days: number | null }[] = [
  { key: 'all', label: 'الكل', days: null },
  { key: 'today', label: 'اليوم', days: 0 },
  { key: '7d', label: 'آخر ٧ أيام', days: 6 },
  { key: '30d', label: 'آخر ٣٠ يوم', days: 29 },
]

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const EMPTY_BUSINESS: BusinessConfig = {
  businessName: '',
  displayName: '',
  owner: '',
  address: '',
  phone: '',
  phone2: '',
  email: '',
  taxId: '',
  receiptHeader: '',
  receiptFooter: '',
  notes: '',
}

const EMPTY_BRANDING: BrandingConfig = {
  primary: '#00c8e0',
  secondary: '#14b8a6',
  accent: '#22d3ee',
  appName: 'Library Store',
  logoDataUrl: null,
  defaultTheme: 'dark',
}

export function SalesHistoryScreen() {
  const t = useLibraryStore((s) => s.t)
  const money = useLibraryStore((s) => s.money)
  const fmtDateTime = useLibraryStore((s) => s.fmtDateTime)
  const fmtDate = useLibraryStore((s) => s.fmtDate)
  const lang = useLibraryStore((s) => s.lang)
  const status = useLibraryStore((s) => s.status)
  const has = useLibraryStore((s) => s.has)
  const setView = useLibraryStore((s) => s.setView)
  const viewParams = useLibraryStore((s) => s.viewParams)
  const { toast } = useToast()

  // filters
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [cashierId, setCashierId] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [quickRange, setQuickRange] = useState<string>('all')
  const [cashiers, setCashiers] = useState<CashierOption[]>([])

  // ---- drill-down hand-off: dashboard chart click passes from/to ----
  const paramsKey = JSON.stringify(viewParams)
  const drillHandled = useRef('')
  useEffect(() => {
    if (paramsKey === drillHandled.current || paramsKey === '{}') return
    drillHandled.current = paramsKey
    const fromParam = typeof viewParams.from === 'string' ? viewParams.from : null
    const toParam = typeof viewParams.to === 'string' ? viewParams.to : null
    if (fromParam && toParam) {
      setFrom(fromParam)
      setTo(toParam)
      setQuickRange('custom')
      setPage(1)
    }
  }, [paramsKey])

  // list
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Paged<SaleRow> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // dialogs
  const [detail, setDetail] = useState<SaleDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelBusy, setCancelBusy] = useState(false)

  function applyQuickRange(key: string) {
    const range = QUICK_RANGES.find((r) => r.key === key)
    if (!range) return
    setQuickRange(key)
    if (range.days === null) {
      setFrom('')
      setTo('')
    } else {
      const today = new Date()
      const start = new Date(today.getTime() - range.days * 86400000)
      setFrom(toLocalDateStr(start))
      setTo(toLocalDateStr(today))
    }
    setPage(1)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(q.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [q])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (debouncedQ) params.set('q', debouncedQ)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (cashierId !== 'all') params.set('cashierId', cashierId)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      params.set('page', String(page))
      const res = await api<Paged<SaleRow>>(`/sales?${params.toString()}`)
      setData(Array.isArray(res) ? { items: res, total: res.length, page: 1, pageSize: 20 } : { ...res, items: res?.items ?? [] })
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setLoading(false)
    }
  }, [debouncedQ, statusFilter, cashierId, from, to, page])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    api<CashierOption[]>('/sales?mode=cashiers')
      .then(setCashiers)
      .catch(() => setCashiers([]))
  }, [])

  async function openDetail(row: SaleRow) {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetail(null)
    try {
      setDetail(await api<SaleDetail>(`/sales/${row.id}`))
    } catch (e) {
      setDetailOpen(false)
      setError(errMessage(e))
    } finally {
      setDetailLoading(false)
    }
  }

  async function doCancel() {
    if (!detail) return
    setCancelBusy(true)
    try {
      await api(`/sales/${detail.sale.id}/cancel`, {
        method: 'POST',
        body: { reason: cancelReason.trim() || undefined },
      })
      toast({ title: 'تم بنجاح', description: `تم إلغاء الفاتورة ${detail.sale.invoiceNo} وإرجاع الكميات للمخزون` })
      setCancelOpen(false)
      setCancelReason('')
      setDetailOpen(false)
      setDetail(null)
      void load()
    } catch (e) {
      toast({ variant: 'destructive', title: 'حدث خطأ', description: errMessage(e) })
    } finally {
      setCancelBusy(false)
    }
  }

  const columns: Column<SaleRow>[] = [
    {
      key: 'invoiceNo',
      header: t('sales.invoiceNo'),
      render: (r) => (
        <span className="qx-num font-mono text-xs font-bold" dir="ltr">
          {r.invoiceNo}
        </span>
      ),
      className: 'whitespace-nowrap',
    },
    {
      key: 'createdAt',
      header: t('app.date'),
      render: (r) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">{fmtDateTime(r.createdAt)}</span>
      ),
    },
    { key: 'cashierName', header: t('sales.cashier'), render: (r) => <span className="text-xs">{r.cashierName}</span> },
    {
      key: 'customerName',
      header: t('sales.customer'),
      render: (r) => <span className="text-xs">{r.customerName ?? t('pos.walkIn')}</span>,
    },
    {
      key: 'itemsCount',
      header: t('sales.items'),
      render: (r) => <span className="qx-num tabular-nums" dir="ltr">{r.itemsCount}</span>,
      className: 'tabular-nums',
    },
    {
      key: 'paymentMethod',
      header: t('pos.paymentMethod'),
      render: (r) => <span className="text-xs">{paymentLabel(r.paymentMethod, lang)}</span>,
    },
    {
      key: 'total',
      header: t('app.total'),
      render: (r) => (
        <span className="qx-num block text-end font-extrabold tabular-nums" dir="ltr">
          {money(r.total)}
        </span>
      ),
      headerClassName: 'text-end',
      className: 'text-end',
    },
    {
      key: 'status',
      header: t('app.status'),
      render: (r) => <StatusBadge status={r.status} label={saleStatusLabel(r.status, lang)} />,
    },
  ]

  const detailSale = detail?.sale

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('sales.title')}
        description="كل الفواتير مع تتبع الدفعات والمرتجعات والإلغاءات"
        icon={<History className="h-5 w-5" />}
        actions={
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RotateCcw className="me-2 h-4 w-4" />
            تحديث
          </Button>
        }
      />

      {/* filters */}
      <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground" htmlFor="qx-sales-q">
            بحث
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute inset-y-0 start-2.5 my-auto h-4 w-4 text-muted-foreground" />
            <Input
              id="qx-sales-q"
              className="h-9 ps-8"
              placeholder="رقم الفاتورة أو اسم العميل"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">الحالة</Label>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {saleStatusLabel(s, lang)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t('sales.cashier')}</Label>
          <Select value={cashierId} onValueChange={(v) => { setCashierId(v); setPage(1) }}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              {cashiers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground" htmlFor="qx-sales-from">
            من تاريخ
          </Label>
          <Input
            id="qx-sales-from"
            type="date"
            className="qx-num h-9"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setQuickRange('custom'); setPage(1) }}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground" htmlFor="qx-sales-to">
            إلى تاريخ
          </Label>
          <Input
            id="qx-sales-to"
            type="date"
            className="qx-num h-9"
            value={to}
            onChange={(e) => { setTo(e.target.value); setQuickRange('custom'); setPage(1) }}
          />
        </div>
      </div>

      {/* quick date ranges + live totals */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="فترات سريعة">
          {QUICK_RANGES.map((r) => {
            const active = quickRange === r.key
            return (
              <button
                key={r.key}
                onClick={() => applyQuickRange(r.key)}
                className={
                  'h-7 rounded-full border px-3 text-[11px] font-semibold transition ' +
                  (active
                    ? 'border-primary/50 bg-primary/15 text-primary'
                    : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/30 hover:text-foreground')
                }
              >
                {r.label}
              </button>
            )
          })}
        </div>
        {data && (data.items?.length ?? 0) > 0 && (
          <p className="text-[11px] text-muted-foreground">
            <span className="font-bold tabular-nums text-foreground">{data.total}</span> فاتورة · إجمالي معروض{' '}
            <span className="font-bold tabular-nums text-primary">{money((data.items ?? []).reduce((s, r) => s + r.total, 0))}</span>
          </p>
        )}
      </div>

      {/* table */}
      <DataTable
        columns={columns}
        rows={data?.items}
        loading={loading}
        error={error ?? undefined}
        onRetry={() => void load()}
        onRowClick={(r) => void openDetail(r)}
        emptyTitle={t('sales.emptyTitle')}
        emptyHint="لم يتم العثور على فواتير مطابقة لعوامل التصفية الحالية"
        emptyAction={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setQ('')
              setStatusFilter('all')
              setCashierId('all')
              setFrom('')
              setTo('')
              setPage(1)
            }}
          >
            <RotateCcw className="me-2 h-4 w-4" />
            إزالة عوامل التصفية
          </Button>
        }
      />

      {data && (data.items?.length ?? 0) > 0 && (
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
      )}

      {/* ---------- detail dialog ---------- */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="qx-scroll max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <ReceiptText className="h-5 w-5 text-primary" />
              <span className="qx-num font-mono" dir="ltr">
                {detailSale?.invoiceNo ?? '...'}
              </span>
              {detailSale && (
                <StatusBadge status={detailSale.status} label={saleStatusLabel(detailSale.status, lang)} />
              )}
            </DialogTitle>
            {detailSale && (
              <DialogDescription>
                {fmtDateTime(detailSale.createdAt)} · {t('sales.cashier')}: {detailSale.cashierName} ·{' '}
                {t('sales.customer')}: {detailSale.customerName ?? t('pos.walkIn')}
              </DialogDescription>
            )}
          </DialogHeader>

          {detailLoading || !detailSale ? (
            <div className="space-y-3">
              <Skeleton className="h-8" />
              <Skeleton className="h-40" />
              <Skeleton className="h-20" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* items with batch traceability */}
              <div className="qx-scroll overflow-hidden rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/70">
                    <tr className="text-start text-xs text-muted-foreground">
                      <th className="px-3 py-2 text-start font-medium">الصنف</th>
                      <th className="px-3 py-2 text-start font-medium">التشغيلة</th>
                      <th className="px-3 py-2 text-start font-medium">الكمية</th>
                      <th className="px-3 py-2 text-start font-medium">مرتجع</th>
                      <th className="px-3 py-2 text-end font-medium">السعر</th>
                      <th className="px-3 py-2 text-end font-medium">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detailSale.items ?? []).map((i) => (
                      <tr key={i.id} className="border-t">
                        <td className="max-w-44 truncate px-3 py-2 font-medium">{i.productName}</td>
                        <td className="px-3 py-2">
                          <span className="qx-num font-mono text-xs" dir="ltr">
                            {i.batchNo ?? '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="qx-num tabular-nums" dir="ltr">
                            {formatQty(i.quantity, !Number.isInteger(i.quantity))}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {i.returnedQty > 0 ? (
                            <span className="qx-num tabular-nums text-[var(--warning)]" dir="ltr">
                              {formatQty(i.returnedQty, !Number.isInteger(i.returnedQty))}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-end">
                          <span className="qx-num tabular-nums" dir="ltr">
                            {money(i.unitPrice)}
                          </span>
                          {i.discount > 0 && (
                            <span className="block text-[10px] text-muted-foreground">
                              خصم <span className="qx-num" dir="ltr">{money(i.discount)}</span>
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-end font-bold">
                          <span className="qx-num tabular-nums" dir="ltr">
                            {money(i.total)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* totals */}
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1 rounded-xl border p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('pos.subtotal')}</span>
                    <span className="qx-num tabular-nums" dir="ltr">{money(detailSale.subtotal)}</span>
                  </div>
                  {detailSale.discount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('pos.discount')}</span>
                      <span className="qx-num tabular-nums" dir="ltr">−{money(detailSale.discount)}</span>
                    </div>
                  )}
                  {detailSale.tax > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('pos.tax')}</span>
                      <span className="qx-num tabular-nums" dir="ltr">{money(detailSale.tax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1 font-extrabold">
                    <span>{t('app.total')}</span>
                    <span className="qx-num tabular-nums" dir="ltr">{money(detailSale.total)}</span>
                  </div>
                </div>
                <div className="space-y-1 rounded-xl border p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('pos.paymentMethod')}</span>
                    <span>{paymentLabel(detailSale.paymentMethod, lang)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('pos.paid')}</span>
                    <span className="qx-num tabular-nums" dir="ltr">{money(detailSale.paidAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('pos.change')}</span>
                    <span className="qx-num tabular-nums" dir="ltr">{money(detailSale.changeAmount)}</span>
                  </div>
                  {detailSale.notes && (
                    <p className="pt-1 text-xs text-muted-foreground">ملاحظات: {detailSale.notes}</p>
                  )}
                </div>
              </div>

              {/* actions */}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setReceiptOpen(true)}>
                  <Printer className="me-2 h-4 w-4" />
                  {t('pos.printReceipt')}
                </Button>
                {detailSale.status !== 'CANCELLED' && has('SALES_RETURN') && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      setView('returns', { saleId: detailSale.id, invoiceNo: detailSale.invoiceNo })
                    }
                  >
                    <Undo2 className="me-2 h-4 w-4" />
                    {t('sales.newReturn')}
                  </Button>
                )}
                {detailSale.status !== 'CANCELLED' && has('SALES_CANCEL') && (
                  <Button variant="destructive" onClick={() => setCancelOpen(true)}>
                    <Ban className="me-2 h-4 w-4" />
                    {t('sales.cancel')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ---------- cancel dialog ---------- */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('sales.cancel')}</DialogTitle>
            <DialogDescription>{t('sales.cancelConfirm')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="qx-cancel-reason">سبب الإلغاء (اختياري)</Label>
            <Textarea
              id="qx-cancel-reason"
              placeholder="مثال: خطأ في إدخال الأصناف"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
            />
            {detailSale && (
              <p className="text-xs text-muted-foreground">
                سيتم إرجاع <span className="qx-num tabular-nums" dir="ltr">{detailSale.items?.length ?? 0}</span> تشغيلة إلى
                المخزون وإلغاء الفاتورة نهائياً.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={cancelBusy}>
              رجوع
            </Button>
            <Button variant="destructive" onClick={() => void doCancel()} disabled={cancelBusy}>
              {cancelBusy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              تأكيد الإلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- receipt dialog ---------- */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t('pos.printReceipt')}</DialogTitle>
          </DialogHeader>
          {detail && (
            <ReceiptView
              receipt={detail.receipt}
              business={status?.business ?? EMPTY_BUSINESS}
              branding={status?.branding ?? EMPTY_BRANDING}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
