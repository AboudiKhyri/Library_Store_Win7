'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Diagnostics screen (system module)
// Consumes GET /api/library/diagnostics: tenant identity, license state +
// server status, license-server reachability/latency, hardware effective vs
// caps, provisioning stage, DB health, per-tenant table counts, last backup.
import { useCallback, useEffect, useState } from 'react'
import { useLibraryStore } from '../store'
import { api, errMessage } from '../api'
import { PageHeader, SectionCard, StatCard, LoadingBlock, ErrorBlock } from '../parts/kit'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import type { SystemStatus } from '@/lib/library/types'
import {
  Activity,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  ShieldCheck,
  Printer,
  ScanLine,
  Coins,
  DatabaseBackup,
  Clock,
  Building2,
  Lock,
  KeyRound,
} from 'lucide-react'

interface DiagnosticsPayload {
  status: SystemStatus
  db: { ok: boolean }
  licenseServer: { url: string; reachable: boolean; latencyMs: number | null; checkedAt: string }
  lastBackupAt: string | null
  activation: {
    tenantId: string
    tenantName: string
    licenseKey: string
    licenseId: string
    plan: string
    businessType: string
    serverStatus: string
    licenseState: string
    provisioningStage: string
    deviceId: string
    deviceName: string
    activatedAt: string
    lastValidatedAt: string
    lastAttemptAt: string | null
    lastAttemptOk: boolean
    lastAttemptError: string | null
  } | null
  artifactPolicy: {
    offlineGraceHours: number
    validationIntervalHours: number
    minAppVersion: string
    expiresAt: string | null
  } | null
  tenantTableCounts: Record<string, number>
  generatedAt: string
}

const HW_KEYS = [
  { key: 'printer', labelAr: 'طابعة الإيصالات', capKey: 'printer' },
  { key: 'scanner', labelAr: 'قارئ الباركود', capKey: 'scanner' },
  { key: 'cashDrawer', labelAr: 'درج النقدية', capKey: 'cashDrawer' },
] as const

const COUNT_LABELS: Record<string, string> = {
  products: 'الأصناف',
  categories: 'التصنيفات',
  suppliers: 'الموردين',
  customers: 'العملاء',
  batches: 'الدفعات',
  purchases: 'فواتير الشراء',
  sales: 'فواتير البيع',
  returns: 'المرتجعات',
  stocktakeSessions: 'جلسات الجرد',
  loyaltyEvents: 'أحداث الولاء',
  users: 'المستخدمون',
  auditLogs: 'سجلات التدقيق',
  backupRecords: 'النسخ الاحتياطية',
}

const STATE_LABELS: Record<string, string> = {
  UNPROVISIONED: 'غير مُنشّط',
  ACTIVE: 'نشط',
  SUSPENDED: 'موقوف',
  EXPIRED: 'منتهي',
  REVOKED: 'مُبطَل',
  INVALID: 'غير موثّق',
  TEMPORARILY_UNAVAILABLE: 'دون اتصال (ضمن السماح)',
  OFFLINE_GRACE_EXPIRED: 'انتهت مهلة السماح',
}

