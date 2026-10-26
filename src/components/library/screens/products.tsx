'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Products screen (catalog management)
// Owned by module agent 2-a. List + filters + create/edit + detail (batches &
// movements) + guarded delete (deactivate when referenced).
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLibraryStore } from '../store'
import { api, errMessage } from '../api'
import {
  PageHeader,
  DataTable,
  Pagination,
  ConfirmDialog,
  PermanentDeleteDialog,
  StatusBadge,
  Column,
  EmptyState,
} from '../parts/kit'
import { unitLabel, movementTypeLabel } from '../parts/labels'
import { formatQty, WEIGHT_UNITS } from '../parts/format'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { daysUntil } from '@/lib/library/money'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Package,
  Plus,
  Search,
  Pencil,
  Trash2,
  AlertTriangle,
  Loader2,
  Boxes,
  Layers,
  History,
  X,
  Barcode,
  QrCode,
  Printer,
} from 'lucide-react'
import { BarcodeSvg } from '../parts/barcode'
import { generateUniqueBarcode, generateBarcodeFromNameAndPrice, generateQrFromNameAndPrice } from '@/lib/library/barcode-gen'
import { BarcodeScannerDialog } from '../parts/barcode-scanner-dialog'
import { BarcodeLabelsSheet, type LabelRow, type LabelSize } from '../parts/barcode-labels'

// ---------------- types ----------------

interface ProductRow {
  id: string
  sku: string
  barcode: string | null
  nameAr: string
  nameEn: string | null
  genericName: string | null
  categoryId: string | null
  categoryName: string | null
  manufacturer: string | null
  unit: string
  packSize: number
  isWeighable: boolean
  purchasePrice: number
  sellingPrice: number
  minSellingPrice: number | null
  taxRate: number
  reorderLevel: number
  active: boolean
  stockAvailable: number
  stockTotal: number
  createdAt: string
}

interface CategoryItem {
  id: string
  nameAr: string
  nameEn: string | null
  active: boolean
  productsCount: number
}

interface ProductBatch {
  id: string
  batchNo: string
  quantity: number
  costPrice: number
  status: string
}

interface ProductMovement {
  id: string
  type: string
  quantity: number
  unitCost: number | null
  batchId: string | null
  refType: string | null
  refId: string | null
  note: string | null
  createdAt: string
}

interface ProductDetail {
  product: {
    id: string
    sku: string
    barcode: string | null
    nameAr: string
    nameEn: string | null
    genericName: string | null
    categoryId: string | null
    categoryName: string | null
    manufacturer: string | null
    unit: string
    packSize: number
    isWeighable: boolean
    purchasePrice: number
    sellingPrice: number
    minSellingPrice: number | null
    taxRate: number
    reorderLevel: number
    active: boolean
    notes: string | null
    createdAt: string
  }
  batches: ProductBatch[]
  movements: ProductMovement[]
  stockAvailable: number
  stockTotal: number
}

const DEFAULT_UNITS = ['piece', 'pack', 'box', 'kg', 'g', 'l', 'ml'] as const
const PAGE_SIZE = 20

// ---------------- screen ----------------

