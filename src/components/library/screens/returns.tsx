'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — returns screen (المرتجعات)
// New return flow (invoice lookup → per-batch qty → reason → submit) + history.
import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useLibraryStore } from '../store'
import { api, errMessage } from '../api'
import { useToast } from '@/hooks/use-toast'
import {
  PageHeader,
  SectionCard,
  DataTable,
  type Column,
  Pagination,
  StatusBadge,
  EmptyState,
  ErrorBlock,
} from '../parts/kit'
import { saleStatusLabel } from '../parts/labels'
import { formatQty } from '../parts/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { r2 } from '@/lib/library/money'
import type { Paged } from '@/lib/library/types'
import { Undo2, Search, Loader2, ReceiptText, RotateCcw, PackageCheck } from 'lucide-react'

interface ReturnableItem {
  saleItemId: string
  productName: string
  batchNo: string | null
  expiryDate: string | null
  quantity: number
  returnedQty: number
  returnableQty: number
  unitPrice: number
}

interface SaleForReturn {
  id: string
  invoiceNo: string
  createdAt: string
  status: string
  total: number
  cashierName: string
  customerName: string | null
  items: ReturnableItem[]
}

interface ReturnRow {
  id: string
  returnNo: string
  saleInvoiceNo: string
  total: number
  reason: string | null
  username: string
  userDisplayName: string | null
  createdAt: string
}

