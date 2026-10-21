'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Roles & permissions screen (ROLE_VIEW / ROLE_MANAGE)
// Permission matrix editor with Arabic labels for all 33 permissions.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLibraryStore } from '../store'
import { api, errMessage } from '../api'
import { PageHeader, SectionCard, ConfirmDialog } from '../parts/kit'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { ShieldCheck, Plus, Pencil, Trash2, Loader2, Users2, Lock, RefreshCw } from 'lucide-react'

interface RoleItem {
  id: string
  key: string
  nameAr: string
  nameEn: string
  description: string
  permissions: string[]
  isSystem: boolean
  usersCount: number
}

// Arabic labels for every permission in the system (33 total)
const PERMISSION_LABELS: Record<string, [string, string]> = {
  DASHBOARD_VIEW: ['عرض لوحة التحكم', 'View dashboard'],
  PRODUCT_VIEW: ['عرض الأصناف', 'View products'],
  PRODUCT_CREATE: ['إضافة صنف', 'Create product'],
  PRODUCT_EDIT: ['تعديل صنف', 'Edit product'],
  PRODUCT_DELETE: ['حذف صنف', 'Delete product'],
  CATEGORY_VIEW: ['عرض التصنيفات', 'View categories'],
  CATEGORY_MANAGE: ['إدارة التصنيفات', 'Manage categories'],
  INVENTORY_VIEW: ['عرض المخزون', 'View inventory'],
  INVENTORY_ADJUST: ['تسوية المخزون', 'Adjust stock'],
  STOCKTAKE_CREATE: ['إنشاء جرد', 'Run stocktake'],
  SALES_VIEW: ['عرض المبيعات', 'View sales'],
  SALES_CREATE: ['إنشاء فاتورة بيع', 'Create sales'],
  SALES_CANCEL: ['إلغاء فاتورة', 'Cancel invoice'],
  SALES_RETURN: ['مرتجعات المبيعات', 'Sales returns'],
  PURCHASE_VIEW: ['عرض المشتريات', 'View purchases'],
  PURCHASE_CREATE: ['إنشاء أمر شراء', 'Create purchase'],
  PURCHASE_RECEIVE: ['استلام مشتريات', 'Receive purchases'],
  SUPPLIER_VIEW: ['عرض الموردين', 'View suppliers'],
  SUPPLIER_MANAGE: ['إدارة الموردين', 'Manage suppliers'],
  CUSTOMER_VIEW: ['عرض العملاء', 'View customers'],
  CUSTOMER_MANAGE: ['إدارة العملاء', 'Manage customers'],
  REPORT_VIEW: ['عرض التقارير', 'View reports'],
  REPORT_EXPORT: ['تصدير التقارير', 'Export reports'],
  USER_VIEW: ['عرض المستخدمين', 'View users'],
  USER_MANAGE: ['إدارة المستخدمين', 'Manage users'],
  ROLE_VIEW: ['عرض الأدوار', 'View roles'],
  ROLE_MANAGE: ['إدارة الأدوار', 'Manage roles'],
  SETTINGS_VIEW: ['عرض الإعدادات', 'View settings'],
  SETTINGS_MANAGE: ['تعديل الإعدادات', 'Manage settings'],
  HARDWARE_MANAGE: ['إدارة الأجهزة', 'Manage hardware'],
  BACKUP_MANAGE: ['النسخ الاحتياطي', 'Manage backups'],
  LICENSE_VIEW: ['عرض الترخيص', 'View license'],
  AUDIT_VIEW: ['عرض سجل التدقيق', 'View audit log'],
}