export function ProductsScreen() {
  const t = useLibraryStore((s) => s.t)
  const money = useLibraryStore((s) => s.money)
  const has = useLibraryStore((s) => s.has)
  const status = useLibraryStore((s) => s.status)
  const warningDays = Number(status?.inventory?.expiryWarningDays) || 30
  const { toast } = useToast()

  const canCreate = has('PRODUCT_CREATE')
  const canEdit = has('PRODUCT_EDIT')
  const canDelete = has('PRODUCT_DELETE')

  // list state
  const [rows, setRows] = useState<ProductRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // filters
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [activeFilter, setActiveFilter] = useState('all')
  const [lowStock, setLowStock] = useState(false)

  // categories for the filter + form (hidden gracefully if the role can't list them)
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [categoriesAllowed, setCategoriesAllowed] = useState(true)

  // dialogs
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ProductRow | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ProductDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteSalesOption, setDeleteSalesOption] = useState(false)

  // ---- bulk selection ----
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkConfirm, setBulkConfirm] = useState<'activate' | 'deactivate' | null>(null)

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allPageSelected = !!rows && rows.length > 0 && rows.every((r) => selected.has(r.id))
  const somePageSelected = !!rows && rows.some((r) => selected.has(r.id))

  function toggleSelectPage() {
    if (!rows) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (allPageSelected) rows.forEach((r) => next.delete(r.id))
      else rows.forEach((r) => next.add(r.id))
      return next
    })
  }

  async function applyBulk() {
    if (!bulkConfirm || selected.size === 0) return
    setBulkBusy(true)
    try {
      const r = await api<{ updated: number }>('/products/bulk', {
        method: 'POST',
        body: { ids: Array.from(selected), action: bulkConfirm },
      })
      toast({
        title: bulkConfirm === 'activate' ? 'تم تنشيط الأصناف' : 'تم إيقاف الأصناف',
        description: `${r.updated} صنف`,
      })
      setSelected(new Set())
      setBulkConfirm(null)
      setReloadKey((k) => k + 1)
    } catch (e) {
      toast({ variant: 'destructive', title: 'تعذر تنفيذ العملية', description: errMessage(e) })
    } finally {
      setBulkBusy(false)
    }
  }

  // ---- barcode labels dialog ----
  const [labelsOpen, setLabelsOpen] = useState(false)
  const [labelSize, setLabelSize] = useState<LabelSize>('40x25')
  const [labelCopies, setLabelCopies] = useState(1)
  const [labelSelection, setLabelSelection] = useState<'all' | 'selected'>('all')

  // ---- command palette hand-off: openCreate / focusId ----
  const viewParams = useLibraryStore((s) => s.viewParams)
  const paramsKey = JSON.stringify(viewParams)
  const paletteHandled = useRef('')
  useEffect(() => {
    if (paramsKey === paletteHandled.current || paramsKey === '{}') return
    paletteHandled.current = paramsKey
    if (viewParams.openCreate === true && canCreate) {
      setEditing(null)
      setFormOpen(true)
    } else if (typeof viewParams.focusId === 'string') {
      setDetailId(viewParams.focusId)
    }
  }, [paramsKey])

  // debounce search (300ms)
  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(id)
  }, [search])

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (debounced) params.set('q', debounced)
    if (categoryId !== 'all') params.set('categoryId', categoryId)
    if (activeFilter !== 'all') params.set('active', activeFilter)
    if (lowStock) params.set('lowStock', '1')
    params.set('page', String(page))
    params.set('pageSize', String(PAGE_SIZE))
    api<{ items: ProductRow[]; total: number }>(`/products?${params.toString()}`)
      .then((d) => {
        setRows(d.items)
        setTotal(d.total)
      })
      .catch((e) => {
        setRows(null)
        setError(errMessage(e))
      })
      .finally(() => setLoading(false))
  }, [debounced, categoryId, activeFilter, lowStock, page])

  useEffect(() => {
    void load()
  }, [load, reloadKey])

  useEffect(() => {
    api<{ items: CategoryItem[] }>('/categories')
      .then((d) => setCategories(Array.isArray(d) ? d : (d?.items ?? [])))
      .catch(() => setCategoriesAllowed(false))
  }, [reloadKey])

  function reload() {
    setReloadKey((k) => k + 1)
  }

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(row: ProductRow) {
    setEditing(row)
    setFormOpen(true)
  }

  async function openDetail(id: string) {
    setDetailId(id)
    setDetail(null)
    setDetailLoading(true)
    try {
      setDetail(await api<ProductDetail>(`/products/${id}`))
    } catch (e) {
      toast({ variant: 'destructive', title: 'تعذر تحميل بيانات الصنف', description: errMessage(e) })
      setDetailId(null)
    } finally {
      setDetailLoading(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const target = deleteTarget
    try {
      await api<{ deactivated: boolean; forced?: boolean; salesDeleted?: boolean }>(
        `/products/${target.id}?force=true&deleteSales=${deleteSalesOption}`,
        { method: 'DELETE' }
      )
      if (deleteSalesOption) {
        toast({ title: 'تم حذف الصنف وجميع الفواتير المرتبطة به نهائياً' })
      } else {
        toast({ title: 'تم حذف الصنف نهائياً' })
      }
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(target.id)
        return next
      })
      setDeleteTarget(null)
      setDeleteSalesOption(false)
      reload()
    } catch (e) {
      toast({ variant: 'destructive', title: 'تعذر الحذف النهائي للصنف', description: errMessage(e) })
    } finally {
      setDeleting(false)
    }
  }

  const hasFilters = !!debounced || categoryId !== 'all' || activeFilter !== 'all' || lowStock

  function clearFilters() {
    setSearch('')
    setDebounced('')
    setCategoryId('all')
    setActiveFilter('all')
    setLowStock(false)
    setPage(1)
  }

  const columns: Column<ProductRow>[] = [
    {
      key: 'select',
      header: canEdit ? (
        <input
          type="checkbox"
          checked={allPageSelected}
          ref={(el) => {
            if (el) el.indeterminate = somePageSelected && !allPageSelected
          }}
          onChange={toggleSelectPage}
          className="h-4 w-4 accent-[var(--primary)]"
          aria-label="تحديد كل الصفحة"
        />
      ) : '',
      className: 'w-10',
      render: (row) =>
        canEdit ? (
          <input
            type="checkbox"
            checked={selected.has(row.id)}
            onChange={() => toggleSelected(row.id)}
            className="h-4 w-4 accent-[var(--primary)]"
            aria-label={`تحديد ${row.nameAr}`}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          ''
        ),
    },
    {
      key: 'name',
      header: t('products.name'),
      className: 'min-w-[220px]',
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold">{row.nameAr}</span>
          {(row.nameEn || row.genericName) && (
            <span className="text-[11px] text-muted-foreground" dir="auto">
              {row.genericName || row.nameEn}
            </span>
          )}
          <span className="font-mono text-[10px] text-muted-foreground" dir="ltr">
            {row.sku}
            {row.barcode ? ` · ${row.barcode}` : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'category',
      header: t('products.category'),
      render: (row) =>
        row.categoryName ? (
          <Badge variant="outline" className="font-normal">
            {row.categoryName}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'purchasePrice',
      header: t('products.purchasePrice'),
      render: (row) => <span className="tabular-nums text-muted-foreground">{money(row.purchasePrice)}</span>,
      headerClassName: 'text-start',
    },
    {
      key: 'sellingPrice',
      header: t('products.sellingPrice'),
      render: (row) => <span className="font-bold tabular-nums">{money(row.sellingPrice)}</span>,
    },
    {
      key: 'stock',
      header: t('products.stock'),
      render: (row) => {
        const low = row.stockAvailable <= row.reorderLevel
        const unavailable = row.stockTotal - row.stockAvailable
        return (
          <div className="flex flex-col" title={`إجمالي الكميات: ${formatQty(row.stockTotal, row.isWeighable)}`}>
            <span className={cn('flex items-center gap-1 font-bold tabular-nums', low ? 'text-[var(--warning)]' : '')}>
              {low && <AlertTriangle className="h-3.5 w-3.5" />}
              {formatQty(row.stockAvailable, row.isWeighable)}
            </span>
            {unavailable > 0 && (
              <span className="text-[10px] tabular-nums text-muted-foreground">
                +{formatQty(unavailable, row.isWeighable)} غير متاح
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'active',
      header: t('app.status'),
      render: (row) => (
        <StatusBadge status={row.active ? 'ACTIVE' : 'INACTIVE'} label={row.active ? t('app.active') : t('app.inactive')} />
      ),
    },
    {
      key: 'actions',
      header: t('app.actions'),
      render: (row) => (
        <div className="flex items-center gap-1">
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation()
                openEdit(row)
              }}
              aria-label={t('app.edit')}
              title={t('app.edit')}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-[var(--danger)] hover:text-[var(--danger)]"
              onClick={(e) => {
                e.stopPropagation()
                setDeleteTarget(row)
                setDeleteSalesOption(false)
              }}
              aria-label="تأكيد الحذف النهائي"
              title="تأكيد الحذف النهائي"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title={t('products.title')}
        description="إدارة أصناف المتجر — الأسعار، المخزون المتاح، والتصنيفات"
        icon={<Package className="h-5 w-5" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {rows && rows.length > 0 && (
              <Button variant="outline" onClick={() => setLabelsOpen(true)}>
                <Barcode className="me-2 h-4 w-4" />
                ملصقات باركود
              </Button>
            )}
            {canCreate ? (
              <Button onClick={openCreate}>
                <Plus className="me-2 h-4 w-4" />
                {t('products.add')}
              </Button>
            ) : undefined}
          </div>
        }
      />

      {/* bulk selection action bar */}
      {selected.size > 0 && canEdit && (
        <div
          className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 backdrop-blur"
          role="toolbar"
          aria-label="إجراءات جماعية"
        >
          <span className="text-sm font-bold text-primary tabular-nums">
            {selected.size} صنف محدد
          </span>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-[var(--success)]/40 text-[var(--success)] hover:bg-[var(--success)]/10"
              onClick={() => setBulkConfirm('activate')}
              disabled={bulkBusy}
            >
              تنشيط المحدد
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-[var(--danger)]/40 text-[var(--danger)] hover:bg-[var(--danger)]/10"
              onClick={() => setBulkConfirm('deactivate')}
              disabled={bulkBusy}
            >
              إيقاف المحدد
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={bulkBusy}>
              إلغاء التحديد
            </Button>
          </div>
        </div>
      )}

      {/* filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`${t('app.search')} (اسم / اسم علمي / باركود / كود)`}
            className="ps-8"
            aria-label={t('app.search')}
          />
        </div>
        {categoriesAllowed && (
          <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setPage(1) }}>
            <SelectTrigger className="w-full sm:w-44" aria-label={t('products.category')}>
              <SelectValue placeholder={t('products.category')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('app.all')} — {t('products.category')}</SelectItem>
              {(categories ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nameAr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={activeFilter} onValueChange={(v) => { setActiveFilter(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-36" aria-label={t('app.status')}>
            <SelectValue placeholder={t('app.status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('app.all')}</SelectItem>
            <SelectItem value="true">{t('app.active')}</SelectItem>
            <SelectItem value="false">{t('app.inactive')}</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={lowStock ? 'default' : 'outline'}
          onClick={() => {
            setLowStock((v) => !v)
            setPage(1)
          }}
          aria-pressed={lowStock}
          className="shrink-0"
        >
          <AlertTriangle className="me-2 h-4 w-4" />
          نقص المخزون
        </Button>
      </div>

      {/* table */}
      <DataTable
        columns={columns}
        rows={rows ?? undefined}
        loading={loading}
        error={error ?? undefined}
        onRetry={() => load()}
        onRowClick={(row) => void openDetail(row.id)}
        emptyTitle={hasFilters ? 'لا توجد أصناف مطابقة' : t('products.emptyTitle')}
        emptyHint={hasFilters ? 'جرّب تعديل البحث أو الفلاتر لعرض نتائج أوسع.' : t('products.emptyHint')}
        emptyAction={
          hasFilters ? (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="me-2 h-4 w-4" />
              مسح الفلاتر
            </Button>
          ) : canCreate ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="me-2 h-4 w-4" />
              أضف أول صنف
            </Button>
          ) : undefined
        }
      />

      {rows && rows.length > 0 && (
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
      )}

      {/* create / edit dialog */}
      <ProductFormDialog
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v)
          if (!v) setEditing(null)
        }}
        editing={editing}
        categories={categoriesAllowed ? categories : []}
        units={(status?.pos?.units?.length ? status.pos.units : [...DEFAULT_UNITS]) as string[]}
        onSaved={() => {
          setFormOpen(false)
          setEditing(null)
          reload()
        }}
        existingProducts={rows ?? []}
        onOpenProduct={(targetId) => {
          setFormOpen(false)
          const target = (rows ?? []).find((r) => r.id === targetId)
          if (target && canEdit) {
            setEditing(target)
            setFormOpen(true)
          } else {
            setDetailId(targetId)
          }
        }}
      />

      {/* detail dialog */}
      <Dialog
        open={!!detailId}
        onOpenChange={(v) => {
          if (!v) {
            setDetailId(null)
            setDetail(null)
          }
        }}
      >
        <DialogContent className="max-h-[88vh] overflow-y-auto qx-scroll sm:max-w-3xl">
          {detailLoading || !detail ? (
            <div className="flex flex-col items-center gap-3 py-12" role="status" aria-busy="true">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{t('app.loading')}</p>
            </div>
          ) : (
            <ProductDetailView detail={detail} warningDays={warningDays} />
          )}
        </DialogContent>
      </Dialog>

      {/* permanent delete dialog */}
      <PermanentDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(v) => {
          if (!v) {
            setDeleteTarget(null)
            setDeleteSalesOption(false)
          }
        }}
        itemName={deleteTarget?.nameAr ?? ''}
        warningDescription="الصنف قد يكون مرتبطاً بسجلات سابقة (مبيعات أو مشتريات أو حركات مخزون). الحذف النهائي سيزيل الصنف وجميع حركاته المخزنية نهائياً من قاعدة البيانات."
        checkboxLabel="حذف الفواتير المرتبطة بهذا العنصر"
        checkboxHint="عند تفعيل هذا الخيار، سيتم حذف جميع فواتير البيع التي تشتمل على هذا الصنف بالكامل."
        deleteRelatedOption={deleteSalesOption}
        onDeleteRelatedOptionChange={setDeleteSalesOption}
        isDeleting={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          setDeleteTarget(null)
          setDeleteSalesOption(false)
        }}
      />

      {/* bulk confirm */}
      <ConfirmDialog
        open={bulkConfirm !== null}
        onOpenChange={(v) => !v && setBulkConfirm(null)}
        title={bulkConfirm === 'activate' ? `تنشيط ${selected.size} صنف؟` : `إيقاف ${selected.size} صنف؟`}
        description={
          bulkConfirm === 'activate'
            ? 'ستصبح الأصناف المحددة متاحة للبيع في نقطة البيع مرة أخرى.'
            : 'ستُخفى الأصناف المحددة من نقطة البيع — لن تُحذف أي بيانات أو مخزون.'
        }
        confirmLabel={bulkConfirm === 'activate' ? 'تنشيط' : 'إيقاف'}
        destructive={bulkConfirm === 'deactivate'}
        pending={bulkBusy}
        onConfirm={() => void applyBulk()}
      />

      {/* barcode labels dialog */}
      <Dialog open={labelsOpen} onOpenChange={setLabelsOpen}>
        <DialogContent className="qx-scroll max-h-[90vh] overflow-y-auto overflow-x-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Barcode className="h-5 w-5 text-primary" />
              ملصقات باركود للأصناف
            </DialogTitle>
            <DialogDescription>
              اطبع ملصقات لاصقة بالباركود والسعر للأصناف المعروضة حالياً في القائمة — استخدم ملصقات مقاس ٣٠×٢٠ أو ٤٠×٢٥ أو ٥٠×٢٥ مم
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">مقاس الملصق</Label>
              <Select value={labelSize} onValueChange={(v) => setLabelSize(v as LabelSize)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30x20">30×20 مم</SelectItem>
                  <SelectItem value="40x25">40×25 مم</SelectItem>
                  <SelectItem value="50x25">50×25 مم</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">عدد النسخ لكل صنف</Label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setLabelCopies(n)}
                    className={cn(
                      'h-9 flex-1 rounded-lg border text-sm font-bold tabular-nums transition',
                      labelCopies === n ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">الأصناف</Label>
              <Select value={labelSelection} onValueChange={(v) => setLabelSelection(v as 'all' | 'selected')}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">المعروضة بالقائمة ({rows?.length ?? 0})</SelectItem>
                  <SelectItem value="selected" disabled={!rows?.some((r) => r.barcode)}>
                    ذات الباركود فقط
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* live preview (screen) */}
          <div className="barcode-preview-card rounded-xl border bg-muted/30 p-3">
            <p className="mb-2 text-[11px] font-semibold text-muted-foreground">معاينة الورقة (تُطبع بالأبيض والأسود)</p>
            <div className="barcode-preview-scroll qx-scroll rounded-lg border border-border/40 bg-white p-2">
              <div className="barcode-preview-inner origin-top">
                <BarcodeLabelsSheet
                  rows={
                    (labelSelection === 'all'
                      ? (rows ?? []).map(toLabelRow)
                      : (rows ?? []).filter((r) => r.barcode).map(toLabelRow)) as LabelRow[]
                  }
                  size={labelSize}
                  copiesPerLabel={labelCopies}
                  business={status?.business ?? null}
                  money={money}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLabelsOpen(false)}>
              {t('app.close')}
            </Button>
            <Button onClick={() => window.print()} disabled={!rows || rows.length === 0}>
              <Printer className="me-2 h-4 w-4" />
              طباعة الملصقات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* hidden print target for labels (visible only in print) */}
      {labelsOpen && (
        <div id="qx-labels-print" className="hidden print:block">
          <BarcodeLabelsSheet
            rows={
              (labelSelection === 'all'
                ? (rows ?? []).map(toLabelRow)
                : (rows ?? []).filter((r) => r.barcode).map(toLabelRow)) as LabelRow[]
            }
            size={labelSize}
            copiesPerLabel={labelCopies}
            business={status?.business ?? null}
            money={money}
          />
        </div>
      )}
    </div>
  )
}

