'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Customers screen (sales ledger contacts)
// Owned by module agent 2-a. Paged list + search + add/edit dialog + guarded
// delete (deactivate when sales history exists).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLibraryStore } from '../store'
import { api, errMessage } from '../api'
import { PageHeader, DataTable, Pagination, ConfirmDialog, PermanentDeleteDialog, StatusBadge, Column } from '../parts/kit'
import { LoyaltyTierBadge } from '../parts/loyalty-tier'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Users, Plus, Search, Pencil, Trash2, AlertTriangle, Loader2, Receipt, Sparkles, ArrowUpDown, ArrowDown, ArrowUp,
} from 'lucide-react'

const PAGE_SIZE = 20

interface LoyaltyEventRow {
  id: string
  type: string
  points: number
  value: number
  note: string | null
  createdAt: string
}

interface LoyaltyPayload {
  customer: { id: string; name: string; phone: string | null }
  balance: number
  pointValueEgp: number
  balanceValueEgp: number
  events: LoyaltyEventRow[]
}

interface CustomerRow {
  loyaltyBalance?: number
  loyaltyLifetime?: number
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  active: boolean
  salesCount: number
  totalSpent: number
  createdAt: string
}

interface CustomerFormValues {
  name: string
  phone: string
  email: string
  address: string
  notes: string
  active: boolean
}

function emptyForm(): CustomerFormValues {
  return { name: '', phone: '', email: '', address: '', notes: '', active: true }
}