const PERMISSION_GROUPS: { ar: string; en: string; icon: typeof ShieldCheck; perms: string[] }[] = [
  { ar: 'لوحة التحكم', en: 'Dashboard', icon: ShieldCheck, perms: ['DASHBOARD_VIEW'] },
  {
    ar: 'الأصناف',
    en: 'Products',
    icon: ShieldCheck,
    perms: ['PRODUCT_VIEW', 'PRODUCT_CREATE', 'PRODUCT_EDIT', 'PRODUCT_DELETE', 'CATEGORY_VIEW', 'CATEGORY_MANAGE'],
  },
  { ar: 'المخزون', en: 'Inventory', icon: ShieldCheck, perms: ['INVENTORY_VIEW', 'INVENTORY_ADJUST', 'STOCKTAKE_CREATE'] },
  { ar: 'المبيعات', en: 'Sales', icon: ShieldCheck, perms: ['SALES_VIEW', 'SALES_CREATE', 'SALES_CANCEL', 'SALES_RETURN'] },
  {
    ar: 'المشتريات والموردين',
    en: 'Purchasing',
    icon: ShieldCheck,
    perms: ['PURCHASE_VIEW', 'PURCHASE_CREATE', 'PURCHASE_RECEIVE', 'SUPPLIER_VIEW', 'SUPPLIER_MANAGE'],
  },
  { ar: 'العملاء', en: 'Customers', icon: ShieldCheck, perms: ['CUSTOMER_VIEW', 'CUSTOMER_MANAGE'] },
  { ar: 'التقارير', en: 'Reports', icon: ShieldCheck, perms: ['REPORT_VIEW', 'REPORT_EXPORT'] },
  { ar: 'الإدارة', en: 'Administration', icon: ShieldCheck, perms: ['USER_VIEW', 'USER_MANAGE', 'ROLE_VIEW', 'ROLE_MANAGE', 'AUDIT_VIEW'] },
  {
    ar: 'النظام',
    en: 'System',
    icon: ShieldCheck,
    perms: ['SETTINGS_VIEW', 'SETTINGS_MANAGE', 'HARDWARE_MANAGE', 'BACKUP_MANAGE', 'LICENSE_VIEW'],
  },
]

