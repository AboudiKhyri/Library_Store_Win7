'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Suppliers screen (purchasing partners)
// Owned by module agent 2-a. Paged list + search + add/edit dialog + guarded
// delete (deactivate when purchase history exists).
import { useCallback, useEffect, useState } from 'react'
import { useLibraryStore } from '../store'
import { api, errMessage } from '../api'
import { PageHeader, DataTable, Pagination, ConfirmDialog, PermanentDeleteDialog, StatusBadge, Column } from '../parts/kit'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Building2, Plus, Search, Pencil, Trash2, AlertTriangle, Loader2, Truck } from 'lucide-react'

const PAGE_SIZE = 20

interface SupplierRow {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  active: boolean
  purchasesCount: number
  totalPurchased: number
  totalPaid?: number
  balanceDue?: number
  createdAt: string
}

interface SupplierFormValues {
  name: string
  phone: string
  email: string
  address: string
  notes: string
  active: boolean
}

function emptyForm(): SupplierFormValues {
  return { name: '', phone: '', email: '', address: '', notes: '', active: true }
}

function rowToForm(row: SupplierRow): SupplierFormValues {
  return {
    name: row.name,
    phone: row.phone ?? '',
    email: row.email ?? '',
    address: row.address ?? '',
    notes: row.notes ?? '',
    active: row.active,
  }
}

const PHONE_RE = /^[0-9+\-\s()]{5,25}$/

