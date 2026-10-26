'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Reports screen: 11 report types, date range, totals cards,
// recharts series, DataTable rows, CSV export (REPORT_EXPORT gated).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLibraryStore } from '../store'
import { api, errMessage } from '../api'
import { PageHeader, StatCard, SectionCard, DataTable, Pagination, Column, EmptyState } from '../parts/kit'
import { paymentLabel, purchaseStatusLabel, paymentStatusBadge, movementTypeLabel } from '../parts/labels'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import {
  BarChart3,
  TrendingUp,
  UserRound,
  CreditCard,
  Package,
  Truck,
  Factory,
  Boxes,
  PackageX,
  CalendarClock,
  Undo2,
  ArrowLeftRight,
  Download,
  Play,
  Loader2,
  Search,
  Pin,
  Printer,
} from 'lucide-react'

type Row = Record<string, unknown>

interface ReportPayload {
  type: string
  from: string
  to: string
  snapshot: boolean
  rows: Row[]
  totals: Record<string, number> | null
  chart: Row[] | null
  paging: { page: number; pageSize: number; total: number } | null
}

interface ReportDef {
  id: string
  ar: string
  en: string
  icon: typeof TrendingUp
  snapshot?: boolean
  searchable?: boolean
  paged?: boolean
  chart?: 'daily' | 'bar'
}

const REPORT_DEFS: ReportDef[] = [
  { id: 'sales', ar: 'تقرير المبيعات اليومية', en: 'Daily Sales Report', icon: TrendingUp, chart: 'daily' },
  { id: 'sales-by-cashier', ar: 'المبيعات حسب الكاشير', en: 'Sales by Cashier', icon: UserRound, chart: 'bar' },
  { id: 'sales-by-payment', ar: 'المبيعات حسب طريقة الدفع', en: 'Sales by Payment Method', icon: CreditCard, chart: 'bar' },
  { id: 'product-sales', ar: 'مبيعات الأصناف', en: 'Product Sales', icon: Package, searchable: true },
  { id: 'purchases', ar: 'تقرير المشتريات', en: 'Purchase Report', icon: Truck },
  { id: 'suppliers', ar: 'تقرير الموردين', en: 'Supplier Report', icon: Factory },
  { id: 'inventory', ar: 'تقرير المخزون', en: 'Inventory Report', icon: Boxes, snapshot: true },
  { id: 'low-stock', ar: 'الأصناف المنخفضة', en: 'Low Stock', icon: PackageX, snapshot: true },
  { id: 'returns', ar: 'تقرير المرتجعات', en: 'Returns Report', icon: Undo2 },
  { id: 'movements', ar: 'حركات المخزون', en: 'Stock Movements', icon: ArrowLeftRight, paged: true },
]

interface TotalsCard {
  key: string
  ar: string
  en: string
  money?: boolean
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'primary'
}

const TOTALS_CONFIG: Record<string, TotalsCard[]> = {
  sales: [
    { key: 'revenue', ar: 'إجمالي الإيراد', en: 'Total revenue', money: true, tone: 'primary' },
    { key: 'profit', ar: 'صافي الربح', en: 'Net profit', money: true, tone: 'success' },
    { key: 'cost', ar: 'إجمالي التكلفة', en: 'Total cost', money: true },
    { key: 'invoices', ar: 'عدد الفواتير', en: 'Invoices' },
    { key: 'avgInvoice', ar: 'متوسط الفاتورة', en: 'Avg invoice', money: true },
  ],
  purchases: [
    { key: 'count', ar: 'فواتير الشراء', en: 'Purchase invoices' },
    { key: 'total', ar: 'إجمالي المشتريات', en: 'Total purchases', money: true, tone: 'primary' },
    { key: 'paid', ar: 'المدفوع', en: 'Paid', money: true, tone: 'success' },
    { key: 'unpaid', ar: 'غير المدفوع', en: 'Unpaid', money: true, tone: 'danger' },
  ],
  inventory: [
    { key: 'totalValue', ar: 'قيمة المخزون', en: 'Stock value', money: true, tone: 'primary' },
    { key: 'productCount', ar: 'عدد الأصناف', en: 'Products' },
  ],
  returns: [
    { key: 'count', ar: 'عدد المرتجعات', en: 'Returns count' },
    { key: 'totalRefunded', ar: 'إجمالي المسترد', en: 'Total refunded', money: true, tone: 'warning' },
  ],
}