export function RolesScreen() {
  const t = useLibraryStore((s) => s.t)
  const lang = useLibraryStore((s) => s.lang)
  const has = useLibraryStore((s) => s.has)
  const { toast } = useToast()

  const L = useCallback((ar: string, en: string) => (lang === 'ar' ? ar : en), [lang])
  const canManage = has('ROLE_MANAGE')

  const [roles, setRoles] = useState<RoleItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<RoleItem | null>(null)
  const [form, setForm] = useState({ key: '', nameAr: '', nameEn: '', description: '' })
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<RoleItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api<{ items: RoleItem[] }>('/roles')
      setRoles(Array.isArray(res) ? res : (res?.items ?? []))
    } catch (e) {
      setError(errMessage(e))
      setRoles(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setForm({ key: '', nameAr: '', nameEn: '', description: '' })
    setSelected(['DASHBOARD_VIEW'])
    setDialogOpen(true)
  }

  function openEdit(r: RoleItem) {
    setEditing(r)
    setForm({ key: r.key, nameAr: r.nameAr, nameEn: r.nameEn === r.nameAr ? '' : r.nameEn, description: r.description })
    setSelected([...r.permissions])
    setDialogOpen(true)
  }

  function togglePermission(p: string) {
    setSelected((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  }

  function toggleGroup(perms: string[]) {
    const allOn = perms.every((p) => selected.includes(p))
    setSelected((prev) => (allOn ? prev.filter((p) => !perms.includes(p)) : [...new Set([...prev, ...perms])]))
  }

  async function save() {
    if (!form.nameAr.trim() || (!editing && !form.key.trim()) || selected.length === 0) {
      toast({
        variant: 'destructive',
        title: L('بيانات ناقصة', 'Missing fields'),
        description: L('أدخل مفتاح الدور واسمه بالعربية واختر صلاحية واحدة على الأقل', 'Enter role key, Arabic name and at least one permission'),
      })
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await api(`/roles/${editing.id}`, {
          method: 'PUT',
          body: {
            nameAr: form.nameAr.trim(),
            nameEn: form.nameEn.trim() || undefined,
            description: form.description.trim() || undefined,
            permissions: selected,
          },
        })
        toast({ title: L('تم حفظ الدور', 'Role saved'), description: form.nameAr })
      } else {
        await api('/roles', {
          method: 'POST',
          body: {
            key: form.key.trim().toLowerCase(),
            nameAr: form.nameAr.trim(),
            nameEn: form.nameEn.trim() || undefined,
            description: form.description.trim() || undefined,
            permissions: selected,
          },
        })
        toast({ title: L('تم إنشاء الدور', 'Role created'), description: form.nameAr })
      }
      setDialogOpen(false)
      await load()
    } catch (e) {
      toast({ variant: 'destructive', title: L('تعذر الحفظ', 'Save failed'), description: errMessage(e) })
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api(`/roles/${deleteTarget.id}`, { method: 'DELETE' })
      toast({ title: L('تم حذف الدور', 'Role deleted'), description: deleteTarget.nameAr })
      setDeleteTarget(null)
      await load()
    } catch (e) {
      toast({ variant: 'destructive', title: L('تعذر الحذف', 'Delete failed'), description: errMessage(e) })
    } finally {
      setDeleting(false)
    }
  }

  const grouped = useMemo(() => {
    return PERMISSION_GROUPS.map((g) => ({
      ...g,
      selectedCount: g.perms.filter((p) => selected.includes(p)).length,
    }))
  }, [selected])

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('roles.title')}
        description={L('أدوار النظام والصلاحيات المرتبطة بها', 'System roles and their permission sets')}
        icon={<ShieldCheck className="h-5 w-5" />}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`me-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {t('app.retry')}
            </Button>
            {canManage && (
              <Button onClick={openCreate}>
                <Plus className="me-2 h-4 w-4" />
                {t('roles.add')}
              </Button>
            )}
          </div>
        }
      />

      {editing === null && !dialogOpen && roles && roles.some((r) => r.isSystem) && (
        <p className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-xs text-muted-foreground">
          <Lock className="me-1.5 inline h-3.5 w-3.5 text-primary" />
          {t('roles.systemHint')}
        </p>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl border bg-muted/30" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/5 p-8 text-center">
          <p className="text-sm font-medium">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>
            {t('app.retry')}
          </Button>
        </div>
      ) : !roles || roles.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-semibold">{L('لا توجد أدوار', 'No roles')}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {roles.map((r) => (
            <SectionCard key={r.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-bold">{r.nameAr}</h3>
                    {r.isSystem ? (
                      <Badge variant="outline" className="border-primary/40 bg-primary/10 px-1.5 text-[10px] text-primary">
                        <Lock className="me-1 h-3 w-3" />
                        {t('roles.system')}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        {L('مخصص', 'custom')}
                      </Badge>
                    )}
                  </div>
                  <p dir="ltr" className="mt-1 text-start font-mono text-[11px] text-muted-foreground">
                    {r.key}
                  </p>
                  {r.description && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{r.description}</p>}
                </div>
                {canManage && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => openEdit(r)} aria-label={t('app.edit')}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-[var(--danger)] hover:text-[var(--danger)]"
                      onClick={() => setDeleteTarget(r)}
                      disabled={r.isSystem || r.usersCount > 0}
                      title={r.isSystem ? t('roles.systemHint') : r.usersCount > 0 ? L('الدور مستخدم من مستخدمين — انقلهم أولاً', 'Role assigned to users — reassign them first') : t('app.delete')}
                      aria-label={t('app.delete')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
                <Badge variant="secondary" className="gap-1 text-[11px]">
                  <Users2 className="h-3 w-3" />
                  {r.usersCount} {L('مستخدم', r.usersCount === 1 ? 'user' : 'users')}
                </Badge>
                <Badge variant="secondary" className="text-[11px]">
                  {t('roles.count')}: <span className="tabular-nums">{r.permissions.length}</span> / 33
                </Badge>
                <span className="ms-auto text-[11px] text-muted-foreground">{r.nameEn}</span>
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      {/* role editor dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto qx-scroll">
          <DialogHeader>
            <DialogTitle>{editing ? L(`تعديل الدور: ${editing.nameAr}`, `Edit role: ${editing.nameEn || editing.nameAr}`) : t('roles.add')}</DialogTitle>
            <DialogDescription>
              {editing && editing.isSystem
                ? t('roles.systemHint')
                : L('حدد اسم الدور ثم اضبط مصفوفة الصلاحيات حسب المجموعات', 'Set the role name then configure its permission matrix by group')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="qx-role-key">Key</Label>
                <Input
                  id="qx-role-key"
                  dir="ltr"
                  className="font-mono"
                  value={editing ? editing.key : form.key}
                  onChange={(e) => setForm({ ...form, key: e.target.value })}
                  disabled={!!editing}
                  placeholder="shift-supervisor"
                />
                <p className="text-[11px] text-muted-foreground">
                  {editing ? L('مفتاح الدور غير قابل للتغيير (مستخدمون يرتبطون به)', 'Role key is immutable (users reference it)') : L('أحرف صغيرة وأرقام وشرطات', 'lowercase letters, digits and dashes')}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qx-role-name-ar">{L('الاسم بالعربية', 'Arabic name')} *</Label>
                <Input id="qx-role-name-ar" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} placeholder={L('مشرف وردية', 'Shift supervisor')} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="qx-role-name-en">
                  {L('الاسم بالإنجليزية', 'English name')} <span className="text-muted-foreground">({t('app.optional')})</span>
                </Label>
                <Input id="qx-role-name-en" dir="ltr" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} placeholder="Shift Supervisor" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qx-role-desc">
                  {L('الوصف', 'Description')} <span className="text-muted-foreground">({t('app.optional')})</span>
                </Label>
                <Input id="qx-role-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={L('صلاحيات وردية المساء', 'Evening shift permissions')} />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">{t('roles.permissions')}</p>
                <Badge variant="secondary" className="text-[11px]">
                  <span className="tabular-nums">{selected.length}</span> / 33
                </Badge>
              </div>
              <div className="grid gap-3">
                {grouped.map((g) => (
                  <div key={g.ar} className="rounded-xl border">
                    <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
                      <button
                        type="button"
                        className="flex items-center gap-2 text-sm font-semibold hover:text-primary"
                        onClick={() => toggleGroup(g.perms)}
                      >
                        <g.icon className="h-3.5 w-3.5 text-primary" />
                        {L(g.ar, g.en)}
                        <span className="text-[11px] font-normal text-muted-foreground">
                          (<span className="tabular-nums">{g.selectedCount}</span>/<span className="tabular-nums">{g.perms.length}</span>)
                        </span>
                      </button>
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => toggleGroup(g.perms)}>
                        {g.selectedCount === g.perms.length ? L('إلغاء الكل', 'Clear all') : L('تحديد الكل', 'Select all')}
                      </Button>
                    </div>
                    <div className="grid gap-1 p-2 sm:grid-cols-2">
                      {g.perms.map((p) => {
                        const on = selected.includes(p)
                        const [ar, en] = PERMISSION_LABELS[p] ?? [p, p]
                        return (
                          <label
                            key={p}
                            className={`flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-1.5 transition ${
                              on ? 'border-primary/40 bg-primary/8' : 'border-transparent hover:bg-muted/50'
                            }`}
                          >
                            <span className="flex min-w-0 items-center gap-2 text-xs">
                              <span className={`truncate ${on ? 'text-primary' : 'text-muted-foreground'}`}>{L(ar, en)}</span>
                              <span dir="ltr" className="shrink-0 font-mono text-[9px] text-muted-foreground/60">
                                {p}
                              </span>
                            </span>
                            <Switch checked={on} onCheckedChange={() => togglePermission(p)} aria-label={L(ar, en)} />
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              {t('app.cancel')}
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t('app.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={L(`حذف الدور «${deleteTarget?.nameAr ?? ''}»؟`, `Delete role “${deleteTarget?.nameEn ?? deleteTarget?.nameAr ?? ''}”?`)}
        description={L('يمكن حذف الأدوار المخصصة غير المرتبطة بأي مستخدم فقط.', 'Only custom roles with no assigned users can be deleted.')}
        confirmLabel={t('app.delete')}
        onConfirm={() => void confirmDelete()}
        pending={deleting}
      />
    </div>
  )
}
