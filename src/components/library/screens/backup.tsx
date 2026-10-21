'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Backup & Restore screen (system module)
// Real logical backups (22 tables → JSON files). Restore is guarded by a
// PRE_RESTORE safety backup and invalidates all sessions.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLibraryStore } from '../store'
import { api, errMessage } from '../api'
import { PageHeader, SectionCard, StatCard, DataTable, ConfirmDialog, type Column, EmptyState } from '../parts/kit'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import type { BackupConfig } from '@/lib/library/types'
import {
  DatabaseBackup,
  HardDriveDownload,
  FileArchive,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
  ShieldCheck,
  Clock,
  AlertTriangle,
} from 'lucide-react'

interface BackupSummaryRow {
  id: string
  filename: string
  sizeBytes: number
  type: string
  createdAt: string
  note?: string | null
  counts: Record<string, number>
}

interface BackupPayload {
  backups: BackupSummaryRow[]
  storage: { files: number; totalBytes: number }
  config: BackupConfig
}

function formatBytes(bytes: number, lang: 'ar' | 'en'): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return lang === 'ar' ? '٠ بايت' : '0 B'
  if (bytes < 1024) return `${bytes} ${lang === 'ar' ? 'بايت' : 'B'}`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} ${lang === 'ar' ? 'ك.ب' : 'KB'}`
  return `${(kb / 1024).toFixed(2)} ${lang === 'ar' ? 'م.ب' : 'MB'}`
}

function typeBadge(type: string, lang: 'ar' | 'en') {
  if (type === 'AUTO') return { label: lang === 'ar' ? 'تلقائية' : 'Auto', cls: 'border-primary/25 bg-primary/10 text-primary' }
  if (type === 'PRE_RESTORE') return { label: lang === 'ar' ? 'أمان قبل استعادة' : 'Safety', cls: 'border-[var(--warning)]/25 bg-[var(--warning)]/10 text-[var(--warning)]' }
  return { label: lang === 'ar' ? 'يدوية' : 'Manual', cls: 'border-[var(--success)]/25 bg-[var(--success)]/10 text-[var(--success)]' }
}

export function BackupScreen() {
  const t = useLibraryStore((s) => s.t)
  const lang = useLibraryStore((s) => s.lang)
  const fmtDateTime = useLibraryStore((s) => s.fmtDateTime)
  const { toast } = useToast()
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en)

  const [data, setData] = useState<BackupPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [note, setNote] = useState('')
  const [restoreTarget, setRestoreTarget] = useState<BackupSummaryRow | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BackupSummaryRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ---- command palette hand-off: createNow ----
  const viewParams = useLibraryStore((s) => s.viewParams)
  const paletteHandled = useRef('')
  const paramsKey = JSON.stringify(viewParams)
  useEffect(() => {
    if (paramsKey === paletteHandled.current || paramsKey === '{}') return
    paletteHandled.current = paramsKey
    if (viewParams.createNow === true) setCreateOpen(true)
  }, [paramsKey])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await api<BackupPayload>('/backup'))
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function createBackup() {
    setCreating(true)
    try {
      const res = await api<{ backup: BackupSummaryRow }>('/backup', {
        method: 'POST',
        body: { note: note.trim() || undefined },
      })
      toast({
        title: t('backup.done'),
        description: `${res.backup.filename} — ${formatBytes(res.backup.sizeBytes, lang)}`,
      })
      setCreateOpen(false)
      setNote('')
      await load()
    } catch (e) {
      toast({ variant: 'destructive', title: L('تعذر إنشاء النسخة', 'Backup failed'), description: errMessage(e) })
    } finally {
      setCreating(false)
    }
  }

  async function restore() {
    if (!restoreTarget) return
    setRestoring(true)
    try {
      await api(`/backup/${restoreTarget.id}/restore`, { method: 'POST' })
      toast({ title: t('backup.restored'), description: L('جارٍ إعادة تشغيل النظام...', 'Re-booting the system...') })
      // the session table was replaced — full reload re-boots into login
      window.setTimeout(() => window.location.reload(), 900)
    } catch (e) {
      toast({ variant: 'destructive', title: L('تعذرت الاستعادة', 'Restore failed'), description: errMessage(e) })
      setRestoring(false)
    }
  }

  async function remove() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api(`/backup/${deleteTarget.id}`, { method: 'DELETE' })
      toast({ title: L('تم حذف النسخة', 'Backup deleted'), description: deleteTarget.filename })
      setDeleteTarget(null)
      await load()
    } catch (e) {
      toast({ variant: 'destructive', title: L('تعذر الحذف', 'Delete failed'), description: errMessage(e) })
    } finally {
      setDeleting(false)
    }
  }

  const columns: Column<BackupSummaryRow>[] = [
    {
      key: 'filename',
      header: L('الملف', 'File'),
      render: (r) => (
        <div className="min-w-0">
          <p className="max-w-[220px] truncate font-mono text-xs" dir="ltr" title={r.filename}>
            {r.filename}
          </p>
          {r.note && <p className="mt-0.5 max-w-[220px] truncate text-[11px] text-muted-foreground">{r.note}</p>}
        </div>
      ),
    },
    {
      key: 'type',
      header: L('النوع', 'Type'),
      render: (r) => {
        const b = typeBadge(r.type, lang)
        return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${b.cls}`}>{b.label}</span>
      },
    },
    {
      key: 'size',
      header: L('الحجم', 'Size'),
      render: (r) => <span className="tabular-nums text-xs">{formatBytes(r.sizeBytes, lang)}</span>,
      className: 'whitespace-nowrap',
    },
    {
      key: 'counts',
      header: L('المحتوى', 'Contents'),
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="text-[10px]">
            {L('أصناف', 'products')}: <span className="tabular-nums">{r.counts.product ?? 0}</span>
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {L('فواتير', 'sales')}: <span className="tabular-nums">{r.counts.sale ?? 0}</span>
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {L('دفعات', 'batches')}: <span className="tabular-nums">{r.counts.batch ?? 0}</span>
          </Badge>
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: t('app.date'),
      render: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{fmtDateTime(r.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: t('app.actions'),
      render: (r) => (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => setRestoreTarget(r)}
            title={t('backup.restore')}
          >
            <RotateCcw className="me-1 h-3.5 w-3.5" />
            {t('backup.restore')}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-[var(--danger)] hover:text-[var(--danger)]"
            onClick={() => setDeleteTarget(r)}
            aria-label={L('حذف النسخة', 'Delete backup')}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('backup.title')}
        description={L(
          'نسخ كاملة لكل جداول النظام تُحفظ كملفات JSON — الاستعادة تستبدل البيانات الحالية بالكامل',
          'Full snapshots of every table stored as JSON files — restoring fully replaces current data'
        )}
        icon={<DatabaseBackup className="h-5 w-5" />}
        actions={
          <Button onClick={() => setCreateOpen(true)} disabled={loading} className="min-h-11 sm:min-h-9">
            <Plus className="me-2 h-4 w-4" />
            {t('backup.create')}
          </Button>
        }
      />

      {/* storage stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={L('ملفات النسخ', 'Backup files')}
          value={<span className="tabular-nums">{data?.storage.files ?? '—'}</span>}
          icon={<FileArchive className="h-5 w-5" />}
          tone="primary"
        />
        <StatCard
          label={L('الحجم الإجمالي', 'Total size')}
          value={data ? formatBytes(data.storage.totalBytes, lang) : '—'}
          icon={<HardDriveDownload className="h-5 w-5" />}
        />
        <StatCard
          label={t('backup.autoEnabled')}
          value={data?.config.autoBackupEnabled ? L('مفعّل', 'On') : L('معطّل', 'Off')}
          hint={data ? `${t('backup.autoEvery')}: ${data.config.intervalHours} — ${t('backup.retention')}: ${data.config.retentionCount}` : undefined}
          icon={<Clock className="h-5 w-5" />}
          tone={data?.config.autoBackupEnabled ? 'success' : 'default'}
        />
        <StatCard
          label={L('آخر نسخة', 'Latest backup')}
          value={data?.backups[0] ? fmtDateTime(data.backups[0].createdAt) : L('لا توجد', 'None')}
          icon={<ShieldCheck className="h-5 w-5" />}
          tone={data?.backups[0] ? 'success' : 'warning'}
        />
      </div>

      {/* safety explainer */}
      <SectionCard title={L('كيف تعمل الاستعادة بأمان؟', 'How restore safety works')}>
        <div className="grid gap-3 text-xs leading-relaxed text-muted-foreground sm:grid-cols-3">
          <div className="flex items-start gap-2 rounded-xl border bg-muted/30 p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" />
            <p>
              {L(
                'قبل أي استعادة يُنشئ النظام تلقائياً «نسخة أمان» من بياناتك الحالية — يمكنك الرجوع إليها في أي وقت.',
                'Before any restore, the engine automatically takes a safety snapshot of your current data — you can always roll back to it.'
              )}
            </p>
          </div>
          <div className="flex items-start gap-2 rounded-xl border bg-muted/30 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
            <p>
              {L(
                'الاستعادة تستبدل كل الجداول (الأصناف، الدفعات، الفواتير، المستخدمون...) بمحتوى النسخة المحددة.',
                'Restore replaces every table (products, batches, sales, users...) with the selected snapshot contents.'
              )}
            </p>
          </div>
          <div className="flex items-start gap-2 rounded-xl border bg-muted/30 p-3">
            <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              {L(
                'جميع الجلسات تُبطل بعد الاستعادة — سيُطلب من الجميع تسجيل الدخول من جديد.',
                'All sessions are invalidated after a restore — everyone must sign in again.'
              )}
            </p>
          </div>
        </div>
      </SectionCard>

      {/* backups table */}
      <SectionCard title={t('backup.list')} description={L('مرتبة من الأحدث إلى الأقدم', 'Newest first')}>
        {data && data.backups.length === 0 && !loading ? (
          <EmptyState
            title={t('backup.emptyTitle')}
            hint={L('أنشئ أول نسخة احتياطية الآن — تستغرق ثوانٍ معدودة.', 'Create your first backup now — it only takes seconds.')}
            icon={<DatabaseBackup className="h-6 w-6" />}
            action={
              <Button size="sm" onClick={() => setCreateOpen(true)} className="min-h-11">
                <Plus className="me-2 h-4 w-4" />
                {t('backup.create')}
              </Button>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            rows={data?.backups}
            loading={loading}
            error={error ?? undefined}
            onRetry={load}
            emptyTitle={t('backup.emptyTitle')}
          />
        )}
      </SectionCard>

      {/* create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{t('backup.create')}</DialogTitle>
            <DialogDescription>
              {L(
                'ستُنشأ نسخة كاملة من كل جداول النظام (أصناف، مخزون، فواتير، مستخدمون، إعدادات).',
                'A full snapshot of every system table will be created (products, stock, sales, users, settings).'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="backup-note" className="text-xs font-semibold">
              {L('ملاحظة على النسخة', 'Note (optional)')}
            </Label>
            <Input
              id="backup-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={L('مثال: قبل جرد نهاية الشهر', 'e.g. before month-end stocktake')}
              maxLength={300}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating} className="min-h-11 sm:min-h-9">
              {t('app.cancel')}
            </Button>
            <Button onClick={() => void createBackup()} disabled={creating} className="min-h-11 sm:min-h-9">
              {creating ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <DatabaseBackup className="me-2 h-4 w-4" />}
              {t('backup.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* restore confirm */}
      <ConfirmDialog
        open={!!restoreTarget}
        onOpenChange={(v) => !v && !restoring && setRestoreTarget(null)}
        title={L('استعادة هذه النسخة؟', 'Restore this backup?')}
        description={`${t('backup.restoreConfirm')}

${L('الملف', 'File')}: ${restoreTarget?.filename ?? ''}
${L('تاريخ النسخة', 'Snapshot date')}: ${restoreTarget ? fmtDateTime(restoreTarget.createdAt) : ''}`}
        confirmLabel={L('نعم، استعادة الآن', 'Yes, restore now')}
        onConfirm={() => void restore()}
        pending={restoring}
      />

      {/* delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && !deleting && setDeleteTarget(null)}
        title={L('حذف هذه النسخة؟', 'Delete this backup?')}
        description={`${L('سيُحذف ملف النسخة نهائياً من القرص ولا يمكن التراجع.', 'The backup file will be permanently deleted from disk. This cannot be undone.')}

${deleteTarget?.filename ?? ''}`}
        confirmLabel={L('نعم، احذف', 'Yes, delete')}
        onConfirm={() => void remove()}
        pending={deleting}
      />
    </div>
  )
}
