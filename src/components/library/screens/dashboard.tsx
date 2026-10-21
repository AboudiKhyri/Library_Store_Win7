'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Dashboard (real DB metrics only)
import { useEffect, useState } from 'react'
import { useLibraryStore } from '../store'
import { api, errMessage } from '../api'
import { PageHeader, StatCard, SectionCard, EmptyState, ErrorBlock, LoadingBlock, StatusBadge } from '../parts/kit'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toSafeDate } from '@/lib/library/money'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts'
import {
  LayoutDashboard,
  Banknote,
  ReceiptText,
  TrendingUp,
  PackageX,
  Timer,
  CalendarX,
  Boxes,
  ShoppingCart,
  Plus,
  Truck,
  ArrowLeft,
} from 'lucide-react'
import type { DashboardData } from '@/lib/library/services/dashboard'
import { paymentLabel, saleStatusLabel } from '../parts/labels'

export { paymentLabel, saleStatusLabel }

/** Tiny inline SVG sparkline (RTL-aware weekly trend for KPI cards). */
function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const n = values.length
  if (n < 2) return null
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  const w = 100
  const h = 24
  const points = values.map((v, i) => {
    const x = (i / (n - 1)) * w
    const y = h - ((v - min) / span) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const path = `M ${points.join(' L ')}`
  const area = `${path} L ${w},${h} L 0,${h} Z`
  const lastIdx = values.length - 1
  const lastNonZero = values.some((v) => v > 0)
  if (!lastNonZero) return null
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
      style={{ direction: 'ltr' }}
    >
      <defs>
        <linearGradient id="qx-spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.01} />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#qx-spark)" strokeWidth={0} />
      <path d={path} fill="none" stroke="var(--primary)" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle
        cx={(lastIdx / (n - 1)) * w}
        cy={h - ((values[lastIdx] - min) / span) * h}
        r={2}
        fill="var(--primary)"
      />
    </svg>
  )
}