export function SuppliersScreen() {
  const t = useLibraryStore((s) => s.t)
  const money = useLibraryStore((s) => s.money)
  const has = useLibraryStore((s) => s.has)
  const { toast } = useToast()

  const canManage = has('SUPPLIER_MANAGE')

  const [rows, setRows] = useState<SupplierRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SupplierRow | null>(null)
  const [form, setForm] = useState<SupplierFormValues>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<SupplierRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deletePurchasesOption, setDeletePurchasesOption] = useState(false)

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
    params.set('page', String(page))
    params.set('pageSize', String(PAGE_SIZE))
    api<{ items: SupplierRow[]; total: number }>(`/suppliers?${params.toString()}`)
      .then((d) => {
        setRows(Array.isArray(d) ? d : (d?.items ?? []))
        setTotal(d?.total ?? (Array.isArray(d) ? d.length : (d?.items?.length ?? 0)))
      })
      .catch((e) => {
        setRows(null)
        setError(errMessage(e))
      })
      .finally(() => setLoading(false))
  }, [debounced, page])

  useEffect(() => {
    void load()
  }, [load, reloadKey])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setFormError(null)
    setFormOpen(true)
  }

  function openEdit(row: SupplierRow) {
    setEditing(row)
    setForm(rowToForm(row))
    setFormError(null)
    setFormOpen(true)
  }

  async function submit() {
    setFormError(null)
    if (!form.name.trim()) {
      setFormError('اسم المورد مطلوب')
      return
    }
    const phone = form.phone.trim()
    if (phone && !PHONE_RE.test(phone)) {
      setFormError('رقم الهاتف غير صالح — استخدم أرقاماً فقط مع + و -')
      return
    }
    const email = form.email.trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError('البريد الإلكتروني غير صالح')
      return
    }
    setSaving(true)
    const body = {
      name: form.name.trim(),
      phone: phone || null,
      email: email || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
      active: form.active,
    }
    try {
      if (editing) {
        await api(`/suppliers/${editing.id}`, { method: 'PUT', body })
        toast({ title: 'تم حفظ التعديلات', description: body.name })
      } else {
        await api('/suppliers', { method: 'POST', body })
        toast({ title: 'تمت إضافة المورد', description: body.name })
      }
      setFormOpen(false)
      setEditing(null)
      setReloadKey((k) => k + 1)
    } catch (e) {
      const message = errMessage(e)
      setFormError(message)
      toast({ variant: 'destructive', title: editing ? 'تعذر حفظ التعديلات' : 'تعذرت إضافة المورد', description: message })
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const target = deleteTarget
    try {
      await api<{ deactivated: boolean; forced?: boolean; purchasesDeleted?: boolean }>(
        `/suppliers/${target.id}?force=true&deletePurchases=${deletePurchasesOption}`,
        { method: 'DELETE' }
      )
      if (deletePurchasesOption) {
        toast({ title: 'تم حذف المورد وجميع فواتير الشراء المرتبطة به نهائياً' })
      } else {
        toast({ title: 'تم حذف المورد نهائياً' })
      }
      setDeleteTarget(null)
      setDeletePurchasesOption(false)
      setReloadKey((k) => k + 1)
    } catch (e) {
      toast({ variant: 'destructive', title: 'تعذر الحذف النهائي للمورد', description: errMessage(e) })
    } finally {
      setDeleting(false)
    }
  }

  const columns: Column<SupplierRow>[] = [
    {
      key: 'name',
      header: t('suppliers.name'),
      className: 'min-w-[180px]',
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold">{row.name}</span>
          {row.address && <span className="max-w-xs truncate text-[11px] text-muted-foreground">{row.address}</span>}
        </div>
      ),
    },
    {
      key: 'phone',
      header: t('suppliers.phone'),
      render: (row) =>
        row.phone ? (
          <span className="font-mono text-xs tabular-nums" dir="ltr">
            {row.phone}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'email',
      header: t('suppliers.email'),
      render: (row) =>
        row.email ? (
          <span className="font-mono text-xs" dir="ltr">
            {row.email}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'purchasesCount',
      header: 'عدد فواتير الشراء',
      render: (row) => (
        <span className="inline-flex items-center gap-1 font-bold tabular-nums">
          <Truck className="h-3.5 w-3.5 text-muted-foreground" />
          {row.purchasesCount}
        </span>
      ),
    },
    {
      key: 'totalPurchased',
      header: 'إجمالي المشتريات',
      render: (row) => <span className="font-bold tabular-nums">{money(row.totalPurchased)}</span>,
    },
    {
      key: 'balanceDue',
      header: 'المتبقي للمورد',
      render: (row) =>
        (row.balanceDue ?? 0) > 0 ? (
          <span className="font-bold tabular-nums text-[var(--danger)]">
            {money(row.balanceDue ?? 0)}
          </span>
        ) : (
          <span className="text-xs font-medium text-[var(--success)]">خالص (٠)</span>
        ),
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
      render: (row) =>
        canManage ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => openEdit(row)}
              aria-label={t('app.edit')}
              title={t('app.edit')}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-[var(--danger)] hover:text-[var(--danger)]"
              onClick={() => {
                setDeleteTarget(row)
                setDeletePurchasesOption(false)
              }}
              aria-label="تأكيد الحذف النهائي"
              title="تأكيد الحذف النهائي"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title={t('suppliers.title')}
        description="موردو البضائع والسلع الغذائية — إجماليات الشراء تحسب من الفواتير غير الملغاة"
        icon={<Building2 className="h-5 w-5" />}
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus className="me-2 h-4 w-4" />
              {t('suppliers.add')}
            </Button>
          ) : undefined
        }
      />

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`${t('app.search')} (الاسم / الهاتف / البريد)`}
          className="ps-8"
          aria-label={t('app.search')}
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows ?? undefined}
        loading={loading}
        error={error ?? undefined}
        onRetry={() => load()}
        emptyTitle={debounced ? 'لا يوجد موردون مطابقون' : t('suppliers.emptyTitle')}
        emptyHint={
          debounced ? 'جرّب كلمة بحث مختلفة.' : 'أضف أول مورد لتبدأ تسجيل فواتير الشراء واستلام الباتشات.'
        }
        emptyAction={
          !debounced && canManage ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="me-2 h-4 w-4" />
              أضف أول مورد
            </Button>
          ) : undefined
        }
      />

      {rows && rows.length > 0 && (
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
      )}

      {/* add / edit dialog */}
      <Dialog
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v)
          if (!v) setEditing(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'تعديل المورد' : t('suppliers.add')}</DialogTitle>
            <DialogDescription>
              {editing ? 'عدّل بيانات المورد — البيانات التاريخية للفواتير لا تتأثر.' : 'أدخل اسم المورد (مطلوب) ووسائل التواصل.'}
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="sup-name">{t('suppliers.name')} *</Label>
              <Input
                id="sup-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="مثال: شركة النيل لتوزيع المواد الغذائية"
                dir="auto"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sup-phone">{t('suppliers.phone')}</Label>
              <Input
                id="sup-phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="0223456789"
                className="font-mono tabular-nums"
                inputMode="tel"
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sup-email">{t('suppliers.email')}</Label>
              <Input
                id="sup-email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="sales@supplier.com"
                className="font-mono"
                inputMode="email"
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="sup-address">{t('suppliers.address')}</Label>
              <Input
                id="sup-address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                dir="auto"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="sup-notes">{t('app.notes')}</Label>
              <Textarea
                id="sup-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                dir="auto"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border px-3 py-2.5 sm:col-span-2">
              <div>
                <Label htmlFor="sup-active" className="cursor-pointer">
                  {t('app.status')}
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  {form.active ? t('app.active') : t('app.inactive')}
                </p>
              </div>
              <Switch
                id="sup-active"
                checked={form.active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setFormOpen(false)
                setEditing(null)
              }}
              disabled={saving}
            >
              {t('app.cancel')}
            </Button>
            <Button onClick={() => void submit()} disabled={saving}>
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t('app.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* permanent delete dialog */}
      <PermanentDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(v) => {
          if (!v) {
            setDeleteTarget(null)
            setDeletePurchasesOption(false)
          }
        }}
        itemName={deleteTarget?.name ?? ''}
        warningDescription="المورد قد يكون مرتبطاً بسجلات سابقة (فواتير شراء أو باتشات مخزون). الحذف النهائي سيزيل المورد وجميع سجلاته نهائياً من قاعدة البيانات."
        checkboxLabel="حذف الفواتير المرتبطة بهذا المورد"
        checkboxHint="عند تفعيل هذا الخيار، سيتم حذف جميع فواتير الشراء المسجلة باسم هذا المورد بالكامل."
        deleteRelatedOption={deletePurchasesOption}
        onDeleteRelatedOptionChange={setDeletePurchasesOption}
        isDeleting={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          setDeleteTarget(null)
          setDeletePurchasesOption(false)
        }}
      />
    </div>
  )
}