function toDateInput(d: Date): string {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return x.toISOString().slice(0, 10)
}

export function ReportsScreen() {
  const t = useLibraryStore((s) => s.t)
  const money = useLibraryStore((s) => s.money)
  const fmtDate = useLibraryStore((s) => s.fmtDate)
  const fmtDateTime = useLibraryStore((s) => s.fmtDateTime)
  const lang = useLibraryStore((s) => s.lang)
  const status = useLibraryStore((s) => s.status)
  const session = useLibraryStore((s) => s.session)
  const has = useLibraryStore((s) => s.has)
  const { toast } = useToast()

  const L = useCallback((ar: string, en: string) => (lang === 'ar' ? ar : en), [lang])

  const [type, setType] = useState('sales')
  const [from, setFrom] = useState(() => toDateInput(new Date(Date.now() - 29 * 86400000)))
  const [to, setTo] = useState(() => toDateInput(new Date()))
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ReportPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const def = useMemo(() => REPORT_DEFS.find((r) => r.id === type) ?? REPORT_DEFS[0], [type])
  const canExport = has('REPORT_EXPORT')

  const run = useCallback(
    async (targetPage = 1) => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ type, from, to })
        if (def.searchable && q.trim()) params.set('q', q.trim())
            if (def.paged) {
          params.set('page', String(targetPage))
          params.set('pageSize', '100')
        }
        const res = await api<ReportPayload>(`/reports?${params.toString()}`, { signal: ctrl.signal })
        if (ctrl.signal.aborted) return // superseded by a newer request
        setData(res)
      } catch (e) {
        if (ctrl.signal.aborted) return // superseded — ignore stale request errors
        setError(errMessage(e))
        setData(null)
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    },
    [type, from, to, q, def]
  )

  // re-run when switching report type only (page resets); the run button re-runs with current filters
  useEffect(() => {
    setPage(1)
    void run(1)
    return () => abortRef.current?.abort()
  }, [type])

  async function exportCsv() {
    setExporting(true)
    try {
      const params = new URLSearchParams({ type, from, to, format: 'csv' })
      if (def.searchable && q.trim()) params.set('q', q.trim())
        const res = await fetch(`/api/library/reports?${params.toString()}`, {
        credentials: 'same-origin',
        cache: 'no-store',
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
        throw new Error(j?.error?.message ?? L('فشل تصدير التقرير', 'Export failed'))
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `library-report-${type}-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast({ title: L('تم تصدير التقرير', 'Report exported'), description: L('تم تنزيل ملف CSV بترميز UTF-8', 'CSV file downloaded (UTF-8)') })
    } catch (e) {
      toast({ variant: 'destructive', title: L('فشل التصدير', 'Export failed'), description: errMessage(e) })
    } finally {
      setExporting(false)
    }
  }

  const columns = useMemo<Column<Row>[]>(() => {
    const num = (v: unknown) => <span className="tabular-nums">{Number(v ?? 0).toLocaleString('en-US')}</span>
    const cash = (v: unknown) => <span className="tabular-nums">{money(Number(v ?? 0))}</span>
    const mono = (v: unknown) => (
      <span dir="ltr" className="font-mono text-xs">
        {String(v ?? '')}
      </span>
    )
    switch (type) {
      case 'sales':
        return [
          { key: 'date', header: t('app.date'), render: (r) => fmtDate(r.date as string) },
          { key: 'count', header: t('reports.count'), render: (r) => num(r.count), className: 'tabular-nums' },
          { key: 'revenue', header: t('reports.revenue'), render: (r) => cash(r.revenue) },
          { key: 'cost', header: t('reports.cost'), render: (r) => cash(r.cost) },
          { key: 'profit', header: t('reports.profit'), render: (r) => <span className="tabular-nums font-semibold text-[var(--success)]">{money(Number(r.profit ?? 0))}</span> },
        ]
      case 'sales-by-cashier':
        return [
          { key: 'cashierName', header: t('sales.cashier') },
          { key: 'invoices', header: t('reports.count'), render: (r) => num(r.invoices) },
          { key: 'revenue', header: t('reports.revenue'), render: (r) => cash(r.revenue) },
          { key: 'avg', header: L('متوسط الفاتورة', 'Avg invoice'), render: (r) => cash(r.avg) },
        ]
      case 'sales-by-payment':
        return [
          { key: 'paymentMethod', header: t('pos.paymentMethod'), render: (r) => paymentLabel(String(r.paymentMethod), lang) },
          { key: 'invoices', header: t('reports.count'), render: (r) => num(r.invoices) },
          { key: 'revenue', header: t('reports.revenue'), render: (r) => cash(r.revenue) },
        ]
      case 'product-sales':
        return [
          { key: 'productName', header: t('products.name') },
          { key: 'sku', header: 'SKU', render: (r) => mono(r.sku) },
          { key: 'qty', header: t('reports.qty'), render: (r) => num(r.qty) },
          { key: 'revenue', header: t('reports.revenue'), render: (r) => cash(r.revenue) },
          { key: 'profit', header: t('reports.profit'), render: (r) => <span className="tabular-nums font-semibold text-[var(--success)]">{money(Number(r.profit ?? 0))}</span> },
        ]
      case 'purchases':
        return [
          { key: 'invoiceNo', header: t('purchases.invoiceNo'), render: (r) => mono(r.invoiceNo) },
          { key: 'supplierName', header: t('suppliers.name') },
          { key: 'total', header: t('app.total'), render: (r) => cash(r.total) },
          { key: 'paidAmount', header: L('المدفوع', 'Paid'), render: (r) => cash(r.paidAmount) },
          { key: 'paymentStatus', header: L('حالة الدفع', 'Payment'), render: (r) => <Badge variant="outline" className="text-[11px]">{paymentStatusBadge(String(r.paymentStatus), lang)}</Badge> },
          { key: 'status', header: t('app.status'), render: (r) => <Badge variant="outline" className="text-[11px]">{purchaseStatusLabel(String(r.status), lang)}</Badge> },
          { key: 'createdAt', header: t('app.date'), render: (r) => fmtDate(r.createdAt as string) },
        ]
      case 'suppliers':
        return [
          { key: 'supplierName', header: t('suppliers.name') },
          { key: 'invoices', header: t('reports.count'), render: (r) => num(r.invoices) },
          { key: 'totalPurchased', header: L('إجمالي المشتريات', 'Total purchased'), render: (r) => cash(r.totalPurchased) },
          { key: 'lastPurchase', header: L('آخر شراء', 'Last purchase'), render: (r) => fmtDate(r.lastPurchase as string) },
        ]
      case 'inventory':
        return [
          { key: 'productName', header: t('products.name') },
          { key: 'sku', header: 'SKU', render: (r) => mono(r.sku) },
          { key: 'categoryName', header: t('categories.title') },
          { key: 'stockTotal', header: L('إجمالي المخزون', 'Total stock'), render: (r) => num(r.stockTotal) },
          { key: 'stockAvailable', header: L('المتاح للبيع', 'Available'), render: (r) => num(r.stockAvailable) },
              { key: 'value', header: t('inv.value'), render: (r) => cash(r.value) },
          { key: 'reorderLevel', header: L('حد إعادة الطلب', 'Reorder level'), render: (r) => num(r.reorderLevel) },
        ]
      case 'low-stock':
        return [
          { key: 'productName', header: t('products.name') },
          { key: 'sku', header: 'SKU', render: (r) => mono(r.sku) },
          { key: 'available', header: L('المتاح', 'Available'), render: (r) => num(r.available) },
          { key: 'reorderLevel', header: L('حد إعادة الطلب', 'Reorder level'), render: (r) => num(r.reorderLevel) },
          { key: 'deficit', header: L('العجز', 'Deficit'), render: (r) => <span className="font-semibold text-[var(--danger)] tabular-nums">{Number(r.deficit ?? 0).toLocaleString('en-US')}</span> },
        ]
      case 'returns':
        return [
          { key: 'returnNo', header: t('returns.returnNo'), render: (r) => mono(r.returnNo) },
          { key: 'saleInvoiceNo', header: t('sales.invoiceNo'), render: (r) => mono(r.saleInvoiceNo) },
          { key: 'total', header: t('app.total'), render: (r) => cash(r.total) },
          { key: 'reason', header: L('السبب', 'Reason'), render: (r) => <span className="text-xs text-muted-foreground">{String(r.reason ?? '—')}</span> },
          { key: 'username', header: L('المستخدم', 'User') },
          { key: 'createdAt', header: t('app.date'), render: (r) => fmtDateTime(r.createdAt as string) },
        ]
      case 'movements':
        return [
          { key: 'date', header: t('app.date'), render: (r) => <span className="text-xs">{fmtDateTime(r.date as string)}</span> },
          { key: 'productName', header: t('products.name') },
          { key: 'batchNo', header: t('inv.batchNo'), render: (r) => (r.batchNo ? mono(r.batchNo) : <span className="text-muted-foreground">—</span>) },
          { key: 'type', header: t('inv.type'), render: (r) => movementTypeLabel(String(r.type), lang) },
          { key: 'quantity', header: t('reports.qty'), render: (r) => {
            const n = Number(r.quantity ?? 0)
            return (
              <span dir="ltr" className={`tabular-nums font-semibold ${n < 0 ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
                {n > 0 ? `+${n}` : n}
              </span>
            )
          } },
          { key: 'note', header: L('ملاحظة', 'Note'), render: (r) => <span className="text-xs text-muted-foreground">{String(r.note ?? '') || '—'}</span> },
        ]
      default:
        return []
    }
  }, [type, money, fmtDate, fmtDateTime, lang, t, L])

  const totalsCards = useMemo(() => {
    if (!data?.totals) return []
    const cfg = TOTALS_CONFIG[type] ?? []
    return cfg.filter((c) => data.totals?.[c.key] !== undefined)
  }, [data, type])

  const chartData = useMemo(() => {
    if (!data?.chart) return []
    if (type === 'sales') {
      return data.chart.map((r) => ({
        name: (() => {
          try {
            const d = toSafeDate(r.date ? `${r.date}T00:00:00` : null);
            return d ? new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' }).format(d) : String(r.date ?? '—');
          } catch {
            return String(r.date ?? '—');
          }
        })(),
        revenue: Number(r.revenue ?? 0),
        cost: Number(r.cost ?? 0),
        profit: Number(r.profit ?? 0),
      }))
    }
    if (type === 'sales-by-cashier') {
      return data.chart.map((r) => ({ name: String(r.cashierName ?? '').slice(0, 16), revenue: Number(r.revenue ?? 0) }))
    }
    if (type === 'sales-by-payment') {
      return data.chart.map((r) => ({ name: paymentLabel(String(r.paymentMethod), lang), revenue: Number(r.revenue ?? 0) }))
    }
    return []
  }, [data, type, lang])

  const tooltipStyle = {
    background: 'var(--popover)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    color: 'var(--popover-foreground)',
    fontSize: 12,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('reports.title')}
        description={L('تقارير تشغيلية ومالية مبنية على بيانات حقيقية', 'Operational & financial reports over live data')}
        icon={<BarChart3 className="h-5 w-5" />}
        actions={
          canExport && (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => window.print()} disabled={loading || !data || (data.rows?.length ?? 0) === 0}>
                <Printer className="me-2 h-4 w-4" />
                {L('طباعة', 'Print')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => void exportCsv()} disabled={exporting || loading}>
                {exporting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Download className="me-2 h-4 w-4" />}
                {t('reports.exportCsv')}
              </Button>
            </div>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* report type picker */}
        <div className="space-y-3">
          <div className="lg:hidden">
            <Label className="mb-1.5 block text-xs text-muted-foreground">{L('نوع التقرير', 'Report type')}</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-full min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_DEFS.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {L(r.ar, r.en)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <nav aria-label={L('أنواع التقارير', 'Report types')} className="hidden gap-1.5 lg:flex lg:flex-col">
            {REPORT_DEFS.map((r) => {
              const Icon = r.icon
              const active = r.id === type
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setType(r.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start text-sm font-medium transition ${
                    active
                      ? 'border-primary/50 bg-primary/12 text-primary'
                      : 'border-border bg-card text-foreground hover:border-primary/30 hover:bg-muted/50'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{L(r.ar, r.en)}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* filters + results */}
        <div className="min-w-0 space-y-4">
          <SectionCard>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              {def.snapshot ? (
                <div className="flex flex-1 items-center gap-2 rounded-lg border border-dashed border-[var(--warning)]/40 bg-[var(--warning)]/5 px-3 py-2.5 text-xs text-muted-foreground">
                  <Pin className="h-4 w-4 shrink-0 text-[var(--warning)]" />
                  {L('تقرير لحظي — يعكس حالة المخزون الحالية ولا يتأثر بالفترة الزمنية', 'Snapshot report — reflects current stock; unaffected by date range')}
                </div>
              ) : (
                <>
                  <div className="flex-1">
                    <Label htmlFor="qx-report-from" className="mb-1.5 block text-xs text-muted-foreground">
                      {L('من تاريخ', 'From')}
                    </Label>
                    <Input id="qx-report-from" type="date" dir="ltr" value={from} onChange={(e) => setFrom(e.target.value)} className="min-h-11" />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="qx-report-to" className="mb-1.5 block text-xs text-muted-foreground">
                      {L('إلى تاريخ', 'To')}
                    </Label>
                    <Input id="qx-report-to" type="date" dir="ltr" value={to} onChange={(e) => setTo(e.target.value)} className="min-h-11" />
                  </div>
                </>
              )}
              {def.searchable && (
                <div className="flex-1 sm:max-w-[220px]">
                  <Label htmlFor="qx-report-q" className="mb-1.5 block text-xs text-muted-foreground">
                    {t('app.search')}
                  </Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="qx-report-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('اسم الصنف أو SKU', 'Product name or SKU')} className="min-h-11 ps-8" />
                  </div>
                </div>
              )}
              <Button className="min-h-11" onClick={() => { setPage(1); void run(1) }} disabled={loading}>
                {loading ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Play className="me-2 h-4 w-4" />}
                {t('reports.run')}
              </Button>
            </div>
          </SectionCard>

          {loading ? (
            <>
              {totalsCards.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {totalsCards.map((c) => (
                    <StatCard key={c.key} label={L(c.ar, c.en)} value="—" />
                  ))}
                </div>
              )}
              {def.chart && <div className="h-72 animate-pulse rounded-xl border bg-muted/30" />}
              <div className="h-72 animate-pulse rounded-xl border bg-muted/30" />
            </>
          ) : error ? (
            <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/5 p-8 text-center">
              <p className="text-sm font-medium">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => void run(page)}>
                {t('app.retry')}
              </Button>
            </div>
          ) : !data || (data.rows?.length ?? 0) === 0 ? (
            <EmptyState title={t('reports.noData')} hint={L('جرّب توسيع الفترة الزمنية أو تغيير الفلاتر ثم اضغط «عرض التقرير»', 'Try widening the date range or changing filters, then run the report')} icon={<BarChart3 className="h-6 w-6" />} />
          ) : (
            <>
              {totalsCards.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {totalsCards.map((c) => (
                    <StatCard
                      key={c.key}
                      label={L(c.ar, c.en)}
                      value={c.money ? money(Number(data.totals?.[c.key] ?? 0)) : Number(data.totals?.[c.key] ?? 0).toLocaleString('en-US')}
                      tone={c.tone}
                    />
                  ))}
                </div>
              )}

              {def.chart === 'daily' && chartData.length > 0 && (
                <SectionCard title={t('reports.daily')} description={L('الإيراد والتكلفة والربح اليومي خلال الفترة', 'Daily revenue, cost and profit over the period')}>
                  <div className="h-72" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="qx-rpt-revenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="qx-rpt-profit" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--success)" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="var(--success)" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={52} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [money(value), name === 'revenue' ? t('reports.revenue') : name === 'cost' ? t('reports.cost') : t('reports.profit')]} />
                        <Legend formatter={(v: string) => (v === 'revenue' ? t('reports.revenue') : v === 'cost' ? t('reports.cost') : t('reports.profit'))} />
                        <Area type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={2} fill="url(#qx-rpt-revenue)" />
                        <Area type="monotone" dataKey="cost" stroke="var(--muted-foreground)" strokeWidth={1.5} fill="transparent" strokeDasharray="4 3" />
                        <Area type="monotone" dataKey="profit" stroke="var(--success)" strokeWidth={2} fill="url(#qx-rpt-profit)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </SectionCard>
              )}

              {def.chart === 'bar' && chartData.length > 0 && (
                <SectionCard title={L(def.ar, def.en)} description={L('الإيراد الإجمالي خلال الفترة المحددة', 'Total revenue over the selected period')}>
                  <div className="h-72" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                        <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={110} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [money(value), t('reports.revenue')]} />
                        <Bar dataKey="revenue" fill="var(--primary)" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </SectionCard>
              )}

              <SectionCard
                title={L(def.ar, def.en)}
                description={
                  def.snapshot
                    ? L(`عدد الصفوف: ${data.rows?.length ?? 0}`, `${data.rows?.length ?? 0} rows`)
                    : L(`من ${fmtDate(data.from)} إلى ${fmtDate(data.to)}`, `From ${fmtDate(data.from)} to ${fmtDate(data.to)}`)
                }
              >
                <DataTable columns={columns} rows={data.rows ?? []} emptyTitle={t('reports.noData')} />
                {def.paged && data.paging && (
                  <div className="mt-3">
                    <Pagination page={data.paging.page} pageSize={data.paging.pageSize} total={data.paging.total} onPage={(p) => { setPage(p); void run(p) }} />
                  </div>
                )}
              </SectionCard>
            </>
          )}
        </div>
      </div>

      {/* ---------- hidden print layout (visible only via @media print) ---------- */}
      {data && (data.rows?.length ?? 0) > 0 && (
        <div id="qx-report-print" className="hidden print:block" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          {/* header */}
          <div className="border-b-2 border-black pb-3 text-center">
            <h1 className="text-lg font-black">{status?.business?.businessName || status?.business?.displayName || 'Library Store'}</h1>
            {status?.business?.address && <p className="text-[10px]">{status.business.address}</p>}
            {(status?.business?.phone || status?.business?.phone2) && (
              <p className="text-[10px]" dir="ltr">
                {[status.business.phone, status.business.phone2].filter(Boolean).join(' · ')}
              </p>
            )}
            <h2 className="mt-2 text-sm font-bold">{L(def.ar, def.en)}</h2>
            <p className="text-[10px]">
              {def.snapshot
                ? L('لقطة لحظية', 'Point-in-time snapshot')
                : L(`من ${fmtDate(data.from)} إلى ${fmtDate(data.to)}`, `From ${fmtDate(data.from)} to ${fmtDate(data.to)}`)}
              {' · '}
              {L('طُبع في', 'Printed at')} {fmtDateTime(new Date().toISOString())}
              {session ? ` · ${session.displayName}` : ''}
            </p>
          </div>

          {/* totals strip */}
          {data.totals && (
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-b border-dashed border-gray-400 pb-2 text-[11px]">
              {(TOTALS_CONFIG[type] ?? [])
                .filter((c) => data.totals?.[c.key] !== undefined)
                .map((c) => (
                  <span key={c.key}>
                    <span className="text-muted-foreground">{L(c.ar, c.en)}: </span>
                    <span className="font-bold tabular-nums">{c.money ? money(Number(data.totals?.[c.key])) : Number(data.totals?.[c.key]).toLocaleString('en-US')}</span>
                  </span>
                ))}
            </div>
          )}

          {/* table */}
          <table className="mt-3 w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b-2 border-black">
                {columns.map((c) => (
                  <th key={c.key} className="px-1.5 py-1.5 text-start font-bold whitespace-nowrap">
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.rows ?? []).map((row, i) => (
                <tr key={i} className="border-b border-gray-300">
                  {columns.map((c) => (
                    <td key={c.key} className="px-1.5 py-1.5 align-top">
                      {c.render ? c.render(row) : String(row[c.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* footer */}
          <p className="mt-4 border-t border-dashed border-gray-400 pt-2 text-center text-[9px] text-gray-500">
            {L(`عدد الصفوف: ${data.rows?.length ?? 0}`, `${data.rows?.length ?? 0} rows`)} · Library Store v{status?.version ?? '1.0.0'} ·{' '}
            {new Date().getFullYear()} © {status?.business?.businessName || 'Library Store'}
          </p>
        </div>
      )}
    </div>
  )
}