function rowToForm(row: CustomerRow): CustomerFormValues {
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

export function CustomersScreen() {
  const t = useLibraryStore((s) => s.t)
  const money = useLibraryStore((s) => s.money)
  const has = useLibraryStore((s) => s.has)
  const status = useLibraryStore((s) => s.status)
  // loyalty UI only when the module is licensed in the artifact entitlements
  const loyaltyModule = !!status?.modules.loyalty
  const { toast } = useToast()

  const canManage = has('CUSTOMER_MANAGE')

  const [rows, setRows] = useState<CustomerRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [sortKey, setSortKey] = useState<'name' | 'salesCount' | 'totalSpent' | 'loyaltyBalance'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerRow | null>(null)
  const [form, setForm] = useState<CustomerFormValues>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<CustomerRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteSalesOption, setDeleteSalesOption] = useState(false)

  // ---- loyalty dialog ----
  const [loyaltyOpen, setLoyaltyOpen] = useState(false)
  const [loyaltyTarget, setLoyaltyTarget] = useState<CustomerRow | null>(null)
  const [loyaltyData, setLoyaltyData] = useState<LoyaltyPayload | null>(null)
  const [loyaltyLoading, setLoyaltyLoading] = useState(false)
  const [adjustPts, setAdjustPts] = useState('')
  const [adjustNote, setAdjustNote] = useState('')
  const [adjustBusy, setAdjustBusy] = useState(false)

  function openLoyalty(row: CustomerRow) {
    setLoyaltyTarget(row)
    setLoyaltyOpen(true)
    setLoyaltyData(null)
    setAdjustPts('')
    setAdjustNote('')
    setLoyaltyLoading(true)
    api<LoyaltyPayload>(`/loyalty/${row.id}`)
      .then((r) => setLoyaltyData(r))
      .catch(() => setLoyaltyData(null))
      .finally(() => setLoyaltyLoading(false))
  }

  async function submitAdjust() {
    if (!loyaltyTarget) return
    const pts = parseInt(adjustPts, 10)
    if (!Number.isFinite(pts) || pts === 0) {
      toast({ variant: 'destructive', title: 'أدخل عدد نقاط صحيحاً غير صفري' })
      return
    }
    setAdjustBusy(true)
    try {
      const r = await api<{ balance: number }>('/loyalty/adjust', {
        method: 'POST',
        body: { customerId: loyaltyTarget.id, points: pts, note: adjustNote.trim() || undefined },
      })
      toast({ title: 'تم تعديل الرصيد', description: `الرصيد الآن ${r.balance} نقطة` })
      setAdjustPts('')
      setAdjustNote('')
      // reload profile
      setLoyaltyLoading(true)
      api<LoyaltyPayload>(`/loyalty/${loyaltyTarget.id}`)
        .then((rr) => setLoyaltyData(rr))
        .finally(() => setLoyaltyLoading(false))
    } catch (e) {
      toast({ variant: 'destructive', title: 'تعذر التعديل', description: errMessage(e) })
    } finally {
      setAdjustBusy(false)
    }
  }

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
    api<{ items: CustomerRow[]; total: number }>(`/customers?${params.toString()}`)
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

  function toggleSort(key: 'name' | 'salesCount' | 'totalSpent' | 'loyaltyBalance') {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  const sortedRows = useMemo(() => {
    if (!rows) return rows
    const arr = [...rows]
    arr.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name, 'ar')
      else cmp = (a[sortKey] ?? 0) - (b[sortKey] ?? 0)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [rows, sortKey, sortDir])


  function SortHeader({ label, field }: { label: string; field: 'name' | 'salesCount' | 'totalSpent' | 'loyaltyBalance' }) {
    const active = sortKey === field
    const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown
    return (
      <button
        type="button"
        onClick={() => toggleSort(field)}
        className="inline-flex items-center gap-1 text-start font-medium transition hover:text-primary"
        title={active ? (sortDir === 'asc' ? 'ترتيب تنازلي' : 'ترتيب تصاعدي') : 'ترتيب حسب هذا العمود'}
      >
        {label}
        <Icon className={`h-3 w-3 ${active ? 'text-primary' : 'opacity-40'}`} />
      </button>
    )
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setFormError(null)
    setFormOpen(true)
  }

  function openEdit(row: CustomerRow) {
    setEditing(row)
    setForm(rowToForm(row))
    setFormError(null)
    setFormOpen(true)
  }

  async function submit() {
    setFormError(null)
    if (!form.name.trim()) {
      setFormError('اسم العميل مطلوب')
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
        await api(`/customers/${editing.id}`, { method: 'PUT', body })
        toast({ title: 'تم حفظ التعديلات', description: body.name })
      } else {
        await api('/customers', { method: 'POST', body })
        toast({ title: 'تمت إضافة العميل', description: body.name })
      }
      setFormOpen(false)
      setEditing(null)
      setReloadKey((k) => k + 1)
    } catch (e) {
      const message = errMessage(e)
      setFormError(message)
      toast({ variant: 'destructive', title: editing ? 'تعذر حفظ التعديلات' : 'تعذرت إضافة العميل', description: message })
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const target = deleteTarget
    try {
      await api<{ deactivated: boolean; forced?: boolean }>(
        `/customers/${target.id}?force=true&deleteSales=${deleteSalesOption}`,
        { method: 'DELETE' }
      )
      if (deleteSalesOption) {
        toast({ title: 'تم حذف العميل وكافة الفواتير وحركات النقاط المرتبطة به نهائياً' })
      } else {
        toast({ title: 'تم حذف العميل نهائياً' })
      }
      setDeleteTarget(null)
      setDeleteSalesOption(false)
      setReloadKey((k) => k + 1)
    } catch (e) {
      toast({ variant: 'destructive', title: 'تعذر الحذف النهائي للعميل', description: errMessage(e) })
    } finally {
      setDeleting(false)
    }
  }

  const columns: Column<CustomerRow>[] = [
    {
      key: 'name',
      header: <SortHeader label={t('customers.name')} field="name" />,
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
      header: t('customers.phone'),
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
      key: 'salesCount',
      header: <SortHeader label={t('customers.salesCount')} field="salesCount" />,
      render: (row) => (
        <span className="inline-flex items-center gap-1 font-bold tabular-nums">
          <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
          {row.salesCount}
        </span>
      ),
    },
    {
      key: 'totalSpent',
      header: <SortHeader label={t('customers.totalSpent')} field="totalSpent" />,
      render: (row) => <span className="font-bold tabular-nums">{money(row.totalSpent)}</span>,
    },
    {
      key: 'active',
      header: t('app.status'),
      render: (row) => (
        <StatusBadge status={row.active ? 'ACTIVE' : 'INACTIVE'} label={row.active ? t('app.active') : t('app.inactive')} />
      ),
    },
    ...(loyaltyModule
      ? [
          {
            key: 'loyalty',
            header: <SortHeader label="الولاء" field="loyaltyBalance" />,
            render: (row) => (
              <div className="flex items-center gap-1.5">
                <LoyaltyTierBadge
                  lifetimePoints={row.loyaltyLifetime ?? 0}
                  balance={row.loyaltyBalance ?? 0}
                  compact
                  thresholds={status?.pos?.loyalty}
                />
                <button
                  type="button"
                  onClick={() => openLoyalty(row)}
                  className="inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-primary transition hover:bg-primary/15"
                  title="سجل نقاط الولاء"
                >
                  <Sparkles className="h-3 w-3" />
                  {row.loyaltyBalance ?? 0}
                </button>
              </div>
            ),
          },
        ]
      : []),
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
                setDeleteSalesOption(false)
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
        title={t('customers.title')}
        description="عملاء المتجر — عدد الفواتير وإجمالي المشتريات من المبيعات غير الملغاة"
        icon={<Users className="h-5 w-5" />}
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus className="me-2 h-4 w-4" />
              {t('customers.add')}
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
        rows={sortedRows ?? undefined}
        loading={loading}
        error={error ?? undefined}
        onRetry={() => load()}
        emptyTitle={debounced ? 'لا يوجد عملاء مطابقون' : t('customers.emptyTitle')}
        emptyHint={
          debounced ? 'جرّب كلمة بحث مختلفة.' : 'أضف أول عميل لربط الفواتير به وتتبع مشترياته.'
        }
        emptyAction={
          !debounced && canManage ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="me-2 h-4 w-4" />
              أضف أول عميل
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
            <DialogTitle>{editing ? 'تعديل العميل' : t('customers.add')}</DialogTitle>
            <DialogDescription>
              {editing ? 'عدّل بيانات العميل — الفواتير السابقة لا تتأثر.' : 'أدخل اسم العميل (مطلوب) ورقم الهاتف لربط الفواتير.'}
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
              <Label htmlFor="cust-name">{t('customers.name')} *</Label>
              <Input
                id="cust-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="مثال: أحمد محمود"
                dir="auto"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-phone">{t('customers.phone')}</Label>
              <Input
                id="cust-phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="01012345678"
                className="font-mono tabular-nums"
                inputMode="tel"
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-email">{t('suppliers.email')}</Label>
              <Input
                id="cust-email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="customer@mail.com"
                className="font-mono"
                inputMode="email"
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cust-address">العنوان</Label>
              <Input
                id="cust-address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                dir="auto"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cust-notes">{t('app.notes')}</Label>
              <Textarea
                id="cust-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                dir="auto"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border px-3 py-2.5 sm:col-span-2">
              <div>
                <Label htmlFor="cust-active" className="cursor-pointer">
                  {t('app.status')}
                </Label>
                <p className="text-[11px] text-muted-foreground">{form.active ? t('app.active') : t('app.inactive')}</p>
              </div>
              <Switch
                id="cust-active"
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

      {/* loyalty dialog */}
      <Dialog open={loyaltyOpen} onOpenChange={setLoyaltyOpen}>
        <DialogContent className="qx-scroll max-h-[88vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              نقاط الولاء — {loyaltyTarget?.name ?? ''}
              {loyaltyData && (
                <LoyaltyTierBadge
                  lifetimePoints={loyaltyTarget?.loyaltyLifetime ?? 0}
                  balance={loyaltyData.balance}
                  thresholds={status?.pos?.loyalty}
                />
              )}
            </DialogTitle>
            <DialogDescription>
              رصيد مشتق من سجل نقاط غير قابل للتعديل (إضافة فقط) — كل حدث موثق بالمستخدم والوقت
            </DialogDescription>
          </DialogHeader>

          {loyaltyLoading || !loyaltyData ? (
            <div className="flex flex-col items-center gap-3 py-10" role="status" aria-busy="true">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">جارٍ تحميل سجل النقاط...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-primary/25 bg-primary/10 p-3 text-center">
                  <p className="text-[11px] text-muted-foreground">الرصيد الحالي</p>
                  <p className="mt-1 text-2xl font-black tabular-nums text-primary">{loyaltyData.balance}</p>
                  <p className="text-[10px] text-muted-foreground">نقطة</p>
                </div>
                <div className="rounded-xl border p-3 text-center">
                  <p className="text-[11px] text-muted-foreground">قيمة الرصيد</p>
                  <p className="mt-1 text-2xl font-black tabular-nums">{money(loyaltyData.balanceValueEgp)}</p>
                  <p className="text-[10px] text-muted-foreground">قيمة النقطة {loyaltyData.pointValueEgp} ج.م</p>
                </div>
                <div className="col-span-2 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
                  <span>نقاط مكتسبة عبر مدى التعامل:</span>
                  <span className="font-bold tabular-nums text-foreground">{loyaltyTarget?.loyaltyLifetime ?? 0}</span>
                  {(() => {
                    const thresholds = status?.pos?.loyalty
                    const bronze = thresholds?.tierBronze ?? 20
                    const silver = thresholds?.tierSilver ?? 100
                    const gold = thresholds?.tierGold ?? 500
                    const lifetime = loyaltyTarget?.loyaltyLifetime ?? 0
                    const next = lifetime >= gold ? null : lifetime >= silver ? { label: 'الذهبي', at: gold } : lifetime >= bronze ? { label: 'الفضي', at: silver } : { label: 'البرونزي', at: bronze }
                    return next ? (
                      <span className="rounded-full border border-dashed px-2 py-0.5">
                        يتبقى {next.at - lifetime} نقطة لمستوى {next.label}
                      </span>
                    ) : (
                      <span className="rounded-full border border-amber-500/50 bg-amber-500/15 px-2 py-0.5 font-bold text-amber-600 dark:text-amber-400">
                        أعلى مستوى ✓
                      </span>
                    )
                  })()}
                </div>
              </div>

              {canManage && (
                <div className="rounded-xl border bg-muted/30 p-3">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">تسوية يدوية (تُسجل في السجل والتدقيق)</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      dir="ltr"
                      inputMode="numeric"
                      className="qx-num h-9 w-24"
                      placeholder="+10 / -5"
                      value={adjustPts}
                      onChange={(e) => setAdjustPts(e.target.value.replace(/[^0-9-]/g, ''))}
                      aria-label="عدد النقاط"
                    />
                    <Input
                      className="h-9 min-w-40 flex-1"
                      placeholder="سبب التسوية (اختياري)"
                      value={adjustNote}
                      onChange={(e) => setAdjustNote(e.target.value)}
                    />
                    <Button size="sm" onClick={() => void submitAdjust()} disabled={adjustBusy}>
                      {adjustBusy ? <Loader2 className="me-1 h-4 w-4 animate-spin" /> : null}
                      تطبيق
                    </Button>
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-bold text-muted-foreground">سجل الأحداث (آخر ٣٠)</p>
                <div className="qx-scroll max-h-56 overflow-y-auto rounded-lg border">
                  {loyaltyData.events.length === 0 ? (
                    <p className="p-4 text-center text-xs text-muted-foreground">لا توجد أحداث نقاط بعد</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted/95 backdrop-blur">
                        <tr className="text-muted-foreground">
                          <th className="px-2 py-1.5 text-start font-medium">النوع</th>
                          <th className="px-2 py-1.5 text-start font-medium">النقاط</th>
                          <th className="px-2 py-1.5 text-start font-medium">القيمة</th>
                          <th className="px-2 py-1.5 text-start font-medium">ملاحظة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(loyaltyData.events ?? []).map((ev) => (
                          <tr key={ev.id} className="border-t">
                            <td className="px-2 py-1.5">
                              <StatusBadge
                                status={ev.type === 'EARN' ? 'ACTIVE' : ev.type === 'REDEEM' ? 'NEAR' : 'DRAFT'}
                                label={ev.type === 'EARN' ? 'اكتساب' : ev.type === 'REDEEM' ? 'استبدال' : 'تسوية'}
                              />
                            </td>
                            <td className={`px-2 py-1.5 font-bold tabular-nums ${ev.points > 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`} dir="ltr">
                              {ev.points > 0 ? `+${ev.points}` : ev.points}
                            </td>
                            <td className="px-2 py-1.5 tabular-nums">{ev.value > 0 ? money(ev.value) : '—'}</td>
                            <td className="px-2 py-1.5 text-muted-foreground">{ev.note ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
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
        itemName={deleteTarget?.name ?? ''}
        warningDescription="العميل قد يكون مرتبطاً بسجلات سابقة (فواتير مبيعات أو حركات نقاط ولاء). الحذف النهائي سيزيل العميل وجميع سجلاته نهائياً من قاعدة البيانات."
        checkboxLabel="حذف الفواتير المرتبطة بهذا العميل"
        checkboxHint="عند تفعيل هذا الخيار، سيتم حذف جميع فواتير البيع المسجلة باسم هذا العميل بالكامل."
        deleteRelatedOption={deleteSalesOption}
        onDeleteRelatedOptionChange={setDeleteSalesOption}
        isDeleting={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          setDeleteTarget(null)
          setDeleteSalesOption(false)
        }}
      />
    </div>
  )
}