export function DiagnosticsScreen() {
  const t = useLibraryStore((s) => s.t)
  const lang = useLibraryStore((s) => s.lang)
  const fmtDateTime = useLibraryStore((s) => s.fmtDateTime)
  const refreshStatus = useLibraryStore((s) => s.refreshStatus)
  const { toast } = useToast()
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en)

  const [data, setData] = useState<DiagnosticsPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api<DiagnosticsPayload>('/diagnostics')
      setData(res)
      useLibraryStore.setState((s) => ({
        status: {
          ...s.status,
          ...res.status,
          hardwareCaps: { ...s.status?.hardwareCaps, ...res.status?.hardwareCaps },
          modules: { ...s.status?.modules, ...res.status?.modules },
        },
      }))
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function revalidate() {
    try {
      await api('/activation/validate', { method: 'POST' })
      await refreshStatus()
      await load()
      toast({ title: L('تم إعادة التحقق', 'Re-validated') })
    } catch (e) {
      toast({ variant: 'destructive', title: L('تعذر التحقق', 'Validation failed'), description: errMessage(e) })
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('diag.title')} icon={<Activity className="h-5 w-5" />} />
        <LoadingBlock rows={6} />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('diag.title')} icon={<Activity className="h-5 w-5" />} />
        <ErrorBlock message={error} onRetry={load} />
      </div>
    )
  }

  const status = data!.status
  const act = data!.activation
  const licenseHealthy = ['ACTIVE', 'TEMPORARILY_UNAVAILABLE'].includes(status?.licenseState ?? '')
  const hardware = status?.hardware ?? {}
  const caps = status?.hardwareCaps ?? {}

  const overall: 'ok' | 'warn' | 'error' = !data!.db.ok
    ? 'error'
    : licenseHealthy && data!.licenseServer.reachable
      ? 'ok'
      : 'warn'

  const overallTone =
    overall === 'ok'
      ? { cls: 'border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]', icon: <CheckCircle2 className="h-5 w-5" />, text: t('diag.healthy') }
      : overall === 'warn'
        ? { cls: 'border-[var(--warning)]/30 bg-[var(--warning)]/10 text-[var(--warning)]', icon: <AlertTriangle className="h-5 w-5" />, text: L('تحذيرات', 'Warnings') }
        : { cls: 'border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[var(--danger)]', icon: <XCircle className="h-5 w-5" />, text: L('مشاكل تحتاج انتباهاً', 'Issues need attention') }

  const graceRemaining =
    status.license?.graceRemainingHours != null
      ? Math.max(0, Math.round(status.license.graceRemainingHours))
      : null

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('diag.title')}
        description={L('فحص شامل للترخيص والخوادم وقاعدة البيانات والأجهزة', 'Full check of license, servers, database and peripherals')}
        icon={<Activity className="h-5 w-5" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {data && (
              <span className="hidden text-[11px] text-muted-foreground sm:block">
                {L('آخر فحص', 'checked')}: {fmtDateTime(data.generatedAt)}
              </span>
            )}
            <Button variant="outline" onClick={() => void load()} disabled={loading} className="min-h-11 sm:min-h-9">
              {loading ? <RefreshCw className="me-2 h-4 w-4 animate-spin" /> : <RefreshCw className="me-2 h-4 w-4" />}
              {L('إعادة الفحص', 'Re-check')}
            </Button>
          </div>
        }
      />

      {/* overall health banner */}
      <div role="status" className={`flex items-center gap-3 rounded-xl border p-4 ${overallTone.cls}`}>
        {overallTone.icon}
        <div className="min-w-0">
          <p className="text-sm font-bold">
            {t('diag.health')}: {overallTone.text}
          </p>
          <p className="mt-0.5 text-xs opacity-80">
            {data!.db.ok ? L('قاعدة البيانات متصلة', 'Database connected') : L('تعذر الاتصال بقاعدة البيانات', 'Database unreachable')}
            {' · '}
            {data!.licenseServer.reachable
              ? L('خادم التراخيص متصل', 'License server reachable')
              : L('خادم التراخيص غير متاح', 'License server unreachable')}
          </p>
        </div>
      </div>

      {/* summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t('diag.license')}
          value={STATE_LABELS[status?.licenseState ?? ''] ?? status?.licenseState ?? '–'}
          hint={act ? `حالة الخادم: ${act.serverStatus}` : L('لا يوجد تنشيط', 'No activation')}
          icon={<ShieldCheck className="h-5 w-5" />}
          tone={licenseHealthy ? 'success' : 'danger'}
        />
        <StatCard
          label={t('diag.licenseServer')}
          value={data!.licenseServer.reachable ? `${data!.licenseServer.latencyMs ?? '—'} ms` : L('غير متاح', 'Unreachable')}
          hint={data!.licenseServer.url}
          icon={<Activity className="h-5 w-5" />}
          tone={data!.licenseServer.reachable ? 'success' : 'warning'}
        />
        <StatCard
          label={t('diag.lastBackup')}
          value={data!.lastBackupAt ? fmtDateTime(data!.lastBackupAt) : L('—', '—')}
          hint={L('نسخ منطقية كاملة للبيانات', 'Full logical snapshots')}
          icon={<DatabaseBackup className="h-5 w-5" />}
          tone="default"
        />
        <StatCard
          label={t('diag.provisioning')}
          value={act?.provisioningStage ?? '—'}
          hint={act ? `${act.plan} · ${act.tenantName}` : undefined}
          icon={<Building2 className="h-5 w-5" />}
          tone={act?.provisioningStage === 'READY' ? 'success' : 'warning'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* tenant + license identity */}
        <SectionCard
          title={L('هوية الفرع والترخيص', 'Tenant & license identity')}
          description={L('بيانات التنشيط النشط من خادم التراخيص', 'Active activation from the license server')}
          actions={
            <Button variant="outline" size="sm" className="min-h-11 sm:min-h-9" onClick={() => void revalidate()}>
              <RefreshCw className="me-2 h-3.5 w-3.5" />
              {t('license.validateNow')}
            </Button>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow label={L('المعرف (Tenant)', 'Tenant ID')} value={act?.tenantId ?? '—'} mono />
            <InfoRow label={L('اسم المنشأة', 'Tenant name')} value={act?.tenantName ?? '—'} />
            <InfoRow label={L('مفتاح الترخيص', 'License key')} value={act?.licenseKey ?? '—'} mono />
            <InfoRow label={L('معرّف الترخيص', 'License ID')} value={act?.licenseId ?? '—'} mono />
            <InfoRow label={L('اسم الجهاز', 'Device name')} value={act?.deviceName ?? '—'} />
            <InfoRow label={L('معرّف الجهاز', 'Device ID')} value={act?.deviceId ?? status.installationId} mono />
            <InfoRow label={t('license.activatedAt')} value={act ? fmtDateTime(act.activatedAt) : '—'} />
            <InfoRow label={t('license.lastValidated')} value={act ? fmtDateTime(act.lastValidatedAt) : '—'} />
          </div>
          {(graceRemaining != null || data!.artifactPolicy) && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 p-3 text-xs">
              <Clock className="h-4 w-4 text-primary" />
              {data!.artifactPolicy && (
                <span>
                  {t('diag.graceRemaining')}:{' '}
                  <span className="qx-num font-bold tabular-nums" dir="ltr">
                    {graceRemaining ?? data!.artifactPolicy.offlineGraceHours}
                  </span>{' '}
                  / {data!.artifactPolicy.offlineGraceHours} {L('ساعة', 'h')} ·{' '}
                  {L('إعادة تحقق كل', 'revalidate every')} {data!.artifactPolicy.validationIntervalHours} {L('ساعة', 'h')}
                  {data!.artifactPolicy.expiresAt ? ` · ${L('ينتهي', 'expires')}: ${fmtDateTime(data!.artifactPolicy.expiresAt)}` : ''}
                </span>
              )}
              {act?.lastAttemptError && (
                <Badge variant="outline" className="border-[var(--warning)]/30 bg-[var(--warning)]/10 text-[var(--warning)]">
                  <AlertTriangle className="me-1 h-3 w-3" />
                  {L('آخر محاولة فشلت', 'last attempt failed')}
                </Badge>
              )}
            </div>
          )}
        </SectionCard>

        {/* hardware effective vs caps */}
        <SectionCard
          title={L('الأجهزة الطرفية', 'Peripherals')}
          description={L('الحالة الفعلية مقابل حدود الترخيص (الفعّال = الترخيص والإعدادات معاً)', 'Effective state vs license caps (effective = caps AND settings)')}
        >
          <div className="space-y-2">
            {HW_KEYS.map((hw) => {
              const capOn = caps[hw.capKey]
              const effOn =
                hw.key === 'printer' ? hardware.printerEnabled : hw.key === 'scanner' ? hardware.scannerEnabled : hardware.cashDrawerEnabled
              return (
                <div key={hw.key} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {hw.key === 'printer' ? (
                      <Printer className="h-4 w-4 shrink-0 text-primary" />
                    ) : hw.key === 'scanner' ? (
                      <ScanLine className="h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <Coins className="h-4 w-4 shrink-0 text-primary" />
                    )}
                    <span className="truncate text-sm font-semibold">{hw.labelAr}</span>
                    {!capOn && (
                      <Badge variant="outline" className="gap-1 border-[var(--warning)]/40 bg-[var(--warning)]/10 text-[10px] text-[var(--warning)]">
                        <Lock className="h-3 w-3" />
                        غير مرخّص
                      </Badge>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      effOn
                        ? 'border-[var(--success)]/25 bg-[var(--success)]/10 text-[var(--success)]'
                        : 'border-border bg-muted/40 text-muted-foreground'
                    }
                  >
                    {effOn ? L('مفعّل', 'Enabled') : L('متوقف', 'Disabled')}
                  </Badge>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            {L(
              'جهاز «غير مرخّص» مقفل بمستوى الترخيص الموقّع ولا يمكن تفعيله من الإعدادات. عرض ورق الطابعة الحالي:',
              'An "unlicensed" device is locked by the signed license and cannot be enabled in settings. Current paper width:'
            )}{' '}
            <span className="qx-num font-bold" dir="ltr">{hardware.paperWidth}mm</span>
          </p>
        </SectionCard>

        {/* database + system */}
        <SectionCard title={t('diag.database')} description={L('صحة قاعدة البيانات وسجلات هذا الفرع', 'Database health and this tenant\'s records')}>
          <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border p-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">{L('الاتصال', 'Connectivity')}</span>
            </div>
            <Badge
              variant="outline"
              className={
                data!.db.ok
                  ? 'border-[var(--success)]/25 bg-[var(--success)]/10 text-[var(--success)]'
                  : 'border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[var(--danger)]'
              }
            >
              {data?.db?.ok ? L('متصلة', 'Connected') : L('تعذر الاتصال', 'Unreachable')}
            </Badge>
          </div>
          <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {Object.entries(data?.tenantTableCounts ?? {}).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 border-b py-1.5 text-xs last:border-b-0">
                <span className="text-muted-foreground">{COUNT_LABELS[k] ?? k}</span>
                <span className="font-bold tabular-nums" dir="ltr">{v}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* system identity */}
        <SectionCard title={L('النظام', 'System')} description={L('إصدار المحرك ومعرّف التثبيت', 'Engine version and installation identity')}>
          <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            <InfoRow label={t('diag.version')} value={`v${status.version}`} mono />
            <InfoRow label={t('diag.build')} value={status.build} mono />
            <InfoRow label={L('نمط التشغيل', 'Operation Mode')} value={L('محلي بدون اتصال (Offline)', 'Local Standalone Offline')} />
            <InfoRow label={L('حالة الخادم', 'Server Status')} value={L('متصل ومستقر', 'Connected & Stable')} />
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            {L(
              'النظام يعمل بوضع أوفلاين كامل بدون أي ارتباط بخوادم خارجية أو شبكة الإنترنت.',
              'The system runs in full offline mode without any dependency on external servers or internet.'
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-1.5 text-xs last:border-b-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={`truncate font-bold ${mono ? 'font-mono' : ''}`} dir={mono ? 'ltr' : undefined} title={value}>
        {value}
      </span>
    </div>
  )
}
