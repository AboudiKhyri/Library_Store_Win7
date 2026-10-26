'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Purchases screen (فواتير الشراء)
// Filters + paged list + new purchase dialog (draft / receive-now) + detail dialog.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLibraryStore } from '../store'
import { api, errMessage } from '../api'
import { PageHeader, DataTable, Pagination, ConfirmDialog, StatusBadge, SectionCard, type Column } from '../parts/kit'
import { purchaseStatusLabel, paymentStatusBadge } from '../parts/labels'
import { formatQty } from '../parts/format'
import { useToast } from '@/hooks/use-toast'
import type { Paged } from '@/lib/library/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Truck, Plus, Eye, RefreshCw, Search, PackageCheck, Trash2, Loader2, Banknote } from 'lucide-react'


// ---------- API row types ----------

interface PurchaseRow {
  id: string
  invoiceNo: string
  supplierName: string
  status: string
  subtotal: number
  discount: number
  tax: number
  total: number
  paidAmount: number
  paymentStatus: string
  itemsCount: number
  createdAt: string
  receivedAt: string | null
}

interface PurchaseDetail extends Omit<PurchaseRow, 'supplierName' | 'itemsCount'> {
  supplier: { id: string; name: string; phone: string | null }
  notes: string | null
  items: {
    id: string
    productName: string
    sku: string
    unit: string
    batchNo: string | null
      quantity: number
    unitCost: number
    total: number
    receivedQty: number
    batchId: string | null
  }[]
}

interface SupplierLite {
  id: string
  name: string
}

interface ProductLite {
  id: string
  nameAr: string
  sku: string
  barcode?: string | null
  unit?: string
  purchasePrice?: number
}

interface DraftItem {
  productId: string
  nameAr: string
  sku: string
  unit: string
  quantity: string
  unitCost: string
  batchNo: string
}

const num = (v: string): number => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

// ==================================================================