export function ReturnsScreen() {
  const t = useLibraryStore((s) => s.t)
  const money = useLibraryStore((s) => s.money)
  const fmtDateTime = useLibraryStore((s) => s.fmtDateTime)
  const fmtDate = useLibraryStore((s) => s.fmtDate)
  const lang = useLibraryStore((s) => s.lang)
  const has = useLibraryStore((s) => s.has)
  const viewParams = useLibraryStore((s) => s.viewParams)
  const setView = useLibraryStore((s) => s.setView)
  const { toast } = useToast()

  const canReturn = has('SALES_RETURN')
  const canViewHistory = has('SALES_VIEW')

  // ---- new return flow ----
  const [invoiceInput, setInvoiceInput] = useState('')
  const [sale, setSale] = useState<SaleForReturn | null>(null)
  const [saleLoading, setSaleLoading] = useState(false)
  const [saleError, setSaleError] = useState<string | null>(null)
  const [qtys, setQtys] = useState<Record<string, number>>({})
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // ---- history ----
  const [page, setPage] = useState(1)
  const [history, setHistory] = useState<Paged<ReturnRow> | null>(null)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const loadSale = useCallback(
    async (invoiceNo: string) => {
      const inv = invoiceNo.trim()
      if (!inv) {
        toast({ variant: 'destructive', title: 'أدخل رقم الفاتورة', description: 'مثال: INV-2026-000006' })
        return
      }
      setSaleLoading(true)
      setSaleError(null)
      setSale(null)
      setQtys({})
      try {
        const res = await api<{ sale: SaleForReturn }>(
          `/returns?saleInvoice=${encodeURIComponent(inv)}`
        )
        setSale(res.sale)
        const initial: Record<string, number> = {}
        for (const i of (res?.sale?.items ?? [])) initial[i.saleItemId] = 0
        setQtys(initial)
      } catch (e) {
        setSaleError(errMessage(e))
      } finally {
        setSaleLoading(false)
      }
    },
    [toast]
  )

  // pre-load when navigated from sales history
  useEffect(() => {
    const invoiceNo = typeof viewParams.invoiceNo === 'string' ? viewParams.invoiceNo : null
    const saleId = typeof viewParams.saleId === 'string' ? viewParams.saleId : null
    if (!invoiceNo && !saleId) return
    let cancelled = false
    setSaleLoading(true)
    setSaleError(null)
    const query = invoiceNo
      ? `/returns?saleInvoice=${encodeURIComponent(invoiceNo)}`
      : `/returns?saleId=${encodeURIComponent(saleId as string)}`
    api<{ sale: SaleForReturn }>(query)
      .then((res) => {
        if (cancelled) return
        setSale(res.sale)
        setInvoiceInput(res.sale.invoiceNo)
        const initial: Record<string, number> = {}
        for (const i of (res?.sale?.items ?? [])) initial[i.saleItemId] = 0
        setQtys(initial)
      })
      .catch((e) => {
        if (!cancelled) setSaleError(errMessage(e))
      })
      .finally(() => {
        if (!cancelled) setSaleLoading(false)
      })
    // consume the navigation params so revisiting the screen starts fresh
    setView('returns', {})
    return () => {
      cancelled = true
    }
  }, [])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const res = await api<Paged<ReturnRow>>(`/returns?page=${page}&pageSize=10`)
      setHistory(Array.isArray(res) ? { items: res, total: res.length, page: 1, pageSize: 10 } : { ...res, items: res?.items ?? [] })
    } catch (e) {
      setHistoryError(errMessage(e))
    } finally {
      setHistoryLoading(false)
    }
  }, [page])

  useEffect(() => {
    if (canViewHistory) void loadHistory()
  }, [loadHistory, canViewHistory])

  const selectedItems = sale
    ? (sale.items ?? [])
        .map((i) => ({ item: i, qty: qtys[i.saleItemId] ?? 0 }))
        .filter((x) => x.qty > 0)
    : []
  const refundTotal = r2(selectedItems.reduce((s, x) => s + x.qty * x.item.unitPrice, 0))

  function setQty(item: ReturnableItem, raw: number) {
    const v = Math.max(0, Math.min(item.returnableQty, Math.floor(Number.isFinite(raw) ? raw : 0)))
    setQtys((prev) => ({ ...prev, [item.saleItemId]: v }))
  }

  async function submitReturn() {
    if (!sale || submitting) return
    if (selectedItems.length === 0) {
      toast({ variant: 'destructive', title: 'لا توجد أصناف للإرجاع', description: 'حدد الكميات المطلوب إرجاعها' })
      return
    }
    setSubmitting(true)
    try {
      const res = await api<{ returnId: string; returnNo: string; total: number }>('/returns', {
        method: 'POST',
        body: {
          saleId: sale.id,
          items: selectedItems.map((x) => ({ saleItemId: x.item.saleItemId, quantity: x.qty })),
          reason: reason.trim() || undefined,
        },
      })
      toast({
        title: 'تم تسجيل المرتجع',
        description: `${res.returnNo} — قيمة المرتجع ${money(res.total)}`,
      })
      setSale(null)
      setQtys({})
      setReason('')
      setInvoiceInput('')
      if (canViewHistory) {
        setPage(1)
        void loadHistory()
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'تعذر تسجيل المرتجع', description: errMessage(e) })
    } finally {
      setSubmitting(false)
    }
  }

  const historyColumns: Column<ReturnRow>[] = [
    {
      key: 'returnNo',
      header: 'رقم المرتجع',
      render: (r) => (
        <span className="qx-num font-mono text-xs font-bold" dir="ltr">
          {r.returnNo}
        </span>
      ),
    },
    {
      key: 'saleInvoiceNo',
      header: t('sales.invoiceNo'),
      render: (r) => (
        <span className="qx-num font-mono text-xs" dir="ltr">
          {r.saleInvoiceNo}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'قيمة المرتجع',
      render: (r) => (
        <span className="qx-num block text-end font-extrabold tabular-nums text-[var(--warning)]" dir="ltr">
          {money(r.total)}
        </span>
      ),
      headerClassName: 'text-end',
      className: 'text-end',
    },
    {
      key: 'reason',
      header: 'السبب',
      render: (r) => (
        <span className="block max-w-48 truncate text-xs text-muted-foreground">{r.reason ?? '—'}</span>
      ),
    },
    {
      key: 'username',
      header: 'المستخدم',
      render: (r) => <span className="text-xs">{r.userDisplayName ?? r.username}</span>,
    },
    {
      key: 'createdAt',
      header: t('app.date'),
      render: (r) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">{fmtDateTime(r.createdAt)}</span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('nav.returns')}
        description="إرجاع أصناف إلى نفس التشغيلات الأصلية — تتبع كامل للمرتجعات"
        icon={<Undo2 className="h-5 w-5" />}
      />

      {canReturn ? (
        <SectionCard
          title="مرتجع جديد"
          description="أدخل رقم فاتورة البيع لتحميل أصنافها المتاحة للإرجاع"
          actions={
            sale && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSale(null)
                  setQtys({})
                  setSaleError(null)
                  setInvoiceInput('')
                  setReason('')
                }}
              >
                <RotateCcw className="me-1 h-3.5 w-3.5" />
                فاتورة أخرى
              </Button>
            )
          }
        >
          {/* invoice lookup */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute inset-y-0 start-2.5 my-auto h-4 w-4 text-muted-foreground" />
              <Input
                className="qx-num ps-8 font-mono"
                dir="ltr"
                placeholder="INV-2026-000006"
                value={invoiceInput}
                onChange={(e) => setInvoiceInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void loadSale(invoiceInput)
                }}
                aria-label={t('sales.invoiceNo')}
              />
            </div>
            <Button onClick={() => void loadSale(invoiceInput)} disabled={saleLoading}>
              {saleLoading ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <ReceiptText className="me-2 h-4 w-4" />}
              تحميل الفاتورة
            </Button>
          </div>

          {/* sale loading / error */}
          {saleLoading && (
            <div className="mt-4 space-y-2">
              <Skeleton className="h-20" />
              <Skeleton className="h-40" />
            </div>
          )}
          {!saleLoading && saleError && (
            <div className="mt-4">
              <ErrorBlock message={saleError} />
            </div>
          )}

          {/* loaded sale → return form */}
          {!saleLoading && !saleError && sale && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-4">
              {/* original sale info */}
              <div className="grid gap-2 rounded-xl border bg-muted/30 p-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-[11px] text-muted-foreground">{t('sales.invoiceNo')}</p>
                  <p className="qx-num font-mono font-bold" dir="ltr">
                    {sale.invoiceNo}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">{t('app.date')}</p>
                  <p>{fmtDateTime(sale.createdAt)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">{t('sales.customer')}</p>
                  <p>{sale.customerName ?? t('pos.walkIn')}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">{t('app.status')}</p>
                  <StatusBadge status={sale.status} label={saleStatusLabel(sale.status, lang)} />
                </div>
              </div>

              {/* items */}
              <div className="qx-scroll overflow-hidden rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/70">
                    <tr className="text-xs text-muted-foreground">
                      <th className="px-3 py-2 text-start font-medium">الصنف</th>
                      <th className="px-3 py-2 text-start font-medium">التشغيلة</th>
                      <th className="px-3 py-2 text-start font-medium">كمية الفاتورة</th>
                      <th className="px-3 py-2 text-start font-medium">مرتجع سابقاً</th>
                      <th className="px-3 py-2 text-start font-medium">المتاح للإرجاع</th>
                      <th className="px-3 py-2 text-end font-medium">كمية الإرجاع</th>
                      <th className="px-3 py-2 text-end font-medium">قيمة الإرجاع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sale?.items ?? []).map((i) => {
                      const qty = qtys[i.saleItemId] ?? 0
                      return (
                        <tr key={i.saleItemId} className={i.returnableQty === 0 ? 'opacity-50' : undefined}>
                          <td className="max-w-40 truncate px-3 py-2 font-medium">{i.productName}</td>
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
                            <span className="qx-num tabular-nums text-[var(--warning)]" dir="ltr">
                              {formatQty(i.returnedQty, !Number.isInteger(i.returnedQty))}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={
                                i.returnableQty > 0
                                  ? 'qx-num font-bold tabular-nums text-[var(--success)]'
                                  : 'qx-num tabular-nums text-muted-foreground'
                              }
                              dir="ltr"
                            >
                              {i.returnableQty}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-end">
                            <Input
                              type="number"
                              className="qx-num ml-auto h-9 w-20 text-center tabular-nums"
                              dir="ltr"
                              min={0}
                              max={i.returnableQty}
                              value={qty === 0 ? '' : qty}
                              placeholder="0"
                              disabled={i.returnableQty === 0}
                              onChange={(e) => setQty(i, parseInt(e.target.value, 10))}
                              aria-label={`كمية إرجاع ${i.productName}`}
                            />
                          </td>
                          <td className="px-3 py-2 text-end">
                            <span className="qx-num font-bold tabular-nums" dir="ltr">
                              {money(r2(qty * i.unitPrice))}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* reason + submit */}
              <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="qx-return-reason">سبب الإرجاع (اختياري)</Label>
                  <Textarea
                    id="qx-return-reason"
                    placeholder="مثال: صنف تالف / العميل رفض البديل"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="flex flex-col items-stretch gap-2 lg:items-end">
                  <div className="flex items-center justify-between rounded-xl border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-4 py-2.5 lg:min-w-64">
                    <span className="text-sm font-bold text-[var(--warning)]">إجمالي المرتجع</span>
                    <span className="qx-num text-lg font-extrabold tabular-nums text-[var(--warning)]" dir="ltr">
                      {money(refundTotal)}
                    </span>
                  </div>
                  <Button
                    className="h-11 font-bold"
                    disabled={selectedItems.length === 0 || submitting}
                    onClick={() => void submitReturn()}
                  >
                    {submitting ? (
                      <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    ) : (
                      <PackageCheck className="me-2 h-4 w-4" />
                    )}
                    تسجيل المرتجع
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {!saleLoading && !saleError && !sale && (
            <div className="pt-4">
              <EmptyState
                title="لم يتم تحميل فاتورة"
                hint="أدخل رقم فاتورة بيع صالحة (غير ملغاة) لبدء مرتجع"
                icon={<ReceiptText className="h-6 w-6" />}
              />
            </div>
          )}
        </SectionCard>
      ) : (
        <SectionCard>
          <EmptyState
            title="لا تملك صلاحية إنشاء المرتجعات"
            hint="راجع مدير النظام لمنحك صلاحية SALES_RETURN"
          />
        </SectionCard>
      )}

      {/* history */}
      {canViewHistory && (
        <SectionCard title="سجل المرتجعات" description="كل مرتجعات المبيعات المسجلة في النظام">
          <DataTable
            columns={historyColumns}
            rows={history?.items}
            loading={historyLoading}
            error={historyError ?? undefined}
            onRetry={() => void loadHistory()}
            emptyTitle="لا توجد مرتجعات"
            emptyHint="سيظهر هنا سجل مرتجعات المبيعات"
          />
          {history && (history.items?.length ?? 0) > 0 && (
            <div className="pt-4">
              <Pagination page={history.page} pageSize={history.pageSize} total={history.total} onPage={setPage} />
            </div>
          )}
        </SectionCard>
      )}
    </div>
  )
}
