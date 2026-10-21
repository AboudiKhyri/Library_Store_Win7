'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Users administration screen (USER_VIEW / USER_MANAGE)
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLibraryStore } from '../store'
import { api, errMessage } from '../api'
import { PageHeader, DataTable, Pagination, Column, ConfirmDialog, StatusBadge } from '../parts/kit'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { UsersRound, UserPlus, Search, Loader2, Pencil, Trash2, ShieldCheck, KeyRound } from 'lucide-react'

interface UserRow {
  id: string
  username: string
  displayName: string
  phone: string | null
  roleKey: string
  roleNameAr: string
  active: boolean
  lastLoginAt: string | null
  createdAt: string
}

interface RoleItem {
  id: string
  key: string
  nameAr: string
  isSystem: boolean
}

const PASSWORD_HINT = '٨ أحرف على الأقل وتحتوي حروفاً وأرقاماً ورمزاً خاصاً (@ # $ ! ...)'

export function UsersScreen() {
  const t = useLibraryStore((s) => s.t)
  const fmtDateTime = useLibraryStore((s) => s.fmtDateTime)
  const lang = useLibraryStore((s) => s.lang)
  const has = useLibraryStore((s) => s.has)
  const session = useLibraryStore((s) => s.session)
  const { toast } = useToast()

  const L = useCallback((ar: string, en: string) => (lang === 'ar' ? ar : en), [lang])
  const canManage = has('USER_MANAGE')
  const myId = session?.id

  const [rows, setRows] = useState<UserRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [rolesError, setRolesError] = useState<string | null>(null)

  // dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [form, setForm] = useState({ username: '', displayName: '', phone: '', roleKey: '', password: '', active: true })
  const [saving, setSaving] = useState(false)

  // delete confirm
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const pageSize = 20

  const load = useCallback(
    async (targetPage = 1, search = q) => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ page: String(targetPage), pageSize: String(pageSize) })
        if (search.trim()) params.set('q', search.trim())
        const res = await api<{ items: UserRow[]; total: number; page: number; pageSize: number }>(`/users?${params.toString()}`)
        setRows(Array.isArray(res) ? res : (res?.items ?? []))
        setTotal(res?.total ?? (Array.isArray(res) ? res.length : (res?.items?.length ?? 0)))
      } catch (e) {
        setError(errMessage(e))
        setRows(null)
      } finally {
        setLoading(false)
      }
    },
    [q]
  )

  const loadRoles = useCallback(async () => {
    try {
      const res = await api<{ items: RoleItem[] }>('/roles')
      setRoles(Array.isArray(res) ? res : (res?.items ?? []))
      setRolesError(null)
    } catch (e) {
      setRolesError(errMessage(e))
    }
  }, [])

  useEffect(() => {
    void load(1)
    void loadRoles()
  }, [load, loadRoles])

  function openCreate() {
    setEditing(null)
    setForm({ username: '', displayName: '', phone: '', roleKey: roles?.[0]?.key ?? 'cashier', password: '', active: true })
    setDialogOpen(true)
  }

  function openEdit(u: UserRow) {
    setEditing(u)
    setForm({ username: u.username, displayName: u.displayName, phone: u.phone ?? '', roleKey: u.roleKey, password: '', active: u.active })
    setDialogOpen(true)
  }

  async function save() {
    if (!form.displayName.trim() || !form.roleKey || (!editing && !form.username)) {
      toast({ variant: 'destructive', title: L('بيانات ناقصة', 'Missing fields'), description: L('أكمل الاسم واسم المستخدم والدور', 'Fill name, username and role') })
      return
    }
    if (!editing && !form.password) {
      toast({ variant: 'destructive', title: L('كلمة المرور مطلوبة', 'Password required'), description: PASSWORD_HINT })
      return
    }
    setSaving(true)
    try {
      if (editing) {
        const body: Record<string, unknown> = {
          displayName: form.displayName.trim(),
          phone: form.phone.trim() || null,
          roleKey: form.roleKey,
          active: form.active,
        }
        if (form.password) body.password = form.password
        await api(`/users/${editing.id}`, { method: 'PUT', body })
        toast({ title: L('تم حفظ التعديلات', 'User updated'), description: `${form.displayName} (${form.username})` })
      } else {
        await api('/users', {
          method: 'POST',
          body: {
            username: form.username.trim().toLowerCase(),
            displayName: form.displayName.trim(),
            phone: form.phone.trim() || undefined,
            roleKey: form.roleKey,
            password: form.password,
          },
        })
        toast({ title: L('تم إنشاء المستخدم', 'User created'), description: `${form.displayName} (${form.username})` })
      }
      setDialogOpen(false)
      await load(editing ? page : 1)
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
      const res = await api<{ deactivated: boolean; salesCount?: number }>(`/users/${deleteTarget.id}`, { method: 'DELETE' })
      if (res.deactivated) {
        toast({
          title: L('تم إيقاف المستخدم', 'User deactivated'),
          description: L(
            `لا يمكن حذف «${deleteTarget.username}» لارتباطه بـ ${res.salesCount ?? 0} فاتورة بيع — تم إيقافه بدلاً من الحذف`,
            `«${deleteTarget.username}» has ${res.salesCount ?? 0} sales and was deactivated instead of deleted`
          ),
        })
      } else {
        toast({ title: L('تم حذف المستخدم', 'User deleted'), description: deleteTarget.username })
      }
      setDeleteTarget(null)
      await load(page)
    } catch (e) {
      toast({ variant: 'destructive', title: L('تعذر الحذف', 'Delete failed'), description: errMessage(e) })
    } finally {
      setDeleting(false)
    }
  }

  const columns = useMemo<Column<UserRow>[]>(() => {
    const cols: Column<UserRow>[] = [
      {
        key: 'username',
        header: t('users.username'),
        render: (u) => (
          <div className="flex items-center gap-2">
            <span dir="ltr" className="font-mono text-xs font-semibold">
              {u.username}
            </span>
            {u.id === myId && (
              <Badge variant="outline" className="border-primary/40 bg-primary/10 px-1.5 text-[10px] text-primary">
                {L('أنت', 'you')}
              </Badge>
            )}
          </div>
        ),
      },
      { key: 'displayName', header: t('users.displayName') },
      {
        key: 'roleKey',
        header: t('users.role'),
        render: (u) => (
          <Badge variant="outline" className="text-[11px]">
            <ShieldCheck className="me-1 h-3 w-3 text-primary" />
            {u.roleNameAr}
          </Badge>
        ),
      },
      {
        key: 'phone',
        header: L('الهاتف', 'Phone'),
        render: (u) => (u.phone ? <span dir="ltr" className="font-mono text-xs tabular-nums">{u.phone}</span> : <span className="text-muted-foreground">—</span>),
      },
      {
        key: 'lastLoginAt',
        header: t('users.lastLogin'),
        render: (u) => <span className="text-xs text-muted-foreground">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : L('لم يسجل الدخول بعد', 'Never logged in')}</span>,
      },
      {
        key: 'active',
        header: t('app.status'),
        render: (u) => <StatusBadge status={u.active ? 'ACTIVE' : 'INACTIVE'} label={u.active ? L('نشط', 'Active') : L('موقوف', 'Inactive')} />,
      },
    ]
    if (canManage) {
      cols.push({
        key: 'actions',
        header: t('app.actions'),
        render: (u) => {
          const isSelf = u.id === myId
          return (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => openEdit(u)} aria-label={t('app.edit')}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-[var(--danger)] hover:text-[var(--danger)]"
                onClick={() => setDeleteTarget(u)}
                disabled={isSelf}
                title={isSelf ? t('users.cannotDeleteSelf') : t('app.delete')}
                aria-label={t('app.delete')}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )
        },
      })
    }
    return cols
  }, [canManage, myId, lang, t, L, fmtDateTime])

  const roleOptions = useMemo(() => {
    if (roles && roles.length > 0) return roles
    // graceful fallback when the roles list cannot be fetched (missing ROLE_VIEW)
    if (editing) return [{ id: editing.roleKey, key: editing.roleKey, nameAr: editing.roleNameAr, isSystem: true }]
    return []
  }, [roles, editing])

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('users.title')}
        description={L('إدارة حسابات عاملي المتجر وأدوارهم', 'Manage store staff accounts and roles')}
        icon={<UsersRound className="h-5 w-5" />}
        actions={
          canManage && (
            <Button onClick={openCreate}>
              <UserPlus className="me-2 h-4 w-4" />
              {t('users.add')}
            </Button>
          )
        }
      />

      <div className="flex max-w-md items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1)
                void load(1)
              }
            }}
            placeholder={L('بحث باسم المستخدم أو الاسم أو الهاتف', 'Search username, name or phone')}
            className="min-h-11 ps-8"
            aria-label={t('app.search')}
          />
        </div>
        <Button
          variant="outline"
          className="min-h-11"
          onClick={() => {
            setPage(1)
            void load(1)
          }}
        >
          {t('app.search')}
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={rows ?? undefined}
        loading={loading}
        error={error ?? undefined}
        onRetry={() => void load(page)}
        emptyTitle={t('users.emptyTitle')}
        emptyHint={L('أضف أول مستخدم من زر «إضافة مستخدم»', 'Add your first user via “Add User”')}
      />

      {!loading && !error && rows && rows.length > 0 && (
        <Pagination page={page} pageSize={pageSize} total={total} onPage={(p) => { setPage(p); void load(p) }} />
      )}

      {/* add / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? L(`تعديل المستخدم ${editing.username}`, `Edit user ${editing.username}`) : t('users.add')}</DialogTitle>
            <DialogDescription>
              {editing
                ? L('اترك حقل كلمة المرور فارغاً للاحتفاظ بالكلمة الحالية', 'Leave the password field empty to keep the current password')
                : L('أدخل بيانات المستخدم الجديد ودوره', 'Enter the new user details and role')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="qx-user-username">{t('users.username')}</Label>
                <Input
                  id="qx-user-username"
                  dir="ltr"
                  className="font-mono"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  disabled={!!editing}
                  placeholder="cashier2"
                />
                <p className="text-[11px] text-muted-foreground">{L('أحرف صغيرة وأرقام و . _ - فقط', 'lowercase letters, digits and . _ - only')}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qx-user-name">{t('users.displayName')}</Label>
                <Input id="qx-user-name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder={L('مثال: أحمد محمد', 'e.g. Ahmed Mohamed')} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="qx-user-role">{t('users.role')}</Label>
                <Select value={form.roleKey} onValueChange={(v) => setForm({ ...form, roleKey: v })} dir="ltr">
                  <SelectTrigger className="w-full min-h-11">
                    <SelectValue placeholder={L('اختر الدور', 'Pick a role')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(roleOptions ?? []).map((r) => (
                      <SelectItem key={r.key} value={r.key}>
                        {r.nameAr} <span dir="ltr" className="font-mono text-[10px] text-muted-foreground">{r.key}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {rolesError && <p className="text-[11px] text-[var(--warning)]">{rolesError}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qx-user-phone">
                  {L('الهاتف', 'Phone')} <span className="text-muted-foreground">({t('app.optional')})</span>
                </Label>
                <Input id="qx-user-phone" dir="ltr" className="font-mono tabular-nums" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="01xxxxxxxxx" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="qx-user-password" className="flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-primary" />
                {t('users.password')}
                {editing && <span className="text-[11px] font-normal text-muted-foreground">({L('اختياري عند التعديل', 'optional when editing')})</span>}
              </Label>
              <Input id="qx-user-password" type="password" dir="ltr" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" autoComplete="new-password" />
              <p className="text-[11px] text-muted-foreground">{PASSWORD_HINT}</p>
            </div>

            {editing && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{L('الحساب نشط', 'Account active')}</p>
                  <p className="text-[11px] text-muted-foreground">{L('إيقاف الحساب يمنع الدخول فوراً ويُنهي جلساته', 'Deactivating blocks login and ends sessions')}</p>
                </div>
                <Switch
                  checked={form.active}
                  onCheckedChange={(v) => setForm({ ...form, active: v })}
                  disabled={editing.id === myId}
                  aria-label={form.active ? L('نشط', 'Active') : L('موقوف', 'Inactive')}
                />
              </div>
            )}
            {editing && editing.id === myId && (
              <p className="rounded-lg border border-[var(--warning)]/40 bg-[var(--warning)]/5 px-3 py-2 text-xs text-muted-foreground">
                {L('هذا حسابك الحالي — لا يمكنك إيقافه أو تغيير دوره (حماية من الإغلاق الذاتي)', 'This is your own account — you cannot deactivate it or change its role (self-lockout guard)')}
              </p>
            )}
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
        title={L(`حذف المستخدم «${deleteTarget?.username ?? ''}»؟`, `Delete user “${deleteTarget?.username ?? ''}”?`)}
        description={L(
          'إذا كان للمستخدم فواتير بيع فسيتم إيقاف حسابه بدلاً من حذفه للحفاظ على سلامة السجلات.',
          'If the user has sales, the account will be deactivated instead of deleted to keep records intact.'
        )}
        confirmLabel={t('app.delete')}
        onConfirm={() => void confirmDelete()}
        pending={deleting}
      />
    </div>
  )
}