export function PurchasesScreen() {
  const t = useLibraryStore((s) => s.t)
  const money = useLibraryStore((s) => s.money)
  const fmtDateTime = useLibraryStore((s) => s.fmtDateTime)
  const fmtDate = useLibraryStore((s) => s.fmtDate)
  const lang = useLibraryStore((s) => s.lang)
  const has = useLibraryStore((s) => s.has)
  const { toast } = useToast()

  // list state
  const [rows, setRows] = useState<PurchaseRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pageSize = 15

  // filters
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [paymentStatus, setPaymentStatus] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')

  // dialogs
  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [receiveTarget, setReceiveTarget] = useState<PurchaseRow | null>(null)
  const [cancelTarget, setCancelTarget] = useState<PurchaseRow | null>(null)
  const [payTarget, setPayTarget] = useState<PurchaseRow | null>(null)
  const [actionPending, setActionPending] = useState(false)


  // ---- command palette hand-off: openCreate ----
  const viewParams = useLibraryStore((s) => s.viewParams)
  const paletteHandled = useRef('')
  const paramsKey = JSON.stringify(viewParams)
  useEffect(() => {
    if (paramsKey === paletteHandled.current || paramsKey === '{}') return
    paletteHandled.current = paramsKey
    if (viewParams.openCreate === true) setCreateOpen(true)
  }, [paramsKey])

  useEffect(() => {
    const h = setTimeout(() => setDebouncedQ(q), 400)
    return () => clearTimeout(h)
  }, [q])

  useEffect(() => {
    setPage(1)
  }, [debouncedQ, status, paymentStatus, from, to])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (debouncedQ) params.set('q', debouncedQ)
      if (status !== 'all') params.set('status', status)
      if (paymentStatus !== 'all') params.set('paymentStatus', paymentStatus)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const res = await api<Paged<PurchaseRow>>(`/purchases?${params.toString()}`)
      setRows(Array.isArray(res) ? res : (res?.items ?? []))
      setTotal(res?.total ?? (Array.isArray(res) ? res.length : (res?.items?.length ?? 0)))
    } catch (e) {
      setError(errMessage(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [page, debouncedQ, status, paymentStatus, from, to])

  async function confirmReceive() {
    if (!receiveTarget) return
    setActionPending(true)
    try {
      await api(`/purchases/${receiveTarget.id}/receive`, { method: 'POST' })
      toast({ title: 'تم استلام الفاتورة', description: `تمت إضافة أصناف ${receiveTarget.invoiceNo} للمخزون وإنشاء الباتشات` })
      setReceiveTarget(null)
      await load()
    } catch (e) {
      toast({ variant: 'destructive', title: 'تعذر الاستلام', description: errMessage(e) })
    } finally {
      setActionPending(false)
    }
  }

  async function confirmCancel() {
    if (!cancelTarget) return
    setActionPending(true)
    try {
      await api(`/purchases/${cancelTarget.id}/cancel`, { method: 'POST' })
      toast({ title: 'تم إلغاء الفاتورة', description: `أُلغيت المسودة ${cancelTarget.invoiceNo}` })
      setCancelTarget(null)
      await load()
    } catch (e) {
      toast({ variant: 'destructive', title: 'تعذر الإلغاء', description: errMessage(e) })
    } finally {
      setActionPending(false)
    }
  }

  const columns: Column<PurchaseRow>[] = [
    {
      key: 'invoiceNo',
      header: t('purchases.invoiceNo'),
      render: (r) => (
        <span className="font-mono text-xs font-semibold qx-num" dir="ltr">
          {r.invoiceNo}
        </span>
      ),
      className: 'whitespace-nowrap',
    },
    { key: 'supplierName', header: t('purchases.supplier'), className: 'min-w-40' },
    {
      key: 'itemsCount',
      header: t('sales.items'),
      render: (r) => <span className="tabular-nums">{r.itemsCount}</span>,
    },
    {
      key: 'total',
      header: t('app.total'),
      render: (r) => <span className="font-bold tabular-nums">{money(r.total)}</span>,
      headerClassName: 'text-end',
      className: 'text-end',
    },
    {
      key: 'paymentStatus',
      header: t('purchases.paidAmount'),
      render: (r) => (
        <div className="flex flex-col items-start gap-1">
          <span className="tabular-nums text-xs text-muted-foreground">{money(r.paidAmount)}</span>
          <StatusBadge status={r.paymentStatus} label={paymentStatusBadge(r.paymentStatus, lang)} />
        </div>
      ),
    },
    {
      key: 'status',
      header: t('app.status'),
      render: (r) => <StatusBadge status={r.status} label={purchaseStatusLabel(r.status, lang)} />,
    },
    {
      key: 'createdAt',
      header: t('app.date'),
      render: (r) => (
        <div className="flex flex-col gap-0.5">
          <span className="whitespace-nowrap text-xs">{fmtDateTime(r.createdAt)}</span>
          {r.receivedAt && (
            <span className="whitespace-nowrap text-[11px] text-muted-foreground">
              استلام: {fmtDateTime(r.receivedAt)}
            </span>
          )}
        </div>
      ),
      className: 'whitespace-nowrap',
    },
    {
      key: 'actions',
      header: t('app.actions'),
      render: (r) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-9 w-9" title="عرض" aria-label="عرض الفاتورة" onClick={() => setDetailId(r.id)}>
            <Eye className="h-4 w-4" />
          </Button>
          {r.status === 'DRAFT' && has('PURCHASE_RECEIVE') && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 border-[var(--success)]/40 text-[var(--success)] hover:bg-[var(--success)]/10"
              onClick={() => setReceiveTarget(r)}
            >
              <PackageCheck className="h-4 w-4" />
              استلام
            </Button>
          )}
          {r.status === 'DRAFT' && has('PURCHASE_CREATE') && (
            <Button variant="ghost" size="icon" className="h-9 w-9 text-[var(--danger)]" title="إلغاء" aria-label="إلغاء الفاتورة" onClick={() => setCancelTarget(r)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          {r.paymentStatus !== 'PAID' && r.status !== 'CANCELLED' && has('PURCHASE_CREATE') && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
              title="تسجيل سداد الفاتورة"
              onClick={() => setPayTarget(r)}
            >
              <Banknote className="h-4 w-4" />
              سداد
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
        title={t('purchases.title')}
        description="إدارة فواتير الشراء والاستلام — تُنشأ الباتشات وتُحدَّث التكلفة عند الاستلام"
        icon={<Truck className="h-5 w-5" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`me-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              تحديث
            </Button>
            {has('PURCHASE_CREATE') && (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="me-2 h-4 w-4" />
                {t('purchases.add')}
              </Button>
            )}
          </div>
        }
      />

      {/* Filters */}
      <SectionCard className="border border-border/60 shadow-sm">
        <div className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="بحث برقم الفاتورة أو المورد..."
                className="h-10 ps-9 bg-background"
                aria-label="بحث"
              />
            </div>
            {(q || status !== 'all' || paymentStatus !== 'all' || from || to) && (
              <Button
                variant="outline"
                size="sm"
                className="h-10 shrink-0 gap-1.5 border-dashed text-xs text-muted-foreground hover:border-solid hover:text-foreground"
                onClick={() => {
                  setQ('')
                  setStatus('all')
                  setPaymentStatus('all')
                  setFrom('')
                  setTo('')
                }}
              >
                مسح التصفية
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 border-t border-border/40 pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-muted-foreground">
                {lang === 'ar' ? 'حالة الفاتورة' : t('app.status')}
              </label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 w-full bg-background" aria-label="حالة الفاتورة">
                  <SelectValue placeholder={lang === 'ar' ? 'حالة الفاتورة' : t('app.status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{lang === 'ar' ? 'كل الحالات' : t('app.all')}</SelectItem>
                  <SelectItem value="DRAFT">{purchaseStatusLabel('DRAFT', lang)}</SelectItem>
                  <SelectItem value="RECEIVED">{purchaseStatusLabel('RECEIVED', lang)}</SelectItem>
                  <SelectItem value="CANCELLED">{purchaseStatusLabel('CANCELLED', lang)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-muted-foreground">
                حالة السداد
              </label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger className="h-9 w-full bg-background" aria-label="حالة السداد">
                  <SelectValue placeholder="حالة السداد" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل حالات السداد</SelectItem>
                  <SelectItem value="UNPAID">غير مدفوعة</SelectItem>
                  <SelectItem value="PARTIAL">مدفوعة جزئياً</SelectItem>
                  <SelectItem value="PAID">مدفوعة بالكامل</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-muted-foreground">
                {lang === 'ar' ? 'من تاريخ' : t('app.from')}
              </label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                aria-label="من تاريخ"
                className="h-9 w-full bg-background qx-num text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-muted-foreground">
                {lang === 'ar' ? 'إلى تاريخ' : t('app.to')}
              </label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                aria-label="إلى تاريخ"
                className="h-9 w-full bg-background qx-num text-xs"
              />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Table */}
      <DataTable
        columns={columns}
        rows={rows ?? undefined}
        loading={loading}
        error={error ?? undefined}
        onRetry={load}
        emptyTitle={t('purchases.emptyTitle')}
        emptyHint="أنشئ فاتورة شراء جديدة لتسجيل أصناف واردة من مورد"
      />

      {!loading && !error && rows && rows.length > 0 && (
        <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} />
      )}

      {/* Dialogs */}
      <NewPurchaseDialog
        open={createOpen}
        onOpenChange={(v) => setCreateOpen(v)}
        onCreated={() => {
          setCreateOpen(false)
          void load()
        }}
      />

      <PurchaseDetailDialog
        purchaseId={detailId}
        onOpenChange={(v) => !v && setDetailId(null)}
        onPay={(row) => {
          setDetailId(null)
          setPayTarget(row)
        }}
      />

      <PayPurchaseDialog
        target={payTarget}
        open={!!payTarget}
        onOpenChange={(v) => !v && setPayTarget(null)}
        onSuccess={() => void load()}
      />

      <ConfirmDialog
        open={!!receiveTarget}
        onOpenChange={(v) => !v && setReceiveTarget(null)}
        title={`استلام ${receiveTarget?.invoiceNo ?? ''}`}
        description={t('purchases.receiveConfirm')}
        confirmLabel="استلام وتحديث المخزون"
        destructive={false}
        pending={actionPending}
        onConfirm={() => void confirmReceive()}
      />

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(v) => !v && setCancelTarget(null)}
        title={`إلغاء ${cancelTarget?.invoiceNo ?? ''}`}
        description="سيتم إلغاء هذه المسودة نهائياً — لا يمكن التراجع عن الإجراء."
        confirmLabel="تأكيد الإلغاء"
        destructive
        pending={actionPending}
        onConfirm={() => void confirmCancel()}
      />
    </div>
  )
}

// ==================================================================
// New purchase dialog

function NewPurchaseDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}) {
  const t = useLibraryStore((s) => s.t)
  const money = useLibraryStore((s) => s.money)
  const { toast } = useToast()

  const [suppliers, setSuppliers] = useState<SupplierLite[]>([])
  const [suppliersError, setSuppliersError] = useState<string | null>(null)
  const [supplierId, setSupplierId] = useState('')
  const [items, setItems] = useState<DraftItem[]>([])
  const [discount, setDiscount] = useState('')
  const [tax, setTax] = useState('')
  const [paidAmount, setPaidAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // product picker
  const [pickerOpen, setPickerOpen] = useState(false)
  const [productQuery, setProductQuery] = useState('')
  const [productOptions, setProductOptions] = useState<ProductLite[]>([])
  const [productsLoading, setProductsLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let alive = true
    void (async () => {
      try {
        const res = await api<Paged<SupplierLite>>('/suppliers?pageSize=100')
        if (!alive) return
        setSuppliers(Array.isArray(res) ? res : (res?.items ?? []))
        setSuppliersError(null)
      } catch (e) {
        if (alive) setSuppliersError(errMessage(e))
      }
    })()
    return () => {
      alive = false
    }
  }, [open])

  useEffect(() => {
    if (!pickerOpen) return
    const h = setTimeout(async () => {
      setProductsLoading(true)
      try {
        const res = await api<Paged<ProductLite>>(`/products?q=${encodeURIComponent(productQuery)}&pageSize=20`)
        setProductOptions(Array.isArray(res) ? res : (res?.items ?? []))
      } catch {
        setProductOptions([])
      } finally {
        setProductsLoading(false)
      }
    }, 300)
    return () => clearTimeout(h)
  }, [pickerOpen, productQuery])

  function resetForm() {
    setSupplierId('')
    setItems([])
    setDiscount('')
    setTax('')
    setPaidAmount('')
    setNotes('')
    setProductQuery('')
  }

  function addProduct(p: ProductLite) {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === p.id)
      if (existing) {
        return prev.map((i) =>
          i.productId === p.id ? { ...i, quantity: String(num(i.quantity) + 1) } : i
        )
      }
      return [
        ...prev,
        {
          productId: p.id,
          nameAr: p.nameAr,
          sku: p.sku,
          unit: p.unit ?? 'piece',
          quantity: '1',
          unitCost: String(p.purchasePrice ?? 0),
          batchNo: '',
              },
      ]
    })
    setPickerOpen(false)
    setProductQuery('')
  }

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }

  const subtotal = useMemo(() => items.reduce((s, it) => s + num(it.quantity) * num(it.unitCost), 0), [items])
  const total = Math.max(0, subtotal - num(discount) + num(tax))

  async function save(receiveNow: boolean) {
    if (!supplierId) {
      toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'اختر المورد أولاً' })
      return
    }
    const validItems = items.filter((it) => num(it.quantity) > 0)
    if (validItems.length === 0) {
      toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'أضف صنفاً واحداً على الأقل بكمية أكبر من صفر' })
      return
    }
    setSaving(true)
    try {
      const res = await api<{ purchaseId: string; invoiceNo: string; status: string }>('/purchases', {
        method: 'POST',
        body: {
          supplierId,
          items: validItems.map((it) => ({
            productId: it.productId,
            quantity: num(it.quantity),
            unitCost: num(it.unitCost),
            batchNo: it.batchNo.trim() || undefined,
              })),
          discount: num(discount) || undefined,
          tax: num(tax) || undefined,
          paidAmount: num(paidAmount) || undefined,
          notes: notes.trim() || undefined,
          receiveNow,
        },
      })
      toast({
        title: receiveNow ? 'تم حفظ الفاتورة واستلامها' : 'تم حفظ المسودة',
        description: `${res.invoiceNo} — ${res.status === 'RECEIVED' ? 'أُضيفت الأصناف للمخزون' : 'يمكن استلامها لاحقاً'}`,
      })
      resetForm()
      onCreated()
    } catch (e) {
      toast({ variant: 'destructive', title: 'تعذر حفظ الفاتورة', description: errMessage(e) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => onOpenChange(v)}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t('purchases.add')}</DialogTitle>
          <DialogDescription>اختر المورد والأصناف — حدد رقم الباتش والكميات لتتبع التكلفة والمخزون</DialogDescription>
        </DialogHeader>

        <div className="qx-scroll max-h-[62vh] space-y-4 overflow-y-auto pe-1">
          {/* supplier + add product */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t('purchases.supplier')}</Label>
              {suppliersError ? (
                <p className="rounded-md border border-[var(--danger)]/30 bg-[var(--danger)]/5 px-3 py-2 text-xs text-[var(--danger)]">
                  {suppliersError}
                </p>
              ) : (
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المورد..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>{t('purchases.newItem')}</Label>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <Search className="h-4 w-4" />
                      ابحث وأضف صنفاً
                    </span>
                    <Plus className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-96 p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      value={productQuery}
                      onValueChange={setProductQuery}
                      placeholder="اسم الصنف / SKU / باركود..."
                    />
                    <CommandList>
                      {productsLoading && (
                        <div className="flex items-center justify-center gap-2 p-4 text-xs text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          جارٍ البحث...
                        </div>
                      )}
                      {!productsLoading && productOptions.length === 0 && <CommandEmpty>لا توجد نتائج</CommandEmpty>}
                      <CommandGroup>
                        {productOptions.map((p) => (
                          <CommandItem
                            key={p.id}
                            value={`${p.nameAr} ${p.sku} ${p.barcode ?? ''}`}
                            onSelect={() => addProduct(p)}
                          >
                            <div className="flex w-full items-center justify-between gap-2">
                              <span className="truncate">{p.nameAr}</span>
                              <span className="font-mono text-[11px] text-muted-foreground qx-num" dir="ltr">
                                {p.sku}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* items builder */}
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              لم تُضف أصناف بعد — استخدم مربع البحث أعلاه لإضافة أصناف الفاتورة
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={it.productId} className="rounded-xl border bg-muted/20 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{it.nameAr}</p>
                      <p className="font-mono text-[11px] text-muted-foreground qx-num" dir="ltr">
                        {it.sku}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold tabular-nums">{money(num(it.quantity) * num(it.unitCost))}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[var(--danger)]"
                        aria-label="حذف الصنف"
                        onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">{t('app.quantity')}</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.001}
                        dir="ltr"
                        className="text-end qx-num"
                        value={it.quantity}
                        onChange={(e) => updateItem(i, { quantity: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">{t('purchases.unitCost')}</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        dir="ltr"
                        className="text-end qx-num"
                        value={it.unitCost}
                        onChange={(e) => updateItem(i, { unitCost: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">
                        {t('inv.batchNo')} <span className="text-muted-foreground/60">({t('app.optional')})</span>
                      </Label>
                      <Input
                        dir="ltr"
                        className="text-end qx-num"
                        placeholder="AUTO"
                        value={it.batchNo}
                        onChange={(e) => updateItem(i, { batchNo: e.target.value })}
                      />
                    </div>

                  </div>
                </div>
              ))}
            </div>
          )}

          {/* totals + payment */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">الخصم</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  dir="ltr"
                  className="max-w-40 text-end qx-num"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">الضريبة</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  dir="ltr"
                  className="max-w-40 text-end qx-num"
                  value={tax}
                  onChange={(e) => setTax(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t('purchases.paidAmount')}</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  dir="ltr"
                  className="max-w-40 text-end qx-num"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('app.notes')}</Label>
              <Textarea
                rows={4}
                placeholder="ملاحظات على الفاتورة (اختياري)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* footer totals */}
        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-muted-foreground">
              المجموع: <span className="font-semibold text-foreground tabular-nums">{money(subtotal)}</span>
            </span>
            <span className="text-muted-foreground">
              {t('app.total')}: <span className="text-base font-extrabold text-primary tabular-nums">{money(total)}</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" disabled={saving} onClick={() => void save(false)}>
              حفظ كمسودة
            </Button>
            <Button disabled={saving} onClick={() => void save(true)}>
              {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <PackageCheck className="me-2 h-4 w-4" />}
              حفظ واستلام
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ==================================================================
// Purchase detail dialog

function PurchaseDetailDialog({
  purchaseId,
  onOpenChange,
  onPay,
}: {
  purchaseId: string | null
  onOpenChange: (v: boolean) => void
  onPay?: (row: PurchaseRow) => void
}) {
  const t = useLibraryStore((s) => s.t)
  const money = useLibraryStore((s) => s.money)
  const fmtDateTime = useLibraryStore((s) => s.fmtDateTime)
  const fmtDate = useLibraryStore((s) => s.fmtDate)
  const lang = useLibraryStore((s) => s.lang)

  const [detail, setDetail] = useState<PurchaseDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!purchaseId) {
      setDetail(null)
      return
    }
    let alive = true
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const res = await api<PurchaseDetail>(`/purchases/${purchaseId}`)
        if (alive) setDetail(res)
      } catch (e) {
        if (alive) setError(errMessage(e))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [purchaseId])

  const remaining = detail ? Math.max(0, detail.total - detail.paidAmount) : 0

  return (
    <Dialog open={!!purchaseId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span>فاتورة الشراء</span>
            {detail && (
              <span className="font-mono text-sm qx-num" dir="ltr">
                {detail.invoiceNo}
              </span>
            )}
          </DialogTitle>
          {detail && (
            <DialogDescription className="flex flex-wrap items-center gap-2">
              <StatusBadge status={detail.status} label={purchaseStatusLabel(detail.status, lang)} />
              <StatusBadge status={detail.paymentStatus} label={paymentStatusBadge(detail.paymentStatus, lang)} />
              <span>
                {detail.supplier.name} · {fmtDateTime(detail.createdAt)}
              </span>
            </DialogDescription>
          )}
        </DialogHeader>

        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}
        {error && <p className="rounded-md border border-[var(--danger)]/30 bg-[var(--danger)]/5 p-3 text-sm text-[var(--danger)]">{error}</p>}

        {detail && !loading && (
          <div className="qx-scroll max-h-[62vh] space-y-4 overflow-y-auto pe-1">
            <div className="qx-scroll overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-start font-medium">{t('nav.products')}</th>
                    <th className="px-3 py-2 text-start font-medium">{t('app.quantity')}</th>
                    <th className="px-3 py-2 text-start font-medium">{t('purchases.unitCost')}</th>
                    <th className="px-3 py-2 text-start font-medium">{t('inv.batchNo')}</th>
                    <th className="px-3 py-2 text-end font-medium">{t('app.total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail?.items ?? []).map((it) => (
                    <tr key={it.id} className="border-t">
                      <td className="px-3 py-2">
                        <p className="font-medium">{it.productName}</p>
                        <p className="font-mono text-[11px] text-muted-foreground qx-num" dir="ltr">
                          {it.sku}
                        </p>
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatQty(it.quantity, !Number.isInteger(it.quantity))}
                        {detail.status === 'RECEIVED' && (
                          <span className="ms-1 text-[11px] text-[var(--success)]">
                            (مستلم: {formatQty(it.receivedQty, !Number.isInteger(it.receivedQty))})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{money(it.unitCost)}</td>
                      <td className="px-3 py-2 font-mono text-xs qx-num" dir="ltr">
                        {it.batchNo ?? (it.batchId ? '—' : 'AUTO')}
                      </td>
                        <td className="px-3 py-2 text-end font-semibold tabular-nums">{money(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 rounded-xl border bg-muted/20 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">المجموع</span>
                  <span className="tabular-nums">{money(detail.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الخصم</span>
                  <span className="tabular-nums">−{money(detail.discount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الضريبة</span>
                  <span className="tabular-nums">+{money(detail.tax)}</span>
                </div>
                <div className="flex justify-between border-t pt-1">
                  <span className="font-semibold">{t('app.total')}</span>
                  <span className="font-extrabold tabular-nums">{money(detail.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('purchases.paidAmount')}</span>
                  <span className="font-semibold tabular-nums text-[var(--success)]">{money(detail.paidAmount)}</span>
                </div>
                {remaining > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">المتبقي</span>
                    <span className="font-semibold tabular-nums text-[var(--danger)]">{money(remaining)}</span>
                  </div>
                )}
                {remaining > 0 && detail.status !== 'CANCELLED' && onPay && (
                  <div className="pt-2 border-t">
                    <Button
                      size="sm"
                      className="w-full gap-1.5 bg-success hover:bg-success/90 text-success-foreground"
                      onClick={() => {
                        onOpenChange(false)
                        onPay({
                          id: detail.id,
                          invoiceNo: detail.invoiceNo,
                          supplierName: detail.supplier.name,
                          status: detail.status,
                          subtotal: detail.subtotal,
                          discount: detail.discount,
                          tax: detail.tax,
                          total: detail.total,
                          paidAmount: detail.paidAmount,
                          paymentStatus: detail.paymentStatus,
                          itemsCount: detail?.items?.length ?? 0,
                          createdAt: detail.createdAt,
                          receivedAt: detail.receivedAt,
                        })
                      }}
                    >
                      <Banknote className="h-4 w-4" />
                      تسجيل سداد ({money(remaining)})
                    </Button>
                  </div>
                )}
              </div>
              <div className="space-y-2 rounded-xl border bg-muted/20 p-3 text-sm">
                {detail.receivedAt && (
                  <p>
                    <span className="text-muted-foreground">تاريخ الاستلام: </span>
                    {fmtDateTime(detail.receivedAt)}
                  </p>
                )}
                {detail.supplier.phone && (
                  <p>
                    <span className="text-muted-foreground">هاتف المورد: </span>
                    <span className="qx-num" dir="ltr">
                      {detail.supplier.phone}
                    </span>
                  </p>
                )}
                <p>
                  <span className="text-muted-foreground">{t('app.notes')}: </span>
                  {detail.notes ?? '—'}
                </p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ==================================================================
// Pay purchase dialog
// ==================================================================

function PayPurchaseDialog({
  target,
  open,
  onOpenChange,
  onSuccess,
}: {
  target: PurchaseRow | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onSuccess: () => void
}) {
  const money = useLibraryStore((s) => s.money)
  const { toast } = useToast()
  const remaining = target ? Math.max(0, target.total - target.paidAmount) : 0
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (target) {
      setAmount(String(Math.max(0, target.total - target.paidAmount)))
      setNotes('')
    }
  }, [target])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!target) return
    const val = parseFloat(amount)
    if (!Number.isFinite(val) || val <= 0) {
      toast({ variant: 'destructive', title: 'بيانات غير صالحة', description: 'أدخل مبلغاً صالحاً أكبر من صفر' })
      return
    }
    setBusy(true)
    try {
      await api(`/purchases/${target.id}/pay`, {
        method: 'POST',
        body: { amount: val, notes: notes.trim() || undefined },
      })
      toast({
        title: 'تم تسجيل السداد بنجاح',
        description: val >= remaining ? 'أصبحت الفاتورة مسددة بالكامل' : `تم سداد ${money(val)} وتحديث الرصيد المتبقي`,
      })
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast({ variant: 'destructive', title: 'تعذر تسجيل السداد', description: errMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <span>تسجيل سداد فاتورة شراء</span>
          </DialogTitle>
          <DialogDescription>
            {target?.invoiceNo} — {target?.supplierName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl border bg-muted/20 p-3 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">إجمالي الفاتورة:</span>
              <span className="font-semibold tabular-nums">{money(target?.total ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">المسدد سابقاً:</span>
              <span className="font-semibold tabular-nums text-[var(--success)]">{money(target?.paidAmount ?? 0)}</span>
            </div>
            <div className="flex justify-between border-t pt-1.5 font-bold">
              <span className="text-[var(--danger)]">المتبقي المطلوب سداده:</span>
              <span className="tabular-nums text-[var(--danger)]">{money(remaining)}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">المبلغ المدفوع الآن *</Label>
            <Input
              id="pay-amount"
              type="number"
              step="0.01"
              min="0.01"
              max={remaining}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono text-base"
              dir="ltr"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-notes">ملاحظات السداد (اختياري)</Label>
            <Input
              id="pay-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: سداد نقدي للمندوب / تحويل بنكي"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              إلغاء
            </Button>
            <Button type="submit" disabled={busy} className="gap-1.5 bg-success hover:bg-success/90 text-success-foreground">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              تأكيد السداد
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

