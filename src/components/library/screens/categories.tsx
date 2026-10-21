'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Categories screen (catalog taxonomy)
// Owned by module agent 2-a. List + add/edit dialog + guarded delete.
import { useCallback, useEffect, useState } from 'react'
import { useLibraryStore } from '../store'
import { api, errMessage } from '../api'
import { PageHeader, DataTable, ConfirmDialog, PermanentDeleteDialog, StatusBadge, Column } from '../parts/kit'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tags, Plus, Search, Pencil, Trash2, AlertTriangle, Loader2, Package } from 'lucide-react'

interface CategoryRow {
  id: string
  nameAr: string
  nameEn: string | null
  description: string | null
  active: boolean
  productsCount: number
  createdAt: string
}

interface CategoryFormValues {
  nameAr: string
  nameEn: string
  description: string
  active: boolean
}

function emptyForm(): CategoryFormValues {
  return { nameAr: '', nameEn: '', description: '', active: true }
}

function rowToForm(row: CategoryRow): CategoryFormValues {
  return { nameAr: row.nameAr, nameEn: row.nameEn ?? '', description: row.description ?? '', active: row.active }
}

export function CategoriesScreen() {
  const t = useLibraryStore((s) => s.t)
  const has = useLibraryStore((s) => s.has)
  const { toast } = useToast()

  const canManage = has('CATEGORY_MANAGE')

  const [rows, setRows] = useState<CategoryRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CategoryRow | null>(null)
  const [form, setForm] = useState<CategoryFormValues>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteProductsOption, setDeleteProductsOption] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(id)
  }, [search])

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (debounced) params.set('q', debounced)
    api<{ items: CategoryRow[] }>(`/categories?${params.toString()}`)
      .then((d) => setRows(Array.isArray(d) ? d : (d?.items ?? [])))
      .catch((e) => {
        setRows(null)
        setError(errMessage(e))
      })
      .finally(() => setLoading(false))
  }, [debounced])

  useEffect(() => {
    void load()
  }, [load, reloadKey])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setFormError(null)
    setFormOpen(true)
  }

  function openEdit(row: CategoryRow) {
    setEditing(row)
    setForm(rowToForm(row))
    setFormError(null)
    setFormOpen(true)
  }

  async function submit() {
    setFormError(null)
    if (!form.nameAr.trim()) {
      setFormError('اسم التصنيف بالعربية مطلوب')
      return
    }
    setSaving(true)
    const body = {
      nameAr: form.nameAr.trim(),
      nameEn: form.nameEn.trim() || null,
      description: form.description.trim() || null,
      active: form.active,
    }
    try {
      if (editing) {
        await api(`/categories/${editing.id}`, { method: 'PUT', body })
        toast({ title: 'تم حفظ التعديلات', description: body.nameAr })
      } else {
        await api('/categories', { method: 'POST', body })
        toast({ title: 'تمت إضافة التصنيف', description: body.nameAr })
      }
      setFormOpen(false)
      setEditing(null)
      setReloadKey((k) => k + 1)
    } catch (e) {
      const message = errMessage(e)
      setFormError(message)
      toast({ variant: 'destructive', title: editing ? 'تعذر حفظ التعديلات' : 'تعذرت إضافة التصنيف', description: message })
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const target = deleteTarget
    try {
      await api<{ deleted: boolean; forced?: boolean; productsDeleted?: boolean }>(
        `/categories/${target.id}?force=true&deleteProducts=${deleteProductsOption}`,
        { method: 'DELETE' }
      )
      if (deleteProductsOption) {
        toast({ title: 'تم حذف التصنيف وجميع الأصناف المرتبطة به نهائياً' })
      } else {
        toast({ title: 'تم حذف التصنيف وفك ارتباط الأصناف التابعة له' })
      }
      setDeleteTarget(null)
      setDeleteProductsOption(false)
      setReloadKey((k) => k + 1)
    } catch (e) {
      toast({ variant: 'destructive', title: 'تعذر الحذف النهائي للتصنيف', description: errMessage(e) })
    } finally {
      setDeleting(false)
    }
  }

  const columns: Column<CategoryRow>[] = [
    {
      key: 'name',
      header: t('categories.name'),
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold">{row.nameAr}</span>
          {row.nameEn && (
            <span className="text-xs text-muted-foreground" dir="ltr">
              {row.nameEn}
            </span>
          )}
          {row.description && <span className="max-w-md truncate text-[11px] text-muted-foreground">{row.description}</span>}
        </div>
      ),
    },
    {
      key: 'productsCount',
      header: t('categories.productsCount'),
      render: (row) => (
        <span className="inline-flex items-center gap-1 font-bold tabular-nums">
          <Package className="h-3.5 w-3.5 text-muted-foreground" />
          {row.productsCount}
        </span>
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
                setDeleteProductsOption(false)
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
        title={t('categories.title')}
        description="تصنيفات الأصناف — تنظّم الكتالوج وتظهر في التقارير ونقطة البيع"
        icon={<Tags className="h-5 w-5" />}
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus className="me-2 h-4 w-4" />
              {t('categories.add')}
            </Button>
          ) : undefined
        }
      />

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`${t('app.search')} (${t('categories.name')} / EN)`}
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
        emptyTitle={debounced ? 'لا توجد تصنيفات مطابقة' : t('categories.emptyTitle')}
        emptyHint={
          debounced
            ? 'جرّب كلمة بحث مختلفة.'
            : 'أنشئ أول تصنيف لتنظيم أصناف المتجر (بقالة، مواد غذائية، مشروبات، منظفات...)'
        }
        emptyAction={
          !debounced && canManage ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="me-2 h-4 w-4" />
              أضف أول تصنيف
            </Button>
          ) : undefined
        }
      />

      {/* add / edit dialog */}
      <Dialog
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v)
          if (!v) setEditing(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'تعديل التصنيف' : t('categories.add')}</DialogTitle>
            <DialogDescription>
              {editing ? 'عدّل بيانات التصنيف — التصنيفات مرتبطة بالأصناف والتقارير.' : 'أدخل اسم التصنيف بالعربية (مطلوب) وبالإنجليزية (اختياري).'}
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cat-nameAr">{t('categories.name')} *</Label>
              <Input
                id="cat-nameAr"
                value={form.nameAr}
                onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
                placeholder="مثال: مسكنات وخوافض حرارة"
                dir="auto"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-nameEn">
                {t('categories.nameEn')} <span className="text-muted-foreground">({t('app.optional')})</span>
              </Label>
              <Input
                id="cat-nameEn"
                value={form.nameEn}
                onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))}
                placeholder="Analgesics & Antipyretics"
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-desc">
                {t('app.notes')} <span className="text-muted-foreground">({t('app.optional')})</span>
              </Label>
              <Textarea
                id="cat-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                dir="auto"
              />
            </div>
            <div className={cn('flex items-center justify-between rounded-xl border px-3 py-2.5')}>
              <div>
                <Label htmlFor="cat-active" className="cursor-pointer">
                  {t('app.status')}
                </Label>
                <p className="text-[11px] text-muted-foreground">{form.active ? t('app.active') : t('app.inactive')}</p>
              </div>
              <Switch
                id="cat-active"
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
            setDeleteProductsOption(false)
          }
        }}
        itemName={deleteTarget?.nameAr ?? ''}
        warningDescription="التصنيف قد يكون مرتبطاً بأصناف تابعة له. الحذف النهائي سيزيل التصنيف من قاعدة البيانات."
        checkboxLabel="حذف كافة الأصناف التابعة لهذا التصنيف نهائياً"
        checkboxHint="عند تفعيل هذا الخيار، سيتم حذف جميع الأصناف المسجلة تحت هذا التصنيف، وإلا فسيتم فك ارتباطها لتصبح (بدون تصنيف)."
        deleteRelatedOption={deleteProductsOption}
        onDeleteRelatedOptionChange={setDeleteProductsOption}
        isDeleting={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          setDeleteTarget(null)
          setDeleteProductsOption(false)
        }}
      />
    </div>
  )
}