function toLabelRow(r: ProductRow): LabelRow {
  return {
    productId: r.id,
    nameAr: r.nameAr,
    sku: r.sku,
    barcode: r.barcode ?? null,
    sellingPrice: r.sellingPrice,
    categoryName: null,
  }
}

// ---------------- detail view ----------------

function ProductDetailView({
  detail,
  warningDays,
}: {
  detail: ProductDetail
  warningDays: number
}) {
  const money = useLibraryStore((s) => s.money)
  const fmtDate = useLibraryStore((s) => s.fmtDate)
  const fmtDateTime = useLibraryStore((s) => s.fmtDateTime)
  const lang = useLibraryStore((s) => s.lang)
  const p = detail.product
  const info: { label: string; value: string }[] = [
    { label: 'الكود الداخلي', value: p.sku },
    { label: 'الباركود', value: p.barcode ?? '—' },
    { label: 'التصنيف', value: p.categoryName ?? '—' },
    { label: 'النوع / التفصيل', value: p.genericName ?? '—' },
    { label: 'الشركة المنتجة', value: p.manufacturer ?? '—' },
    { label: 'وحدة البيع', value: `${unitLabel(p.unit, lang)} × ${p.packSize}` },
    {
      label: 'البيع بالوزن',
      value: p.isWeighable ? 'نعم — كميات كسرية' : 'لا — كميات صحيحة',
    },
    { label: 'سعر الشراء', value: money(p.purchasePrice) },
    { label: 'سعر البيع', value: money(p.sellingPrice) },
    { label: 'أقل سعر بيع', value: p.minSellingPrice != null ? money(p.minSellingPrice) : '—' },
    { label: 'الضريبة', value: `${p.taxRate}%` },
    { label: 'حد إعادة الطلب', value: String(p.reorderLevel) },
  ]

  return (
    <div className="space-y-5">
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2">
          <span>{p.nameAr}</span>
          <StatusBadge status={p.active ? 'ACTIVE' : 'INACTIVE'} label={p.active ? 'نشط' : 'غير نشط'} />
        </DialogTitle>
        <DialogDescription className="font-mono text-xs" dir="ltr">
          {p.sku}
          {p.barcode ? ` · ${p.barcode}` : ''}
          {p.nameEn ? ` · ${p.nameEn}` : ''}
        </DialogDescription>
      </DialogHeader>

      {/* stock summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border p-3">
          <p className="text-[11px] text-muted-foreground">المتاح للبيع</p>
          <p className="mt-1 text-xl font-extrabold tabular-nums text-[var(--success)]">{detail.stockAvailable}</p>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-[11px] text-muted-foreground">إجمالي الكميات</p>
          <p className="mt-1 text-xl font-extrabold tabular-nums">{detail.stockTotal}</p>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-[11px] text-muted-foreground">عدد الباتشات</p>
          <p className="mt-1 text-xl font-extrabold tabular-nums">{detail.batches.length}</p>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-[11px] text-muted-foreground">حد إعادة الطلب</p>
          <p className="mt-1 text-xl font-extrabold tabular-nums">{p.reorderLevel}</p>
        </div>
      </div>

      {/* product info */}
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-bold">
          <Boxes className="h-4 w-4 text-primary" />
          بيانات الصنف
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border p-3 text-sm sm:grid-cols-3">
          {info.map((f) => (
            <div key={f.label} className="min-w-0">
              <p className="text-[11px] text-muted-foreground">{f.label}</p>
              <p className="truncate font-medium tabular-nums" dir="auto" title={f.value}>
                {f.value}
              </p>
            </div>
          ))}
        </div>
        {p.notes && (
          <p className="mt-2 rounded-xl border border-dashed p-3 text-xs text-muted-foreground">{p.notes}</p>
        )}
      </div>

      {/* batches */}
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-bold">
          <Layers className="h-4 w-4 text-primary" />
          الباتشات
        </p>
        {detail.batches.length === 0 ? (
          <EmptyState
            title="لا توجد باتشات لهذا الصنف"
            hint="استلم الباتشات من فواتير الشراء — يتم إنشاء الباتشات تلقائياً عند استلام فاتورة شراء."
            icon={<Layers className="h-6 w-6" />}
          />
        ) : (
          <>
            <p className="mb-2 text-[11px] text-muted-foreground">
              استلم الباتشات من فواتير الشراء — يتم إنشاؤها تلقائياً عند الاستلام ويُصرف المخزون بنظام FIFO.
            </p>
            <div className="qx-scroll max-h-72 overflow-y-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/95 backdrop-blur">
                  <tr className="text-start text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-start font-medium">رقم الباتش</th>
                    <th className="px-3 py-2 text-start font-medium">الكمية</th>
                    <th className="px-3 py-2 text-start font-medium">التكلفة</th>
                    <th className="px-3 py-2 text-start font-medium">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.batches.map((b) => {
                    return (
                      <tr key={b.id} className="border-t">
                        <td className="px-3 py-2 font-mono text-xs" dir="ltr">
                          {b.batchNo}
                        </td>
                        <td className="px-3 py-2 font-bold tabular-nums">{b.quantity}</td>
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">{money(b.costPrice)}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={b.status} label={batchStatusLabel(b.status)} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* recent movements */}
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-bold">
          <History className="h-4 w-4 text-primary" />
          أحدث الحركات
        </p>
        {detail.movements.length === 0 ? (
          <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">لا توجد حركات مسجلة بعد.</p>
        ) : (
          <div className="space-y-1.5">
            {detail.movements.map((m) => (
              <div key={m.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
                <span
                  className={cn(
                    'w-14 shrink-0 text-end font-bold tabular-nums',
                    m.quantity >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]',
                  )}
                  dir="ltr"
                >
                  {m.quantity >= 0 ? `+${m.quantity}` : m.quantity}
                </span>
                <span className="font-medium">{movementTypeLabel(m.type, lang)}</span>
                <span className="ms-auto text-muted-foreground" dir="auto">
                  {fmtDateTime(m.createdAt)}
                </span>
                {m.note && <span className="max-w-[40%] truncate text-muted-foreground" title={m.note}>· {m.note}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function batchStatusLabel(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: 'نشط',
    DEPLETED: 'منتهي الكمية',
    DAMAGED: 'تالف',
      }
  return map[status] ?? status
}

// ---------------- create / edit form ----------------

interface ProductFormValues {
  sku: string
  nameAr: string
  nameEn: string
  genericName: string
  barcode: string
  categoryId: string
  manufacturer: string
  unit: string
  packSize: string
  isWeighable: boolean
  initialStock: string
  purchasePrice: string
  sellingPrice: string
  minSellingPrice: string
  taxRate: string
  reorderLevel: string
  active: boolean
  notes: string
}

function emptyForm(): ProductFormValues {
  return {
    sku: '',
    nameAr: '',
    nameEn: '',
    genericName: '',
    barcode: '',
    categoryId: 'none',
    manufacturer: '',
    unit: 'piece',
    packSize: '1',
    isWeighable: false,
    initialStock: '',
    purchasePrice: '0',
    sellingPrice: '',
    minSellingPrice: '',
    taxRate: '0',
    reorderLevel: '10',
    active: true,
    notes: '',
  }
}

function rowToForm(row: ProductRow): ProductFormValues {
  return {
    sku: row.sku,
    nameAr: row.nameAr,
    nameEn: row.nameEn ?? '',
    genericName: row.genericName ?? '',
    barcode: row.barcode ?? '',
    categoryId: row.categoryId ?? 'none',
    manufacturer: row.manufacturer ?? '',
    unit: row.unit,
    packSize: String(row.packSize),
    isWeighable: !!row.isWeighable,
    initialStock: '',
    purchasePrice: String(row.purchasePrice),
    sellingPrice: String(row.sellingPrice),
    minSellingPrice: row.minSellingPrice != null ? String(row.minSellingPrice) : '',
    taxRate: String(row.taxRate),
    reorderLevel: String(row.reorderLevel),
    active: row.active,
    notes: '',
  }
}

function parseNumber(value: string, label: string, opts: { min?: number; max?: number; int?: boolean } = {}): number | string {
  const trimmed = value.trim()
  if (trimmed === '') return `${label} مطلوب`
  const n = Number(trimmed)
  if (!Number.isFinite(n)) return `${label} يجب أن يكون رقماً صحيحاً`
  if (opts.int && !Number.isInteger(n)) return `${label} يجب أن يكون رقماً صحيحاً بدون كسور`
  if (opts.min != null && n < opts.min) return `${label} لا يمكن أن يكون أقل من ${opts.min}`
  if (opts.max != null && n > opts.max) return `${label} لا يمكن أن يتجاوز ${opts.max}`
  return n
}

function computeNextSku(existingProducts?: { sku?: string }[]): string {
  const existingSet = new Set<string>()
  const seqNums: number[] = []
  ;(existingProducts || []).forEach((p) => {
    if (p && p.sku) {
      const s = String(p.sku).trim()
      existingSet.add(s.toUpperCase())
      const m = s.match(/^SKU-(\d+)$/i)
      if (m) {
        const val = parseInt(m[1], 10)
        if (val > 0 && val < 500000) seqNums.push(val)
      }
    }
  })
  let nextNum = 1
  if (seqNums.length > 0) {
    nextNum = Math.max(...seqNums) + 1
  }
  let candidate = `SKU-${String(nextNum).padStart(4, '0')}`
  while (existingSet.has(candidate.toUpperCase())) {
    nextNum++
    candidate = `SKU-${String(nextNum).padStart(4, '0')}`
  }
  return candidate
}

function ProductFormDialog({
  open,
  onOpenChange,
  editing,
  categories,
  units,
  onSaved,
  existingProducts = [],
  onOpenProduct,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: ProductRow | null
  categories: CategoryItem[]
  units: string[]
  onSaved: () => void
  existingProducts?: { id: string; nameAr: string; sku: string; barcode: string | null }[]
  onOpenProduct?: (productId: string) => void
}) {
  const t = useLibraryStore((s) => s.t)
  const lang = useLibraryStore((s) => s.lang)
  const { toast } = useToast()
  const has = useLibraryStore((s) => s.has)
  const canCreate = has('PRODUCT_CREATE')
  const canEdit = has('PRODUCT_EDIT')
  const canMutate = editing ? canEdit : canCreate
  const isAr = lang !== 'en'

  const [form, setForm] = useState<ProductFormValues>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [overwriteConfirmOpen, setOverwriteConfirmOpen] = useState(false)
  const unitOptions = units.length > 0 ? units : ([...DEFAULT_UNITS] as string[])

    const handleAutoSku = () => {
    try {
      const fallbackSku = computeNextSku(existingProducts)
      set('sku', fallbackSku)
      api<{ nextSku: string }>('/products/next-sku')
        .then((r) => {
          if (r?.nextSku) {
            set('sku', r.nextSku)
            toast({
              title: isAr ? 'تم توليد كود SKU تلقائياً' : 'SKU generated successfully',
              description: r.nextSku,
            })
          }
        })
        .catch(() => {
          toast({
            title: isAr ? 'تم توليد كود SKU تلقائياً' : 'SKU generated successfully',
            description: fallbackSku,
          })
        })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: isAr ? 'تعذر توليد كود SKU' : 'Failed to generate SKU',
        description: errMessage(err),
      })
    }
  }

  const handleQrExtracted = (scanned: string) => {
    setScannerOpen(false)
    const trimmed = (scanned || '').trim()
    if (!trimmed) return

    // 1. Try parsing structured JSON
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const data = JSON.parse(trimmed)
        const updates: Partial<ProductFormValues> = {}
        if (data.nameAr || data.name || data.title) updates.nameAr = String(data.nameAr || data.name || data.title)
        if (data.nameEn || data.titleEn) updates.nameEn = String(data.nameEn || data.titleEn)
        if (data.genericName || data.generic) updates.genericName = String(data.genericName || data.generic)
        if (data.manufacturer || data.brand) updates.manufacturer = String(data.manufacturer || data.brand)
        if (data.sku || data.code || data.id) updates.sku = String(data.sku || data.code || data.id)
        if (data.barcode) updates.barcode = String(data.barcode)
        if (data.sellingPrice ?? data.price) updates.sellingPrice = Number(data.sellingPrice ?? data.price)
        if (data.purchasePrice ?? data.cost) updates.purchasePrice = Number(data.purchasePrice ?? data.cost)
        if (data.minSellingPrice ?? data.minPrice) updates.minSellingPrice = Number(data.minSellingPrice ?? data.minPrice)
        if (data.notes ?? data.description) updates.notes = String(data.notes ?? data.description)
        if (data.unit) updates.unit = String(data.unit)
        if (data.packSize) updates.packSize = Number(data.packSize)

        setForm((prev) => ({ ...prev, ...updates }))
        toast({
          title: isAr ? 'تم استخلاص بيانات الصنف من رمز QR بنجاح' : 'Product data extracted from QR successfully',
          description: updates.nameAr || updates.sku || trimmed,
        })
        return
      } catch {}
    }

    // 2. Try URL query parameters
    if (trimmed.includes('?') || trimmed.includes('&') || trimmed.includes('=')) {
      try {
        const queryStr = trimmed.includes('?') ? trimmed.split('?')[1] : trimmed
        const params = new URLSearchParams(queryStr)
        const updates: Partial<ProductFormValues> = {}
        if (params.get('name') || params.get('nameAr')) updates.nameAr = params.get('name') || params.get('nameAr')!
        if (params.get('nameEn')) updates.nameEn = params.get('nameEn')!
        if (params.get('sku')) updates.sku = params.get('sku')!
        if (params.get('barcode')) updates.barcode = params.get('barcode')!
        if (params.get('price')) updates.sellingPrice = parseFloat(params.get('price')!)
        if (params.get('cost')) updates.purchasePrice = parseFloat(params.get('cost')!)
        if (Object.keys(updates).length > 0) {
          setForm((prev) => ({ ...prev, ...updates }))
          toast({
            title: isAr ? 'تم استخلاص بيانات الصنف من الرابط بنجاح' : 'Product data extracted successfully',
            description: updates.nameAr || updates.sku || trimmed,
          })
          return
        }
      } catch {}
    }

    // 3. Fallback: single code / number
    setForm((prev) => ({
      ...prev,
      sku: prev.sku && prev.sku.trim() !== '' ? prev.sku : trimmed,
      barcode: trimmed,
    }))
    toast({
      title: isAr ? 'تم مسح رمز QR بنجاح' : 'QR code scanned successfully',
      description: trimmed,
    })
  }

  const handleGenerateBarcode = () => {
    if (!form.nameAr.trim()) {
      toast({
        variant: 'destructive',
        title: isAr ? 'يرجى إدخال اسم الصنف أولاً' : 'Please enter product name first',
        description: isAr ? 'يتم إنشاء الباركود بناءً على اسم الصنف وسعر البيع' : 'Barcode is generated based on product name and price',
      })
      const el = document.getElementById('pf-nameAr')
      if (el) el.focus()
      return
    }
    try {
      const knownBarcodes = new Set<string>()
      existingProducts.forEach((p) => {
        if (p.barcode) knownBarcodes.add(p.barcode)
      })
      const generated = generateBarcodeFromNameAndPrice(form.nameAr, form.sellingPrice, knownBarcodes)
      set('barcode', generated)
      toast({
        title: isAr ? 'تم إنشاء كود الباركود بنجاح' : 'Barcode generated successfully',
        description: `${form.nameAr} (${form.sellingPrice ? form.sellingPrice + ' ج.م' : 'بدون سعر'}) → ${generated}`,
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: isAr ? 'تعذر توليد الباركود' : 'Failed to generate barcode',
        description: errMessage(err),
      })
    }
  }

  const handleGenerateQr = () => {
    if (!form.nameAr.trim()) {
      toast({
        variant: 'destructive',
        title: isAr ? 'يرجى إدخال اسم الصنف أولاً' : 'Please enter product name first',
        description: isAr ? 'يتم إنشاء رمز QR بناءً على اسم الصنف وسعر البيع' : 'QR code is generated based on product name and price',
      })
      const el = document.getElementById('pf-nameAr')
      if (el) el.focus()
      return
    }
    try {
      const generated = generateQrFromNameAndPrice(form.nameAr, form.sellingPrice, form.sku)
      set('barcode', generated)
      toast({
        title: isAr ? 'تم إنشاء كود QR بنجاح' : 'QR code generated successfully',
        description: `${form.nameAr} (${form.sellingPrice ? form.sellingPrice + ' ج.م' : 'بدون سعر'}) → ${generated}`,
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: isAr ? 'تعذر توليد كود QR' : 'Failed to generate QR',
        description: errMessage(err),
      })
    }
  }

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm(rowToForm(editing))
      } else {
        const initialSku = computeNextSku(existingProducts)
        setForm({ ...emptyForm(), sku: initialSku })
        api<{ nextSku: string }>('/products/next-sku')
          .then((r) => {
            if (r?.nextSku) {
              setForm((f) => (!f.sku || f.sku.startsWith('SKU-') ? { ...f, sku: r.nextSku } : f))
            }
          })
          .catch(() => {})
      }
      setFormError(null)
    }
  }, [open, editing])

  function set<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function submit() {
    setFormError(null)

    // client-side Arabic validation (server re-validates with zod)
    if (!form.nameAr.trim()) return setFormError('اسم الصنف بالعربية مطلوب')
    if (!form.sku.trim()) return setFormError('الكود الداخلي (SKU) مطلوب')

    const selling = parseNumber(form.sellingPrice, 'سعر البيع', { min: 0 })
    if (typeof selling === 'string') return setFormError(selling)
    const purchase = parseNumber(form.purchasePrice, 'سعر الشراء', { min: 0, max: 10_000_000 })
    if (typeof purchase === 'string') return setFormError(purchase)
    const packSize = parseNumber(form.packSize, 'عدد الوحدات بالعبوة', { min: 1, max: 100_000, int: true })
    if (typeof packSize === 'string') return setFormError(packSize)
    const reorder = parseNumber(form.reorderLevel, 'حد إعادة الطلب', { min: 0, max: 1_000_000, int: true })
    if (typeof reorder === 'string') return setFormError(reorder)
    const tax = parseNumber(form.taxRate, 'نسبة الضريبة', { min: 0, max: 100 })
    if (typeof tax === 'string') return setFormError(tax)

    let initialQty = 0
    if (!editing && form.initialStock.trim() !== '') {
      const parsed = parseNumber(form.initialStock, 'العدد المبدئي الموجود في المخزن', {
        min: 0,
        max: 10_000_000,
        int: !form.isWeighable,
      })
      if (typeof parsed === 'string') return setFormError(parsed)
      initialQty = parsed
    }

    // weighable products should use weight/volume units (advisory)
    if (form.isWeighable && !WEIGHT_UNITS.has(form.unit)) {
      return setFormError('الأصناف التي تُباع بالوزن يجب أن تستخدم وحدة كيلوجرام أو جرام (أو لتر/مللي للسوائل)')
    }

    let minSelling: number | null = null
    if (form.minSellingPrice.trim() !== '') {
      const parsed = parseNumber(form.minSellingPrice, 'أقل سعر بيع', { min: 0, max: 10_000_000 })
      if (typeof parsed === 'string') return setFormError(parsed)
      minSelling = parsed
      if (minSelling > selling) return setFormError('أقل سعر بيع يجب ألا يتجاوز سعر البيع')
    }

    const body: Record<string, unknown> = {
      sku: form.sku.trim(),
      nameAr: form.nameAr.trim(),
      nameEn: form.nameEn.trim() || null,
      genericName: form.genericName.trim() || null,
      barcode: form.barcode.trim() || null,
      categoryId: form.categoryId !== 'none' ? form.categoryId : null,
      manufacturer: form.manufacturer.trim() || null,
      unit: form.unit,
      packSize,
      isWeighable: form.isWeighable,
      purchasePrice: purchase,
      sellingPrice: selling,
      minSellingPrice: minSelling,
      taxRate: tax,
      reorderLevel: reorder,
      initialStock: !editing && initialQty > 0 ? initialQty : 0,
      active: form.active,
      notes: form.notes.trim() || null,
    }

    setSaving(true)
    try {
      if (editing) {
        await api(`/products/${editing.id}`, { method: 'PUT', body })
        toast({ title: 'تم حفظ التعديلات', description: form.nameAr })
      } else {
        await api('/products', { method: 'POST', body })
        toast({ title: 'تمت إضافة الصنف', description: form.nameAr })
      }
      onSaved()
    } catch (e) {
      const message = errMessage(e)
      setFormError(message)
      toast({ variant: 'destructive', title: editing ? 'تعذر حفظ التعديلات' : 'تعذرت إضافة الصنف', description: message })
    } finally {
      setSaving(false)
    }
  }

  const numInputCls = 'qx-num tabular-nums'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto qx-scroll sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editing ? t('products.edit') : t('products.add')}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'عدّل بيانات الصنف — الحقول الفارغة تُحفظ كما هي دون تغيير.'
              : 'أدخل بيانات الصنف الجديد. الكود الداخلي وسعر البيع حقلان مطلوبان.'}
          </DialogDescription>
        </DialogHeader>

        {formError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pf-nameAr">{t('products.name')} *</Label>
            <Input
              id="pf-nameAr"
              value={form.nameAr}
              onChange={(e) => set('nameAr', e.target.value)}
              placeholder="مثال: أرز مصري فاخر ٥ كجم"
              dir="auto"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-nameEn">
              {t('products.nameEn')} <span className="text-muted-foreground">({t('app.optional')})</span>
            </Label>
            <Input id="pf-nameEn" value={form.nameEn} onChange={(e) => set('nameEn', e.target.value)} dir="ltr" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pf-generic">
              {t('products.generic')} <span className="text-muted-foreground">({t('app.optional')})</span>
            </Label>
            <Input
              id="pf-generic"
              value={form.genericName}
              onChange={(e) => set('genericName', e.target.value)}
              placeholder="النوع / التفصيل — مثل: فاخر"
              dir="auto"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-sku">{t('products.sku')} *</Label>
            <div className="flex items-center gap-2">
              <Input
                id="pf-sku"
                value={form.sku}
                onChange={(e) => set('sku', e.target.value)}
                placeholder="SKU-0001"
                className="font-mono flex-1 h-11"
                dir="ltr"
                disabled={!canMutate}
              />
              <button
                type="button"
                onClick={handleAutoSku}
                disabled={!canMutate}
                aria-label={isAr ? 'توليد كود SKU تلقائي' : 'Auto-fill SKU code'}
                title={isAr ? 'توليد كود SKU تلقائي' : 'Auto-fill SKU code'}
                className="btn-barcode-generate h-11 w-11 rounded-xl shrink-0 cursor-pointer"
              >
                <Barcode className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                disabled={!canMutate}
                aria-label={isAr ? 'قراءة QR من المنتج واستخلاص البيانات' : 'Scan QR & Extract Data'}
                title={isAr ? 'قراءة QR من المنتج واستخلاص البيانات' : 'Scan QR & Extract Data'}
                className="btn-barcode-scan h-11 w-11 rounded-xl shrink-0 cursor-pointer"
              >
                <QrCode className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-barcode">
              {t('products.barcode')} <span className="text-muted-foreground">({t('app.optional')})</span>
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="pf-barcode"
                value={form.barcode}
                onChange={(e) => set('barcode', e.target.value)}
                placeholder="6221048100015"
                className="font-mono flex-1 h-11"
                inputMode="numeric"
                dir="ltr"
                disabled={!canMutate}
              />
              <button
                type="button"
                onClick={handleGenerateBarcode}
                disabled={!canMutate}
                aria-label={isAr ? 'توليد كود عشوائي' : 'Generate Random Barcode'}
                title={isAr ? 'توليد كود عشوائي' : 'Generate Random Barcode'}
                className="btn-barcode-generate h-11 w-11 rounded-xl shrink-0 cursor-pointer"
              >
                <Barcode className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={handleGenerateQr}
                disabled={!canMutate}
                aria-label={isAr ? 'إنشاء كود QR مبني على اسم الصنف والسعر' : 'Generate QR Code based on Name & Price'}
                title={isAr ? 'إنشاء كود QR مبني على اسم الصنف والسعر' : 'Generate QR Code based on Name & Price'}
                className="btn-barcode-scan h-11 w-11 rounded-xl shrink-0 cursor-pointer"
              >
                <QrCode className="h-5 w-5" />
              </button>
            </div>
            {form.barcode && form.barcode.trim() !== '' && (
              <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground">
                <div className="overflow-hidden flex items-center max-h-7">
                  <BarcodeSvg value={form.barcode.trim()} height={26} showText={false} />
                </div>
                <span className="font-mono text-[11px] font-semibold text-foreground tracking-wider" dir="ltr">
                  {form.barcode.trim()}
                </span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>{t('products.category')}</Label>
              <Select value={form.categoryId} onValueChange={(v) => set('categoryId', v)}>
                <SelectTrigger aria-label={t('products.category')}>
                  <SelectValue placeholder={t('products.category')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون تصنيف</SelectItem>
                  {(categories ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nameAr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('products.unit')}</Label>
              <Select value={form.unit} onValueChange={(v) => set('unit', v)}>
                <SelectTrigger aria-label={t('products.unit')}>
                  <SelectValue placeholder={t('products.unit')} />
                </SelectTrigger>
                <SelectContent>
                  {unitOptions.map((u) => (
                    <SelectItem key={u} value={u}>
                      {unitLabel(u, lang)}
                    </SelectItem>
                  ))}
                  {!unitOptions.includes(form.unit) && form.unit && (
                    <SelectItem value={form.unit}>{form.unit}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* weighable (sold by weight) */}
          <div className="space-y-1.5">
            <Label>{t('products.weighable')}</Label>
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                const next = !form.isWeighable
                set('isWeighable', next)
                if (next && form.unit === 'piece') set('unit', 'kg')
                else if (!next && (form.unit === 'kg' || form.unit === 'g')) set('unit', 'piece')
              }}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault()
                  const next = !form.isWeighable
                  set('isWeighable', next)
                  if (next && form.unit === 'piece') set('unit', 'kg')
                  else if (!next && (form.unit === 'kg' || form.unit === 'g')) set('unit', 'piece')
                }
              }}
              className={
                'flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border p-3 text-start transition cursor-pointer select-none sm:min-h-[38px] ' +
                (form.isWeighable ? 'border-primary/50 bg-primary/10' : 'bg-muted/30 hover:bg-muted/50')
              }
            >
              <span className="text-sm font-medium">
                {form.isWeighable ? 'نعم — كميات كسرية في نقطة البيع' : 'لا — كميات صحيحة'}
              </span>
              <Switch
                checked={form.isWeighable}
                onCheckedChange={(v) => {
                  set('isWeighable', v)
                  if (v && form.unit === 'piece') set('unit', 'kg')
                  else if (!v && (form.unit === 'kg' || form.unit === 'g')) set('unit', 'piece')
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            {form.isWeighable && (
              <p className="text-[11px] text-muted-foreground">{t('products.weighableHint')}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-packSize">{t('products.packSize')}</Label>
            <Input
              id="pf-packSize"
              value={form.packSize}
              onChange={(e) => set('packSize', e.target.value)}
              className={numInputCls}
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-reorder">
              {t('products.reorderLevel')}{' '}
              <span className="text-[11px] font-normal text-muted-foreground">
                ({isAr ? 'إشعار بأن هذا الصنف انخفض من المخزون' : 'alert when stock is low'})
              </span>
            </Label>
            <Input
              id="pf-reorder"
              value={form.reorderLevel}
              onChange={(e) => set('reorderLevel', e.target.value)}
              className={numInputCls}
              inputMode="numeric"
            />
          </div>
          {!editing && (
            <div className="space-y-1.5">
              <Label htmlFor="pf-initialStock">
                {isAr ? 'العدد المبدئي الموجود في المخزن' : 'Initial Stock Quantity'}{' '}
                <span className="text-muted-foreground">({t('app.optional')})</span>
              </Label>
              <Input
                id="pf-initialStock"
                value={form.initialStock}
                onChange={(e) => set('initialStock', e.target.value)}
                placeholder="0"
                className={numInputCls}
                inputMode={form.isWeighable ? 'decimal' : 'numeric'}
                disabled={!canMutate}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="pf-purchase">{t('products.purchasePrice')}</Label>
            <Input
              id="pf-purchase"
              value={form.purchasePrice}
              onChange={(e) => set('purchasePrice', e.target.value)}
              className={numInputCls}
              inputMode="decimal"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-selling">{t('products.sellingPrice')} *</Label>
            <Input
              id="pf-selling"
              value={form.sellingPrice}
              onChange={(e) => set('sellingPrice', e.target.value)}
              className={numInputCls}
              inputMode="decimal"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-tax">{t('products.taxRate')}</Label>
            <Input id="pf-tax" value={form.taxRate} onChange={(e) => set('taxRate', e.target.value)} className={numInputCls} inputMode="decimal" />
          </div>
          <div className="flex items-center justify-between rounded-xl border px-3 py-2.5 sm:col-span-2">
            <div>
              <Label htmlFor="pf-active" className="cursor-pointer">
                {t('app.status')}
              </Label>
              <p className="text-[11px] text-muted-foreground">{form.active ? t('app.active') : t('app.inactive')}</p>
            </div>
            <Switch id="pf-active" checked={form.active} onCheckedChange={(v) => set('active', v)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pf-notes">
              {t('app.notes')} <span className="text-muted-foreground">({t('app.optional')})</span>
            </Label>
            <Textarea id="pf-notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} dir="auto" />
          </div>
        </div>

                <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('app.cancel')}
          </Button>
          <Button onClick={() => void submit()} disabled={saving || !canMutate}>
            {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t('app.save')}
          </Button>
        </DialogFooter>
      </DialogContent>

      <BarcodeScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleQrExtracted}
        currentProductId={editing?.id}
        existingProducts={existingProducts}
        onOpenExistingProduct={(dupId) => {
          setScannerOpen(false)
          if (onOpenProduct) onOpenProduct(dupId)
        }}
      />

      <ConfirmDialog
        open={overwriteConfirmOpen}
        onOpenChange={setOverwriteConfirmOpen}
        title={isAr ? 'استبدال الباركود الحالي؟' : 'Replace current barcode?'}
        description={
          isAr
            ? `الحقل يحتوي حالياً على الباركود "${form.barcode}". هل تريد استبداله بكود عشوائي جديد؟`
            : `The barcode field currently contains "${form.barcode}". Do you want to replace it with a newly generated code?`
        }
        confirmLabel={isAr ? 'استبدال وتوليد كود جديد' : 'Replace & Generate'}
        cancelLabel={isAr ? 'إلغاء' : 'Cancel'}
        destructive={false}
        onConfirm={() => {
          setOverwriteConfirmOpen(false)
          executeBarcodeGeneration()
        }}
      />
    </Dialog>
  )
}