export function DashboardScreen() {
  const t = useLibraryStore((s) => s.t)
  const money = useLibraryStore((s) => s.money)
  const fmtDateTime = useLibraryStore((s) => s.fmtDateTime)
  const lang = useLibraryStore((s) => s.lang)
  const setView = useLibraryStore((s) => s.setView)
  const status = useLibraryStore((s) => s.status)

  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setData(await api<DashboardData>('/dashboard'))
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const canPos = !!status?.modules.pos
  const canProducts = !!status?.modules.supermarket
  const canPurchases = !!status?.modules.purchasing

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('nav.dashboard')} icon={<LayoutDashboard className="h-5 w-5" />} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72" />
        <LoadingBlock rows={3} />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('nav.dashboard')} icon={<LayoutDashboard className="h-5 w-5" />} />
        <ErrorBlock message={error ?? 'تعذر تحميل البيانات'} onRetry={load} />
      </div>
    )
  }

  const weeklySales = data.weeklySales ?? []
  const topProducts = data.topProducts ?? []
  const recentSales = data.recentSales ?? []

  const weekLabels = weeklySales.map((d) => {
    const date = toSafeDate(d.date)
    if (!date) return d.date || '-'
    try {
      return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'short', day: 'numeric' }).format(date)
    } catch {
      return d.date || '-'
    }
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('nav.dashboard')}
        description={`${t('dash.thisMonth')}: ${money(data.monthSales)} · ${t('nav.purchases')}: ${money(data.monthPurchases)}`}
        icon={<LayoutDashboard className="h-5 w-5" />}
        actions={
          <div className="flex flex-wrap gap-2">
            {canPos && (
              <Button size="sm" onClick={() => setView('pos')}>
                <ShoppingCart className="me-2 h-4 w-4" />
                {t('dash.newSale')}
              </Button>
            )}
            {canProducts && (
              <Button size="sm" variant="outline" onClick={() => setView('products')}>
                <Plus className="me-2 h-4 w-4" />
                {t('dash.addProduct')}
              </Button>
            )}
            {canPurchases && (
              <Button size="sm" variant="outline" onClick={() => setView('purchases')}>
                <Truck className="me-2 h-4 w-4" />
                {t('dash.newPurchase')}
              </Button>
            )}
          </div>
        }
      />

      {/* KPI grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative">
          <StatCard label={t('dash.todaySales')} value={money(data.todaySales)} icon={<Banknote className="h-5 w-5" />} tone="primary" hint={`${t('dash.thisMonth')}: ${money(data.monthSales)}`} />
          <Sparkline values={weeklySales.map((d) => d.total)} className="pointer-events-none absolute bottom-3 start-4 end-4 h-8 opacity-45" />
        </div>
        <StatCard label={t('dash.todayTransactions')} value={data.todayCount} icon={<ReceiptText className="h-5 w-5" />} hint={data.todayCount > 0 ? `${t('dash.avgTransaction')}: ${money(data.avgTransaction)}` : undefined} onClick={() => setView('sales-history')} />
        <StatCard label={t('dash.stockValue')} value={money(data.stockValue)} icon={<Boxes className="h-5 w-5" />} hint={`${data.activeProducts} صنف نشط`} onClick={() => setView('inventory')} />
        <StatCard label={t('dash.lowStock')} value={data.lowStockCount} icon={<PackageX className="h-5 w-5" />} tone={data.lowStockCount > 0 ? 'warning' : 'success'} onClick={() => setView('inventory')} />
      </div>

      {/* activity strip */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label={t('dash.purchaseActivity')} value={data.monthPurchaseCount} icon={<Truck className="h-5 w-5" />} hint={money(data.monthPurchases)} onClick={() => setView('purchases')} />
        <StatCard label={t('dash.avgTransaction')} value={money(data.avgTransaction)} icon={<TrendingUp className="h-5 w-5" />} />
      </div>

      {/* weekly chart + top products */}
      <div className="grid gap-4 lg:grid-cols-5">
        <SectionCard
          title={t('dash.weeklySales')}
          className="lg:col-span-3"
          description={lang === 'ar' ? 'اضغط على أي يوم لعرض فواتيره' : 'Click any day to view its invoices'}
        >
          <div className="h-64 cursor-pointer" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={weeklySales.map((d, i) => ({ name: weekLabels[i] ?? d.date, total: d.total, count: d.count, date: d.date }))}
                onClick={(state) => {
                  // drill-down: day click → sales history filtered to that day
                  const idx = state?.activeTooltipIndex
                  if (typeof idx !== 'number') return
                  const point = weeklySales[idx]
                  if (!point) return
                  setView('sales-history', { from: point.date, to: point.date, quickRange: 'custom' })
                }}
              >
                <defs>
                  <linearGradient id="qx-sales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={48} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--popover)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    color: 'var(--popover-foreground)',
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [money(value), t('dash.todaySales')]}
                />
                <Area type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={2} fill="url(#qx-sales)" activeDot={{ r: 5, strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title={t('dash.topProducts')}
          className="lg:col-span-2"
          description={lang === 'ar' ? 'أعلى الأصناف مبيعاً آخر ٣٠ يوماً' : 'Top sellers — last 30 days'}
        >
          {topProducts.length === 0 ? (
            <EmptyState title={t('dash.noSalesYet')} hint="ستظهر الأصناف الأكثر مبيعاً هنا بعد أول عمليات بيع." icon={<ShoppingCart className="h-6 w-6" />} />
          ) : (
            <div className="h-64" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts.map((p) => ({ name: (p.nameAr ?? '').slice(0, 14), qty: p.qty }))} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} width={110} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--popover)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      color: 'var(--popover-foreground)',
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [value, t('reports.qty')]}
                  />
                  <Bar dataKey="qty" fill="var(--primary)" radius={[0, 6, 6, 0]} className="cursor-pointer" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>
      </div>

      {/* recent sales */}
      <SectionCard
        title={t('dash.recentSales')}
        actions={
          <Button variant="ghost" size="sm" onClick={() => setView('sales-history')}>
            {t('nav.salesHistory')}
            <ArrowLeft className="ms-1 h-3.5 w-3.5 rtl:rotate-0" />
          </Button>
        }
      >
        {recentSales.length === 0 ? (
          <EmptyState
            title={t('dash.noSalesYet')}
            hint="ابدأ أول فاتورة من نقطة البيع — امسح باركود الصنف أو ابحث بالاسم."
            icon={<ReceiptText className="h-6 w-6" />}
            action={
              canPos ? (
                <Button size="sm" onClick={() => setView('pos')}>
                  <ShoppingCart className="me-2 h-4 w-4" />
                  {t('dash.newSale')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="qx-scroll max-h-80 overflow-y-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/95 backdrop-blur">
                <tr className="text-start text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-start font-medium">{t('sales.invoiceNo')}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('sales.cashier')}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('app.date')}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('sales.items')}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('pos.paymentMethod')}</th>
                  <th className="px-3 py-2 text-end font-medium">{t('app.total')}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('app.status')}</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map((s) => (
                  <tr key={s.id} className="border-t transition hover:bg-muted/40">
                    <td className="px-3 py-2 font-mono text-xs" dir="ltr">{s.invoiceNo}</td>
                    <td className="px-3 py-2">{s.cashierName}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDateTime(s.createdAt)}</td>
                    <td className="px-3 py-2 tabular-nums">{s.itemsCount}</td>
                    <td className="px-3 py-2 text-xs">{paymentLabel(s.paymentMethod, lang)}</td>
                    <td className="px-3 py-2 text-end font-bold tabular-nums">{money(s.total)}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={s.status} label={saleStatusLabel(s.status, lang)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
