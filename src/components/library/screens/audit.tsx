'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Audit log screen (system module)
// Append-only, tamper-resistant trail of every sensitive operation.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLibraryStore } from '../store'
import { api, errMessage } from '../api'
import { PageHeader, SectionCard, DataTable, Pagination, type Column } from '../parts/kit'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { ScrollText, Search, RotateCcw, Lock, Braces, User, Boxes, Radio } from 'lucide-react'

interface AuditRow {
  id: string
  username: string
  action: string
  entity: string
  entityId: string | null
  result: string
  metadata: Record<string, unknown>
  createdAt: string
}

interface AuditPayload {
  items: AuditRow[]
  total: number
  page: number
  pageSize: number
  actions: string[]
}

const PAGE_SIZE = 30

export function AuditScreen() {
  const t = useLibraryStore((s) => s.t)
  const lang = useLibraryStore((s) => s.lang)
  const fmtDateTime = useLibraryStore((s) => s.fmtDateTime)
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en)

  const [data, setData] = useState<AuditPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [action, setAction] = useState('all')
  const [result, setResult] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(q.trim()), 400)
    return () => window.clearTimeout(id)
  }, [q])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (debouncedQ) params.set('q', debouncedQ)
      if (action !== 'all') params.set('action', action)
      if (result !== 'all') params.set('result', result)
      if (from) params.set('from', from)
      const res = await api<AuditPayload | AuditRow[]>(`/audit?${params.toString()}`)
      if (Array.isArray(res)) {
        setData({ items: res, total: res.length, page: 1, pageSize: PAGE_SIZE, actions: [] })
      } else {
        setData({ ...res, items: res?.items ?? [], actions: res?.actions ?? [] })
      }
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setLoading(false)
    }
  }, [page, debouncedQ, action, result, from, to])

  useEffect(() => {
    void load()
  }, [load])

  // ---- live-tail mode: silent refresh every 15s while enabled ----
  const [liveTail, setLiveTail] = useState(false)
  useEffect(() => {
    if (!liveTail) return
    const id = setInterval(() => {
      // silent: only refresh when already on page 1 and idle (no spinner flash)
      if (page === 1 && !loading) {
        void load()
      }
    }, 15000)
    return () => clearInterval(id)
  }, [liveTail, page, load, loading])

  // reset page when filters change (not on page itself)
  useEffect(() => {
    setPage(1)
  }, [debouncedQ, action, result, from, to])

  const columns: Column<AuditRow>[] = useMemo(
    () => [
      {
        key: 'createdAt',
        header: t('app.date'),
        render: (r) => <span className="whitespace-nowrap text-xs text-muted-foreground">{fmtDateTime(r.createdAt)}</span>,
        className: 'whitespace-nowrap',
      },
      {
        key: 'username',
        header: t('audit.user'),
        render: (r) => (
          <span className="flex items-center gap-1.5 text-sm">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            {r.username}
          </span>
        ),
      },
      {
        key: 'action',
        header: t('audit.action'),
        render: (r) => (
          <span
            dir="ltr"
            className="inline-flex items-center rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary"
          >
            {r.action}
          </span>
        ),
      },
      {
        key: 'entity',
        header: t('audit.entity'),
        render: (r) =>
          r.entity ? (
            <span className="text-xs">
              {entityLabel(r.entity, lang)}
              {r.entityId && (
                <span className="ms-1 font-mono text-[10px] text-muted-foreground" dir="ltr">
                  #{r.entityId.slice(0, 10)}
                </span>
              )}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        key: 'result',
        header: t('audit.result'),
        render: (r) => (
          <span className={r.result === 'SUCCESS' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}>
            {r.result === 'SUCCESS' ? '✔' : '✖'} {r.result === 'SUCCESS' ? L('نجاح', 'Success') : L('فشل', 'Failure')}
          </span>
        ),
      },
      {
        key: 'metadata',
        header: L('التفاصيل', 'Details'),
        render: (r) => {
          const keys = Object.keys(r.metadata ?? {})
          if (keys.length === 0) return <span className="text-xs text-muted-foreground">—</span>
          return (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 gap-1.5 font-mono text-[11px]">
                  <Braces className="h-3.5 w-3.5" />
                  {L(`بيانات (${keys.length})`, `${keys.length} fields`)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-0" align="start">
                <div className="qx-scroll max-h-72 overflow-auto rounded-lg bg-muted/30 p-3" dir="ltr">
                  <pre className="whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed">
                    {JSON.stringify(r.metadata, null, 2)}
                  </pre>
                </div>
              </PopoverContent>
            </Popover>
          )
        },
      },
    ],
    [t, lang, fmtDateTime, L]
  )

  function resetFilters() {
    setQ('')
    setAction('all')
    setResult('all')
    setFrom('')
    setTo('')
    setPage(1)
  }

  const hasFilters = q || action !== 'all' || result !== 'all' || from || to

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('audit.title')}
        description={L(
          'سجل غير قابل للتعديل لكل العمليات الحساسة — إضافة فقط (Tamper-resistant)',
          'Append-only, tamper-resistant trail of every sensitive operation'
        )}
        icon={<ScrollText className="h-5 w-5" />}
        actions={
          <Button
            variant={liveTail ? 'default' : 'outline'}
            size="sm"
            onClick={() => setLiveTail((v) => !v)}
            className={cn(liveTail && 'gap-1.5')}
            title={L('تحديث تلقائي كل ١٥ ثانية', 'Auto-refresh every 15s')}
          >
            <Radio className={cn('h-4 w-4', liveTail && 'animate-pulse')} />
            {liveTail ? L('بث مباشر — يعمل', 'Live — on') : L('بث مباشر', 'Live tail')}
          </Button>
        }
      />

      {/* filters */}
      <SectionCard title={L('تصفية السجل', 'Filter log')}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5 lg:col-span-2">
            <Label htmlFor="audit-q" className="text-xs font-semibold">
              {L('بحث (إجراء / مستخدم / كيان)', 'Search (action / user / entity)')}
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="audit-q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('app.search')}
                className="ps-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('audit.action')}</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="ltr" className="max-h-72">
                <SelectItem value="all">{L('كل الإجراءات', 'All actions')}</SelectItem>
                {(data?.actions ?? []).map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('audit.result')}</Label>
            <Select value={result} onValueChange={setResult}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{L('الكل', 'All')}</SelectItem>
                <SelectItem value="SUCCESS">{L('نجاح', 'Success')}</SelectItem>
                <SelectItem value="FAILURE">{L('فشل', 'Failure')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="audit-from" className="text-xs font-semibold">
                {L('من', 'From')}
              </Label>
              <Input id="audit-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="qx-num" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audit-to" className="text-xs font-semibold">
                {L('إلى', 'To')}
              </Label>
              <Input id="audit-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="qx-num" />
            </div>
          </div>
        </div>
        {hasFilters && (
          <div className="mt-3 flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={resetFilters} className="min-h-9">
              <RotateCcw className="me-1.5 h-3.5 w-3.5" />
              {L('مسح التصفية', 'Clear filters')}
            </Button>
            {data && (
              <Badge variant="outline" className="text-[11px]">
                <Boxes className="me-1 h-3 w-3" />
                {data.total} {L('سجل', 'records')}
              </Badge>
            )}
          </div>
        )}
      </SectionCard>

      {/* table */}
      <SectionCard title={L('السجلات', 'Records')} description={L('مرتبة من الأحدث إلى الأقدم', 'Newest first')}>
        <DataTable
          columns={columns}
          rows={data?.items}
          loading={loading}
          error={error ?? undefined}
          onRetry={load}
          emptyTitle={t('audit.emptyTitle')}
          emptyHint={L('لا توجد سجلات مطابقة للتصفية الحالية.', 'No records match the current filters.')}
        />
        {data && (data.items?.length ?? 0) > 0 && (
          <div className="mt-3">
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
          </div>
        )}
      </SectionCard>

      {/* append-only note */}
      <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
          <p className="font-bold text-foreground">{L('سجل مضمون ضد التلاعب', 'Tamper-resistant trail')}</p>
          <p>
            {L(
              'يكتب النظام سجل التدقيق تلقائياً مع كل عملية حساسة (بيع، تعديل مخزون، مستخدمون، نسخ احتياطي، ترخيص...) ولا يوفر أي واجهة لتعديله أو حذفه — يُستخدم للمراجعة والمساءلة ويُضمَّن في كل نسخة احتياطية.',
              'The engine writes the audit trail automatically with every sensitive operation (sales, stock edits, users, backups, license...) and exposes no interface to edit or delete it — it exists for review and accountability and is included in every backup.'
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

function entityLabel(entity: string, lang: 'ar' | 'en'): string {
  const map: Record<string, [string, string]> = {
    sale: ['فاتورة بيع', 'Sale'],
    purchase: ['فاتورة شراء', 'Purchase'],
    product: ['صنف', 'Product'],
    batch: ['دفعة', 'Batch'],
    user: ['مستخدم', 'User'],
    role: ['دور', 'Role'],
    settings: ['الإعدادات', 'Settings'],
    backup: ['نسخة احتياطية', 'Backup'],
    license: ['الترخيص', 'License'],
    return: ['مرتجع', 'Return'],
    customer: ['عميل', 'Customer'],
    supplier: ['مورد', 'Supplier'],
    category: ['تصنيف', 'Category'],
    stocktake: ['جرد', 'Stocktake'],
    session: ['جلسة', 'Session'],
  }
  return (map[entity] ?? [entity, entity])[lang === 'ar' ? 0 : 1]
}
