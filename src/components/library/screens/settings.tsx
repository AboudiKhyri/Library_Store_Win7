'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Settings screen (system module)
// Sections: business | branding | POS | inventory | hardware | backup | localization
// Loads GET /settings, saves per-section partials via PUT /settings with dirty tracking.
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useLibraryStore } from '../store'
import { api, errMessage } from '../api'
import { PageHeader, SectionCard, LoadingBlock, ErrorBlock } from '../parts/kit'
import { paymentLabel, unitLabel } from '../parts/labels'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useToast } from '@/hooks/use-toast'
import { getHardwareProvider, startScannerTest, type ScannerKeyInfo, type ScannerTestHandle } from '@/lib/library/hardware'
import type { LoyaltySettings,
  BackupConfig,
  BrandingConfig,
  BusinessConfig,
  HardwareConfig,
  LocalizationConfig,
  PosConfig,
} from '@/lib/library/types'
import {
  Building2,
  Palette,
  ShoppingCart,
  Boxes,
  Printer,
  DatabaseBackup,
  Languages,
  Save,
  Loader2,
  Upload,
  X,
  ScanLine,
  Coins,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Plus,
  Lock,
} from 'lucide-react'

type SectionKey = 'business' | 'branding' | 'pos' | 'inventory' | 'hardware' | 'backup' | 'localization'
type SaveKey = Exclude<SectionKey, 'inventory'>

interface SettingsPayload {
  business: BusinessConfig
  branding: BrandingConfig
  hardware: HardwareConfig
  pos: PosConfig
  localization: LocalizationConfig
  backup: BackupConfig
}

type LFn = (ar: string, en: string) => string

const PAYMENT_PRESETS = ['cash', 'card', 'wallet'] as const

function snapshot(s: SettingsPayload): Record<SaveKey, string> {
  return {
    business: JSON.stringify(s.business),
    branding: JSON.stringify(s.branding),
    pos: JSON.stringify(s.pos),
    hardware: JSON.stringify(s.hardware),
    backup: JSON.stringify(s.backup),
    localization: JSON.stringify(s.localization),
  }
}

const SAVE_KEYS: SaveKey[] = ['business', 'branding', 'pos', 'hardware', 'backup', 'localization']

export function SettingsScreen() {
  const t = useLibraryStore((s) => s.t)
  const lang = useLibraryStore((s) => s.lang)
  const status = useLibraryStore((s) => s.status)
  const has = useLibraryStore((s) => s.has)
  const setLang = useLibraryStore((s) => s.setLang)
  const refreshStatus = useLibraryStore((s) => s.refreshStatus)
  const { toast } = useToast()

  const L = useCallback<LFn>((ar, en) => (lang === 'ar' ? ar : en), [lang])

  const [cfg, setCfg] = useState<SettingsPayload | null>(null)
  const [saved, setSaved] = useState<Record<SaveKey, string> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<SaveKey | null>(null)

  const canManage = has('SETTINGS_MANAGE')
  const canHardware = canManage && has('HARDWARE_MANAGE')
  const canBackup = has('BACKUP_MANAGE')
  const canSweep = has('INVENTORY_ADJUST')

  const load = useCallback(async () => {
    setError(null)
    try {
      const data = await api<SettingsPayload>('/settings')
      setCfg(data)
      setSaved(snapshot(data))
    } catch (e) {
      setError(errMessage(e))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const dirty = useMemo(() => {
    if (!cfg || !saved) return {} as Record<string, boolean>
    const snap = snapshot(cfg)
    return SAVE_KEYS.reduce(
      (acc, k) => {
        acc[k] = snap[k] !== saved[k]
        return acc
      },
      {} as Record<string, boolean>
    )
  }, [cfg, saved])

  async function saveSection(key: SaveKey, body: Record<string, unknown>) {
    if (!cfg) return
    setSaving(key)
    try {
      const updated = await api<SettingsPayload>('/settings', { method: 'PUT', body })
      setCfg(updated)
      setSaved(snapshot(updated))
      toast({ title: t('settings.saved'), description: sectionName(key, L) })
      if (key === 'branding' || key === 'localization' || key === 'pos') {
        await refreshStatus()
      }
      if (key === 'localization') {
        setLang(updated.localization.language)
      }
    } catch (e) {
      toast({ variant: 'destructive', title: L('تعذر الحفظ', 'Save failed'), description: errMessage(e) })
    } finally {
      setSaving(null)
    }
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('settings.title')} icon={<Building2 className="h-5 w-5" />} />
        <ErrorBlock message={error} onRetry={load} />
      </div>
    )
  }

  if (!cfg || !saved) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('settings.title')} icon={<Building2 className="h-5 w-5" />} />
        <LoadingBlock rows={6} />
      </div>
    )
  }

  const sections: { key: SectionKey; label: string; icon: typeof Building2 }[] = [
    { key: 'business', label: t('settings.business'), icon: Building2 },
    { key: 'branding', label: t('settings.branding'), icon: Palette },
    { key: 'pos', label: t('settings.pos'), icon: ShoppingCart },
    { key: 'inventory', label: t('settings.inventory'), icon: Boxes },
    { key: 'hardware', label: t('settings.hardware'), icon: Printer },
    { key: 'backup', label: t('settings.backup'), icon: DatabaseBackup },
    { key: 'localization', label: t('settings.localization'), icon: Languages },
  ]

  const noPermHint = L('لا تملك صلاحية تعديل الإعدادات', 'No settings permission')

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('settings.title')}
        description={L('إعدادات النشاط والنظام — تُحفظ كل قسم على حدة', 'Business & system settings — each section saves independently')}
        icon={<Building2 className="h-5 w-5" />}
      />

      <Tabs defaultValue="business">
        <TabsList className="qx-scroll h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
          {sections.map((s) => {
            const Icon = s.icon
            return (
              <TabsTrigger key={s.key} value={s.key} className="gap-1.5 px-3 py-2 text-xs sm:text-sm">
                <Icon className="h-4 w-4" />
                {s.label}
                {dirty[s.key] && (
                  <span className="ms-0.5 inline-block h-2 w-2 rounded-full bg-[var(--warning)]" aria-label={L('تغييرات غير محفوظة', 'unsaved')} />
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>

        <TabsContent value="business" className="mt-4">
          <BusinessSection cfg={cfg} setCfg={setCfg} />
          <SaveRow
            disabled={!dirty.business || !canManage}
            saving={saving === 'business'}
            onSave={() => void saveSection('business', { business: cfg.business })}
            hint={!canManage ? noPermHint : undefined}
            L={L}
          />
        </TabsContent>

        <TabsContent value="branding" className="mt-4">
          <BrandingSection cfg={cfg} setCfg={setCfg} L={L} />
          <SaveRow
            disabled={!dirty.branding || !canManage}
            saving={saving === 'branding'}
            onSave={() => void saveSection('branding', { branding: cfg.branding })}
            hint={!canManage ? noPermHint : undefined}
            L={L}
          />
        </TabsContent>

        <TabsContent value="pos" className="mt-4">
          <PosSection cfg={cfg} setCfg={setCfg} L={L} loyaltyLicensed={!!status?.modules.loyalty} />
          <SaveRow
            disabled={!dirty.pos || !canManage}
            saving={saving === 'pos'}
            onSave={() => void saveSection('pos', { pos: cfg.pos })}
            hint={!canManage ? noPermHint : undefined}
            L={L}
          />
        </TabsContent>

        <TabsContent value="inventory" className="mt-4">
          <InventorySection cfg={cfg} L={L} canSweep={canSweep} />
        </TabsContent>

        <TabsContent value="hardware" className="mt-4">
          <HardwareSection cfg={cfg} setCfg={setCfg} canSave={canHardware} L={L} caps={status?.hardwareCaps ?? null} />
          <SaveRow
            disabled={!dirty.hardware || !canHardware}
            saving={saving === 'hardware'}
            onSave={() => void saveSection('hardware', { hardware: cfg.hardware })}
            hint={!canHardware ? L('تعديل الأجهزة يتطلب صلاحية إدارة الأجهزة', 'Hardware manage permission required') : undefined}
            L={L}
          />
        </TabsContent>

        <TabsContent value="backup" className="mt-4">
          <BackupSection cfg={cfg} setCfg={setCfg} L={L} />
          <SaveRow
            disabled={!dirty.backup || !canBackup}
            saving={saving === 'backup'}
            onSave={() => void saveSection('backup', { backup: cfg.backup })}
            hint={!canBackup ? L('يتطلب صلاحية إدارة النسخ الاحتياطية', 'Backup manage permission required') : undefined}
            L={L}
          />
        </TabsContent>

        <TabsContent value="localization" className="mt-4">
          <LocalizationSection cfg={cfg} setCfg={setCfg} L={L} />
          <SaveRow
            disabled={!dirty.localization || !canManage}
            saving={saving === 'localization'}
            onSave={() => void saveSection('localization', { localization: cfg.localization, pos: { currencySymbol: cfg.pos.currencySymbol } })}
            hint={!canManage ? noPermHint : undefined}
            L={L}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ---------------- Save row ----------------

function SaveRow({
  disabled,
  saving,
  onSave,
  hint,
  L,
}: {
  disabled: boolean
  saving: boolean
  onSave: () => void
  hint?: string
  L: LFn
}) {
  return (
    <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
      {hint && <p className="text-xs text-muted-foreground sm:me-auto">{hint}</p>}
      <Button onClick={onSave} disabled={disabled || saving} className="min-h-11 sm:min-h-9">
        {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
        {L('حفظ التغييرات', 'Save changes')}
      </Button>
    </div>
  )
}

function sectionName(key: SaveKey, L: LFn): string {
  const map: Record<SaveKey, string> = {
    business: L('بيانات النشاط', 'Business'),
    branding: L('الهوية البصرية', 'Branding'),
    pos: L('نقطة البيع', 'POS'),
    hardware: L('الأجهزة الطرفية', 'Hardware'),
    backup: L('النسخ الاحتياطي', 'Backup'),
    localization: L('اللغة والتنسيق', 'Localization'),
  }
  return map[key]
}

// ---------------- Business ----------------

function BusinessSection({
  cfg,
  setCfg,
}: {
  cfg: SettingsPayload
  setCfg: Dispatch<SetStateAction<SettingsPayload | null>>
}) {
  const b = cfg.business
  const set = (k: keyof BusinessConfig) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setCfg((c) => (c ? { ...c, business: { ...c.business, [k]: e.target.value } } : c))

  return (
    <SectionCard title="بيانات النشاط" description="تظهر هذه البيانات على الفواتير والإيصالات والتقارير.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="اسم النشاط" required>
          <Input value={b.businessName} onChange={set('businessName')} placeholder="ألفا ماركت" />
        </Field>
        <Field label="الاسم المعروض">
          <Input value={b.displayName} onChange={set('displayName')} placeholder="ألفا ماركت — الفرع الرئيسي" />
        </Field>
        <Field label="المسؤول / المالك">
          <Input value={b.owner} onChange={set('owner')} placeholder="محمد أحمد" />
        </Field>
        <Field label="الهاتف">
          <Input value={b.phone} onChange={set('phone')} placeholder="01012345678" dir="ltr" className="qx-num" />
        </Field>
        <Field label="هاتف إضافي">
          <Input value={b.phone2} onChange={set('phone2')} placeholder="02XXXXXXXX" dir="ltr" className="qx-num" />
        </Field>
        <Field label="البريد الإلكتروني">
          <Input value={b.email} onChange={set('email')} placeholder="info@market.example" dir="ltr" className="qx-num" />
        </Field>
        <Field label="الرقم الضريبي / السجل" hint="اختياري">
          <Input value={b.taxId} onChange={set('taxId')} dir="ltr" className="qx-num" />
        </Field>
        <Field label="العنوان">
          <Input value={b.address} onChange={set('address')} placeholder="القاهرة — شارع التحرير" />
        </Field>
      </div>
      <Separator className="my-4" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="ترويسة الإيصال" hint="سطر يطبع أعلى الإيصال">
          <Input value={b.receiptHeader} onChange={set('receiptHeader')} placeholder="ألفا ماركت — خدمة ٢٤ ساعة" />
        </Field>
        <Field label="تذييل الإيصال">
          <Input value={b.receiptFooter} onChange={set('receiptFooter')} />
        </Field>
        <Field label="ملاحظات" hint="اختياري — تظهر في صفحة النشاط">
          <Input value={b.notes} onChange={set('notes')} />
        </Field>
      </div>
    </SectionCard>
  )
}

// ---------------- Branding ----------------

function getContrastInfo(hex: string) {
  if (!hex || typeof hex !== 'string') return { fg: '#ffffff', ratio: 21, warn: false };
  const c = hex.replace('#', '').trim();
  if (c.length !== 3 && c.length !== 6) return { fg: '#ffffff', ratio: 21, warn: false };
  const full = c.length === 3 ? c.split('').map(x => x + x).join('') : c;
  const num = parseInt(full, 16);
  if (isNaN(num)) return { fg: '#ffffff', ratio: 21, warn: false };
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const toLinear = (v: number) => {
    const val = v / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  const ratioWhite = 1.05 / (lum + 0.05);
  const ratioBlack = (lum + 0.05) / 0.05;
  const useBlack = ratioBlack > ratioWhite;
  const bestRatio = Math.max(ratioWhite, ratioBlack);
  return {
    fg: useBlack ? '#020f19' : '#ffffff',
    ratio: bestRatio,
    warn: bestRatio < 3.0,
  };
}


function BrandingSection({
  cfg,
  setCfg,
  L,
}: {
  cfg: SettingsPayload
  setCfg: Dispatch<SetStateAction<SettingsPayload | null>>
  L: LFn
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [logoError, setLogoError] = useState<string | null>(null)
  const br = cfg.branding
  const primaryContrast = getContrastInfo(br.primary)

  function onLogo(file: File | undefined) {
    if (!file) return
    setLogoError(null)
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setLogoError(L('صيغة غير مدعومة — استخدم PNG أو JPG', 'Unsupported format — use PNG or JPG'))
      return
    }
    if (file.size > 500 * 1024) {
      setLogoError(L('حجم الشعار يتجاوز ٥٠٠ كيلوبايت', 'Logo exceeds 500KB'))
      return
    }
    const reader = new FileReader()
    reader.onload = () =>
      setCfg((c) => (c ? { ...c, branding: { ...c.branding, logoDataUrl: String(reader.result) } } : c))
    reader.readAsDataURL(file)
  }

  return (
    <SectionCard
      title={L('الهوية البصرية', 'Branding')}
      description={L('ألوان وشعار الواجهة — تُطبق على الترويسة ونقطة البيع بعد الحفظ', 'UI colors & logo — applied to header and POS after save')}
    >
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-6">
        {br.logoDataUrl ? (
          <div className="relative">
            <img src={br.logoDataUrl} alt={L('شعار المتجر', 'Store logo')} className="h-24 rounded-xl border bg-white p-2 object-contain" />
            <button
              className="absolute -end-2 -top-2 rounded-full bg-[var(--danger)] p-1.5 text-[var(--danger-foreground)] shadow"
              onClick={() => setCfg((c) => (c ? { ...c, branding: { ...c.branding, logoDataUrl: null } } : c))}
              aria-label={L('إزالة الشعار', 'Remove logo')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-xl border bg-muted/50 text-xs text-muted-foreground">
            {L('بدون شعار', 'No logo')}
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="min-h-11">
          <Upload className="me-2 h-4 w-4" />
          {L('رفع شعار المتجر', 'Upload logo')}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          {L('PNG أو JPG بحد أقصى ٥٠٠ كيلوبايت — يظهر في ترويسة النظام والإيصالات', 'PNG or JPG up to 500KB — appears in the header and receipts')}
        </p>
        {logoError && <p className="text-xs text-[var(--danger)]">{logoError}</p>}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {(['primary', 'secondary', 'accent'] as const).map((k) => (
          <div key={k} className="rounded-xl border p-4">
            <p className="mb-3 text-sm font-semibold">
              {k === 'primary' ? L('اللون الأساسي', 'Primary') : k === 'secondary' ? L('اللون الثانوي', 'Secondary') : L('لون التمييز', 'Accent')}
            </p>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={br[k]}
                onChange={(e) => setCfg((c) => (c ? { ...c, branding: { ...c.branding, [k]: e.target.value } } : c))}
                className="h-10 w-14 cursor-pointer rounded-lg border bg-transparent"
                aria-label={k}
              />
              <Input
                dir="ltr"
                value={br[k]}
                onChange={(e) => setCfg((c) => (c ? { ...c, branding: { ...c.branding, [k]: e.target.value } } : c))}
                className="qx-num font-mono text-xs"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <p className="mb-2 text-sm font-semibold">{L('معاينة مباشرة لواجهة التطبيق', 'Live app layout preview')}</p>
        {/* mini app-layout mockup driven by the in-editor colors */}
        <div className="overflow-hidden rounded-xl border" style={{ ['--primary' as string]: br.primary, ['--secondary' as string]: br.secondary, ['--accent' as string]: br.accent }}>
          {/* mock header */}
          <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
            <span className="h-7 w-7 rounded-lg" style={{ background: br.primary }} />
            <div className="leading-tight">
              <p className="text-xs font-bold">{cfg.business.displayName || cfg.business.businessName || L('اسم المتجر', 'Store name')}</p>
              <p className="text-[9px] text-muted-foreground">{L('تطبيق المعاينة', 'Preview app')}</p>
            </div>
            <span
              className="ms-auto rounded-md px-2 py-1 text-[10px] font-bold"
              style={{ background: br.primary }}
            >
              {L('بحث سريع', 'Quick search')}
            </span>
          </div>
          <div className="flex">
            {/* mock sidebar */}
            <div className="hidden w-28 flex-col gap-1 border-e p-2 sm:flex">
              {[
                L('لوحة التحكم', 'Dashboard'),
                L('نقطة البيع', 'POS'),
                L('الأصناف', 'Products'),
                L('التقارير', 'Reports'),
              ].map((item, i) => (
                <span
                  key={item}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[10px] font-semibold"
                  style={
                    i === 1
                      ? { background: `${br.primary}22`, color: br.primary }
                      : { color: 'var(--muted-foreground)' }
                  }
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: i === 1 ? br.primary : 'var(--muted-foreground)' }} />
                  {item}
                </span>
              ))}
            </div>
            {/* mock content */}
            <div className="flex-1 space-y-2 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold">{L('مبيعات اليوم', "Today's sales")}</p>
                <span
                  className="rounded-md border px-2 py-0.5 text-[10px] font-bold"
                  style={{ borderColor: `${br.secondary}66`, color: br.secondary }}
                >
                  {L('فاتورة جديدة', 'New sale')}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border p-2">
                  <p className="text-[8px] text-muted-foreground">{L('الإيراد', 'Revenue')}</p>
                  <p className="mt-0.5 text-sm font-extrabold tabular-nums">1,234.00</p>
                  <div className="mt-1 h-1 rounded-full" style={{ background: `linear-gradient(90deg, ${br.primary}, ${br.accent})` }} />
                </div>
                <div className="rounded-lg border p-2">
                  <p className="text-[8px] text-muted-foreground">{L('الفواتير', 'Invoices')}</p>
                  <p className="mt-0.5 text-sm font-extrabold tabular-nums">42</p>
                  <div className="mt-1 h-1 rounded-full" style={{ background: `${br.secondary}55` }} />
                </div>
                <div className="rounded-lg border p-2">
                  <p className="text-[8px] text-muted-foreground">{L('تنبيه المخزون', 'Stock alert')}</p>
                  <p className="mt-0.5 text-sm font-extrabold tabular-nums" style={{ color: br.accent }}>
                    3
                  </p>
                  <div className="mt-1 h-1 rounded-full" style={{ background: `${br.accent}55` }} />
                </div>
              </div>
              {/* mock chart */}
              <div className="flex h-12 items-end gap-1 rounded-lg border p-1.5">
                {[35, 55, 40, 70, 50, 85, 62].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm"
                    style={{ height: `${h}%`, background: i === 5 ? br.accent : `${br.primary}cc` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {L(
            'ملاحظة: تُطبق الألوان على الترويسة ونقطة البيع بعد الحفظ، وقد يلزم تحديث الصفحة (F5) لتطبيقها بالكامل.',
            'Note: colors apply to the header and POS after saving; a page refresh (F5) guarantees full application.'
          )}
        </p>
      </div>
    </SectionCard>
  )
}

// ---------------- POS ----------------


const LOYALTY_DEFAULTS: LoyaltySettings = {
  enabled: true,
  earnRatePer100: 1,
  pointValueEgp: 0.1,
  maxRedeemShare: 0.5,
  minRedeemPoints: 10,
  tierBronze: 20,
  tierSilver: 100,
  tierGold: 500,
}

function defaultLoyalty(current?: LoyaltySettings): LoyaltySettings {
  return { ...LOYALTY_DEFAULTS, ...(current ?? {}) }
}

function loyaltyVal(p: { loyalty?: LoyaltySettings }, key: keyof LoyaltySettings, fallback: number): number {
  const v = p.loyalty?.[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/** Ordered tier chips for the settings preview. */
function TierPreview({ loyalty, L }: { loyalty?: LoyaltySettings; L: LFn }) {
  const bronze = loyaltyVal({ loyalty }, 'tierBronze', 20)
  const silver = loyaltyVal({ loyalty }, 'tierSilver', 100)
  const gold = loyaltyVal({ loyalty }, 'tierGold', 500)
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-[11px] text-muted-foreground">{L('مستويات العضوية:', 'Membership tiers:')}</span>
      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">عضو ≥ 0</span>
      <span className="rounded-full border border-orange-700/40 bg-orange-700/10 px-2 py-0.5 text-[10px] font-bold text-orange-800 dark:text-orange-400">برونزي ≥ {bronze}</span>
      <span className="rounded-full border border-slate-400/50 bg-slate-400/15 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">فضي ≥ {silver}</span>
      <span className="rounded-full border border-amber-500/50 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">ذهبي ≥ {gold}</span>
    </div>
  )
}

function PosSection({
  cfg,
  setCfg,
  L,
  loyaltyLicensed,
}: {
  cfg: SettingsPayload
  setCfg: Dispatch<SetStateAction<SettingsPayload | null>>
  L: LFn
  loyaltyLicensed: boolean
}) {
  const lang = useLibraryStore((s) => s.lang)
  const [unitDraft, setUnitDraft] = useState('')
  const p = cfg.pos
  const setPos = (patch: Partial<PosConfig>) => setCfg((c) => (c ? { ...c, pos: { ...c.pos, ...patch } } : c))

  const toggleMethod = (m: string) => {
    const active = p.paymentMethods.includes(m)
    const next = active ? p.paymentMethods.filter((x) => x !== m) : [...p.paymentMethods, m]
    if (next.length === 0) return
    const def = next.includes(p.defaultPaymentMethod) ? p.defaultPaymentMethod : next[0]
    setPos({ paymentMethods: next, defaultPaymentMethod: def })
  }

  return (
    <SectionCard
      title={L('إعدادات نقطة البيع', 'POS settings')}
      description={L('العملة والخصومات وطرق الدفع', 'Currency, discounts and payment methods')}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={L('رمز العملة', 'Currency symbol')}>
          <Input value={p.currencySymbol} onChange={(e) => setPos({ currencySymbol: e.target.value })} placeholder="ج.م" />
        </Field>
        <Field label={L('كود العملة', 'Currency code')}>
          <Input value={p.currency} onChange={(e) => setPos({ currency: e.target.value })} placeholder="EGP" dir="ltr" className="qx-num" />
        </Field>
        <NumField
          label={L('عدد نسخ الإيصال', 'Receipt copies')}
          value={p.receiptCopies}
          min={1}
          max={3}
          onChange={(v) => setPos({ receiptCopies: v })}
        />
      </div>

      <Separator className="my-4" />

      <div className="grid gap-4 sm:grid-cols-2">
        <SwitchField
          label={L('السماح بالخصم في نقطة البيع', 'Allow POS discounts')}
          checked={p.allowDiscount}
          onCheckedChange={(v) => setPos({ allowDiscount: v })}
        />
        <NumField
          label={L('أقصى نسبة خصم %', 'Max discount %')}
          value={p.maxDiscountPercent}
          min={0}
          max={100}
          onChange={(v) => setPos({ maxDiscountPercent: v })}
          disabled={!p.allowDiscount}
        />
        <NumField
          label={L('حد انخفاض المخزون', 'Low stock threshold')}
          value={p.lowStockThreshold}
          min={0}
          max={10000}
          onChange={(v) => setPos({ lowStockThreshold: v })}
        />
      </div>


      <Separator className="my-4" />

      {/* units of measure manager */}
      <div className="rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold">وحدات القياس (المتجر)</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              الوحدات المتاحة في نماذج الأصناف ونقطة البيع — القيم الافتراضية: قطعة، عبوة، علبة، كيلوجرام، جرام، لتر، مللي
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(p.units?.length ? p.units : ['piece', 'pack', 'box', 'kg', 'g', 'l', 'ml']).map((u) => {
            const lbl = unitLabel(u, lang)
            return (
              <span
                key={u}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary"
              >
                {lbl}
                {lbl !== u && (
                  <span className="font-mono text-[9px] opacity-60" dir="ltr">{u}</span>
                )}
                <button
                  type="button"
                  className="rounded-full p-0.5 text-muted-foreground transition hover:bg-[var(--danger)]/15 hover:text-[var(--danger)]"
                  onClick={() => {
                    const next = (p.units ?? []).filter((x) => x !== u)
                    if (next.length === 0) return // at least one unit must remain
                    setPos({ units: next })
                  }}
                  aria-label={`إزالة وحدة ${u}`}
                  title="إزالة الوحدة"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="w-60">
            <Field label="إضافة وحدة" hint="اسم الوحدة بالعربي أو بالإنجليزي (مثل: كرتونة، طقم، ct)">
              <Input
                value={unitDraft}
                onChange={(e) => setUnitDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const key = unitDraft.trim()
                    if (!key || (p.units ?? []).includes(key)) return
                    setPos({ units: [...(p.units ?? []), key] })
                    setUnitDraft('')
                  }
                }}
                placeholder="مثال: كرتونة، طقم، متر"
                dir="auto"
              />
            </Field>
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 sm:min-h-9"
            disabled={!unitDraft.trim() || (p.units ?? []).includes(unitDraft.trim())}
            onClick={() => {
              const key = unitDraft.trim()
              if (!key || (p.units ?? []).includes(key)) return
              setPos({ units: [...(p.units ?? []), key] })
              setUnitDraft('')
            }}
          >
            <Plus className="me-1 h-4 w-4" />
            إضافة
          </Button>
          {(p.units ?? []).length === 0 && (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 text-xs sm:min-h-9"
              onClick={() => setPos({ units: ['piece', 'pack', 'box', 'kg', 'g', 'l', 'ml'] })}
            >
              استعادة الوحدات الافتراضية
            </Button>
          )}
        </div>
      </div>

      <Separator className="my-4" />

      {/* weighable quantity settings */}
      <div className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
        <NumField
          label={L('عدد خانات كسور الوزن', 'Weight quantity decimals')}
          value={p.weightQtyDecimals ?? 3}
          min={1}
          max={4}
          onChange={(v) => setPos({ weightQtyDecimals: Math.round(v) })}
          hint={L('كميات الأصناف التي تُباع بالوزن (مثل ١٫٢٥٠ كجم)', 'Fractional quantities for weighable products (e.g. 1.250 kg)')}
        />
        <div className="flex items-center">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            مثال: بخانتين — ١٫٢٥ كجم × ٥٩٫٩٠ = ٧٤٫٨٨ ج.م. الأصناف غير الموزونة تُباع بكميات صحيحة دائماً.
          </p>
        </div>
      </div>

      <Separator className="my-4" />

      {/* loyalty program (entitlement-driven — hidden config when unlicensed) */}
      <div className={loyaltyLicensed ? 'rounded-xl border border-primary/25 bg-primary/[0.05] p-4' : 'rounded-xl border border-dashed bg-muted/20 p-4 opacity-70'}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                {L('برنامج نقاط الولاء', 'Loyalty points program')}
                {!loyaltyLicensed && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--warning)]">
                    <Lock className="h-3 w-3" />
                    {L('غير مفعّل في الترخيص', 'Not licensed')}
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {loyaltyLicensed
                  ? L('العميل يكسب نقاطاً على مشترياته ويستبدلها كخصم في نقطة البيع', 'Customers earn points on purchases and redeem them as POS discounts')
                  : L('خطة ترخيصك الحالية لا تشمل برنامج الولاء — تواصل مع مزود النظام للترقية', 'Your current license plan does not include the loyalty program — contact your provider to upgrade')}
              </p>
            </div>
          </div>
          <Switch
            checked={loyaltyLicensed && (p.loyalty?.enabled ?? true)}
            disabled={!loyaltyLicensed}
            onCheckedChange={(v) => setPos({ loyalty: { ...defaultLoyalty(p.loyalty), enabled: v } })}
            aria-label={L('تشغيل الولاء', 'Enable loyalty')}
          />
        </div>
        {loyaltyLicensed && ((p.loyalty?.enabled ?? true)) && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <NumField
              label={L('نقاط لكل ١٠٠ ج.م', 'Points per 100 EGP')}
              value={loyaltyVal(p, 'earnRatePer100', 1)}
              min={0}
              max={100}
              onChange={(v) => setPos({ loyalty: { ...defaultLoyalty(p.loyalty), earnRatePer100: v } })}
            />
            <NumField
              label={L('قيمة النقطة (ج.م)', 'Point value (EGP)')}
              value={loyaltyVal(p, 'pointValueEgp', 0.1)}
              min={0}
              max={10}
              onChange={(v) => setPos({ loyalty: { ...defaultLoyalty(p.loyalty), pointValueEgp: v } })}
            />
            <NumField
              label={L('أقصى نسبة استبدال %', 'Max redeem %')}
              value={Math.round(loyaltyVal(p, 'maxRedeemShare', 0.5) * 100)}
              min={5}
              max={100}
              onChange={(v) => setPos({ loyalty: { ...defaultLoyalty(p.loyalty), maxRedeemShare: v / 100 } })}
              hint={L('من قيمة الفاتورة', 'of invoice total')}
            />
            <NumField
              label={L('أقل نقاط للاستبدال', 'Min points to redeem')}
              value={loyaltyVal(p, 'minRedeemPoints', 10)}
              min={0}
              max={1000}
              onChange={(v) => setPos({ loyalty: { ...defaultLoyalty(p.loyalty), minRedeemPoints: Math.round(v) } })}
            />
          </div>
        )}
        {loyaltyLicensed && (p.loyalty?.enabled ?? true) && (
          <>
            <p className="mt-3 rounded-lg bg-background/60 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
              {L('مثال بالقيم الحالية:', 'Example with current values:')}{' '}
              <span className="font-bold text-foreground">
                100 {L('ج.م', 'EGP')} → {Math.floor(loyaltyVal(p, 'earnRatePer100', 1))} {L('نقطة', 'pts')} →{' '}
                {(loyaltyVal(p, 'pointValueEgp', 0.1) * Math.floor(loyaltyVal(p, 'earnRatePer100', 1))).toFixed(2)} {L('ج.م عند الاستبدال', 'EGP when redeemed')}
              </span>
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <NumField
                label={L('حد البرونزي (نقطة)', 'Bronze tier at')}
                value={loyaltyVal(p, 'tierBronze', 20)}
                min={1}
                max={10000}
                onChange={(v) => setPos({ loyalty: { ...defaultLoyalty(p.loyalty), tierBronze: Math.round(v) } })}
              />
              <NumField
                label={L('حد الفضي (نقطة)', 'Silver tier at')}
                value={loyaltyVal(p, 'tierSilver', 100)}
                min={1}
                max={10000}
                onChange={(v) => setPos({ loyalty: { ...defaultLoyalty(p.loyalty), tierSilver: Math.round(v) } })}
              />
              <NumField
                label={L('حد الذهبي (نقطة)', 'Gold tier at')}
                value={loyaltyVal(p, 'tierGold', 500)}
                min={1}
                max={100000}
                onChange={(v) => setPos({ loyalty: { ...defaultLoyalty(p.loyalty), tierGold: Math.round(v) } })}
              />
            </div>
            <TierPreview loyalty={p.loyalty} L={L} />
          </>
        )}
      </div>

      <Separator className="my-4" />

      <div>
        <p className="mb-2 text-sm font-semibold">{L('طرق الدفع المتاحة', 'Payment methods')}</p>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_PRESETS.map((m) => {
            const active = p.paymentMethods.includes(m)
            return (
              <button
                key={m}
                type="button"
                onClick={() => toggleMethod(m)}
                aria-pressed={active}
                className={
                  'min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold transition sm:min-h-9 ' +
                  (active
                    ? 'border-primary/50 bg-primary/15 text-primary'
                    : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted')
                }
              >
                {paymentLabel(m, lang)}
              </button>
            )
          })}
          {p.paymentMethods
            .filter((m) => !PAYMENT_PRESETS.includes(m as (typeof PAYMENT_PRESETS)[number]))
            .map((m) => (
              <Badge key={m} variant="outline" className="h-8 px-3 text-xs">
                {m}
              </Badge>
            ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {L(
            'الطرق المفعلة تظهر في نقطة البيع — لا يمكن تعطيلها جميعاً.',
            'Enabled methods appear in POS — at least one must stay enabled.'
          )}
        </p>
      </div>

      <div className="mt-4 max-w-xs">
        <Field label={L('طريقة الدفع الافتراضية', 'Default payment method')}>
          <Select value={p.defaultPaymentMethod} onValueChange={(v) => setPos({ defaultPaymentMethod: v })} dir="ltr">
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {p.paymentMethods.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </SectionCard>
  )
}

// ---------------- Inventory ----------------

function InventorySection({
  cfg,
  L,
  canSweep,
}: {
  cfg: SettingsPayload
  L: LFn
  canSweep: boolean
}) {
  const p = cfg.pos

  return (
    <div className="space-y-4">
      <SectionCard
        title={L('إعدادات المخزون الفعالة', 'Active inventory settings')}
        description={L('تُدار من قسم نقطة البيع لتجنب الازدواجية', 'Managed in the POS section to avoid duplication')}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoTile
            label={L('حد انخفاض المخزون', 'Low stock threshold')}
            value={<span className="tabular-nums">{p.lowStockThreshold}</span>}
          />
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          {L(
            'هذان الإعدادان مشتركان بين نقطة البيع والمخزون — عدّلهما من قسم «نقطة البيع».',
            'These two settings are shared with POS — edit them in the POS section.'
          )}
        </p>
      </SectionCard>

    </div>
  )
}

// ---------------- Hardware ----------------

function HardwareSection({
  cfg,
  setCfg,
  canSave,
  L,
  caps,
}: {
  cfg: SettingsPayload
  setCfg: Dispatch<SetStateAction<SettingsPayload | null>>
  canSave: boolean
  L: LFn
  caps: { printer: boolean; scanner: boolean; cashDrawer: boolean } | null
}) {
  const h = cfg.hardware
  const setHw = (patch: Partial<HardwareConfig>) =>
    setCfg((c) => (c ? { ...c, hardware: { ...c.hardware, ...patch } } : c))
  const { toast } = useToast()

  const [testingPrinter, setTestingPrinter] = useState(false)
  const [testingDrawer, setTestingDrawer] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanned, setScanned] = useState<string[]>([])
  const [keyInfo, setKeyInfo] = useState<ScannerKeyInfo | null>(null)
  const scanRef = useRef<ScannerTestHandle | null>(null)

  useEffect(() => () => scanRef.current?.stop(), [])

  async function testPrint() {
    setTestingPrinter(true)
    try {
      const res = await getHardwareProvider(h).printer.testPrint(cfg.business)
      toast({
        title: res.ok ? L('اختبار الطباعة', 'Print test') : L('تعذر الاختبار', 'Test failed'),
        description: res.message,
        variant: res.ok ? undefined : 'destructive',
      })
    } finally {
      setTestingPrinter(false)
    }
  }

  async function testDrawer() {
    setTestingDrawer(true)
    try {
      const res = await getHardwareProvider(h).drawer.test()
      toast({
        title: res.ok ? L('اختبار درج النقدية', 'Drawer test') : L('تعذر الاختبار', 'Test failed'),
        description: res.message,
        variant: res.ok ? undefined : 'destructive',
      })
    } finally {
      setTestingDrawer(false)
    }
  }

  function toggleScannerTest() {
    if (scanning) {
      scanRef.current?.stop()
      scanRef.current = null
      setScanning(false)
      return
    }
    setScanned([])
    setKeyInfo(null)
    scanRef.current = startScannerTest(h, {
      onScan: (code) => setScanned((prev) => [code, ...prev].slice(0, 12)),
      onKey: (info) => setKeyInfo(info),
    })
    setScanning(true)
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title={L('طابعة الإيصالات', 'Receipt printer')}
        description={L(
          'طباعة الإيصالات عبر نافذة طباعة المتصفح — اختر طابعة الإيصالات كافتراضية',
          'Receipts print via the browser dialog — set the receipt printer as default'
        )}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <SwitchField
            label={L('تشغيل الطابعة', 'Enable printer')}
            checked={h.printerEnabled}
            onCheckedChange={(v) => setHw({ printerEnabled: v })}
          />
          <Field label={L('اسم الطابعة', 'Printer name')} hint={L('للعرض في التقارير', 'Shown for reference')}>
            <Input
              value={h.printerName}
              onChange={(e) => setHw({ printerName: e.target.value })}
              placeholder="Default Receipt Printer"
              dir="ltr"
              className="qx-num"
            />
          </Field>
        </div>
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold">{L('عرض الورق (مم)', 'Paper width (mm)')}</p>
          <RadioGroup
            value={String(h.paperWidth)}
            onValueChange={(v) => setHw({ paperWidth: v === '58' ? 58 : 80 })}
            className="flex flex-wrap gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="58" id="pw-58" />
              <Label htmlFor="pw-58" className="cursor-pointer">
                58 مم
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="80" id="pw-80" />
              <Label htmlFor="pw-80" className="cursor-pointer">
                80 مم
              </Label>
            </div>
          </RadioGroup>
        </div>
        <div className="mt-4">
          <Button variant="outline" onClick={() => void testPrint()} disabled={testingPrinter || !h.printerEnabled} className="min-h-11 sm:min-h-9">
            {testingPrinter ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Printer className="me-2 h-4 w-4" />}
            {L('اختبار طباعة', 'Test print')}
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title={L('قارئ الباركود', 'Barcode scanner')}
        description={L(
          'قارئ لوحة المفاتيح (Keyboard Wedge) — يُكتشف تلقائياً من سرعة الكتابة',
          'Keyboard-wedge scanner — detected automatically from typing speed'
        )}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <SwitchField
            label={L('تشغيل القارئ', 'Enable scanner')}
            checked={h.scannerEnabled}
            onCheckedChange={(v) => setHw({ scannerEnabled: v })}
          />
          <Field label={L('لاحقة القارئ', 'Scanner suffix')} hint={L('المفتاح الذي يُنهي المسح', 'Key that ends a scan')}>
            <Select
              value={h.scannerSuffix}
              onValueChange={(v) => setHw({ scannerSuffix: v as HardwareConfig['scannerSuffix'] })}
              dir="ltr"
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Enter">Enter</SelectItem>
                <SelectItem value="Tab">Tab</SelectItem>
                <SelectItem value="None">None</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <NumField
            label={L('أدنى فاصل بين المفاتيح (ms)', 'Min key interval (ms)')}
            value={h.scannerMinIntervalMs}
            min={5}
            max={200}
            onChange={(v) => setHw({ scannerMinIntervalMs: v })}
            hint={L('القارئ يكتب أسرع من الإنسان', 'Scanners type faster than humans')}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant={scanning ? 'destructive' : 'outline'}
            onClick={toggleScannerTest}
            disabled={!h.scannerEnabled}
            className="min-h-11 sm:min-h-9"
          >
            <ScanLine className="me-2 h-4 w-4" />
            {scanning ? L('إيقاف الاختبار', 'Stop test') : L('اختبار القارئ', 'Test scanner')}
          </Button>
          {scanning && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
              </span>
              {L('امسح أي باركود الآن...', 'Scan any barcode now...')}
            </span>
          )}
        </div>

        {scanning && (
          <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="text-xs text-muted-foreground">
              {keyInfo
                ? L(
                    `آخر مفتاح: «${keyInfo.key}» — الفاصل ${keyInfo.gapMs ?? '—'} مللي ثانية ${
                      keyInfo.rapid ? '(سرعة قارئ)' : '(سرعة كتابة عادية)'
                    }`,
                    `last key "${keyInfo.key}" — gap ${keyInfo.gapMs ?? '—'}ms ${keyInfo.rapid ? '(scanner speed)' : '(human speed)'}`
                  )
                : L('بانتظار ضغطات المفاتيح...', 'Waiting for keystrokes...')}
            </p>
            {scanned.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {scanned.map((code, i) => (
                  <li key={i} className="rounded-lg bg-background px-3 py-1.5 font-mono text-xs tabular-nums" dir="ltr">
                    {code} <span className="ms-2 font-sans text-[10px] text-muted-foreground">({code.length})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">{L('لم يُلتقط أي كود بعد', 'No code captured yet')}</p>
            )}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={L('درج النقدية', 'Cash drawer')}
        description={L(
          'نبضة فتح الدرج تُرسل عبر الطابعة عند طباعة الإيصال النقدي',
          'The drawer kick pulse is sent through the printer on cash receipts'
        )}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <SwitchField
            label={L('تشغيل الدرج', 'Enable drawer')}
            checked={h.cashDrawerEnabled}
            onCheckedChange={(v) => setHw({ cashDrawerEnabled: v })}
          />
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => void testDrawer()}
              disabled={testingDrawer || !h.cashDrawerEnabled}
              className="min-h-11 sm:min-h-9"
            >
              {testingDrawer ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Coins className="me-2 h-4 w-4" />}
              {L('اختبار الدرج', 'Test drawer')}
            </Button>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          {L(
            'ملاحظة: اختبار الدرج في المتصفح محاكاة فقط (تنبيه صوتي) — الفتح الفعلي يتم عبر الطابعة المرتبطة بالدرج.',
            'Note: the browser drawer test is a simulation (audible beep) — the real kick happens through the receipt printer.'
          )}
        </p>
      </SectionCard>

      {!canSave && (
        <p className="text-xs text-[var(--warning)]">
          {L('حفظ إعدادات الأجهزة يتطلب صلاحية HARDWARE_MANAGE إضافية.', 'Saving hardware settings requires the extra HARDWARE_MANAGE permission.')}
        </p>
      )}
    </div>
  )
}

// ---------------- Backup settings ----------------

function BackupSection({
  cfg,
  setCfg,
  L,
}: {
  cfg: SettingsPayload
  setCfg: Dispatch<SetStateAction<SettingsPayload | null>>
  L: LFn
}) {
  const setView = useLibraryStore((s) => s.setView)
  const b = cfg.backup
  const setB = (patch: Partial<BackupConfig>) => setCfg((c) => (c ? { ...c, backup: { ...c.backup, ...patch } } : c))

  return (
    <div className="space-y-4">
      <SectionCard
        title={L('النسخ الاحتياطي التلقائي', 'Automatic backups')}
        description={L('تُنشأ نسخة كاملة دورياً عند تشغيل النظام إذا حان موعدها', 'A full snapshot is created on boot when due')}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <SwitchField
            label={L('تشغيل النسخ التلقائي', 'Enable auto backup')}
            checked={b.autoBackupEnabled}
            onCheckedChange={(v) => setB({ autoBackupEnabled: v })}
          />
          <NumField
            label={L('كل (ساعات)', 'Every (hours)')}
            value={b.intervalHours}
            min={1}
            max={720}
            onChange={(v) => setB({ intervalHours: v })}
            disabled={!b.autoBackupEnabled}
          />
          <NumField
            label={L('الاحتفاظ بآخر (نسخ)', 'Keep last (n)')}
            value={b.retentionCount}
            min={1}
            max={100}
            onChange={(v) => setB({ retentionCount: v })}
          />
        </div>
      </SectionCard>
      <SectionCard title={L('إدارة النسخ', 'Manage backups')}>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <p className="text-xs text-muted-foreground">
            {L(
              'إنشاء نسخة يدوية أو استعادة نسخة موجودة يتم من شاشة «النسخ الاحتياطي» في قسم النظام.',
              'Creating or restoring backups happens in the Backup screen under the System section.'
            )}
          </p>
          <Button variant="outline" size="sm" onClick={() => setView('backup')} className="min-h-11 sm:min-h-9 sm:ms-auto">
            <DatabaseBackup className="me-2 h-4 w-4" />
            {L('فتح شاشة النسخ الاحتياطي', 'Open backup screen')}
          </Button>
        </div>
      </SectionCard>
    </div>
  )
}

// ---------------- Localization ----------------

function LocalizationSection({
  cfg,
  setCfg,
  L,
}: {
  cfg: SettingsPayload
  setCfg: Dispatch<SetStateAction<SettingsPayload | null>>
  L: LFn
}) {
  const loc = cfg.localization
  const setLoc = (patch: Partial<LocalizationConfig>) =>
    setCfg((c) => (c ? { ...c, localization: { ...c.localization, ...patch } } : c))
  const setPos = (patch: Partial<PosConfig>) => setCfg((c) => (c ? { ...c, pos: { ...c.pos, ...patch } } : c))

  return (
    <SectionCard
      title={L('اللغة والتنسيق', 'Language & format')}
      description={L('لغة الواجهة والمنطقة الزمنية وتنسيق الأرقام والعملة', 'UI language, timezone, numeral system and currency')}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={L('اللغة', 'Language')} hint={L('تُطبق بعد الحفظ على الواجهة كلها', 'Applies to the whole UI after save')}>
          <Select value={loc.language} onValueChange={(v) => setLoc({ language: v as 'ar' | 'en' })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ar">العربية</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={L('تنسيق الأرقام', 'Numeral system')} hint="latn = 123 — arab = ١٢٣">
          <Select value={loc.numberFormat} onValueChange={(v) => setLoc({ numberFormat: v as 'latn' | 'arab' })} dir="ltr">
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latn">latn (123)</SelectItem>
              <SelectItem value="arab">arab (١٢٣)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={L('المنطقة الزمنية', 'Timezone')} hint={L('IANA — مثل Africa/Cairo', 'IANA — e.g. Africa/Cairo')}>
          <Input
            value={loc.timezone}
            onChange={(e) => setLoc({ timezone: e.target.value })}
            placeholder="Africa/Cairo"
            dir="ltr"
            className="qx-num"
          />
        </Field>
        <Field label={L('رمز العملة', 'Currency symbol')} hint={L('يُستخدم في كل المبالغ', 'Used across all amounts')}>
          <Input value={cfg.pos.currencySymbol} onChange={(e) => setPos({ currencySymbol: e.target.value })} placeholder="ج.م" />
        </Field>
      </div>
    </SectionCard>
  )
}

// ---------------- shared small parts ----------------

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold">
        {label}
        {required && <span className="ms-1 text-[var(--danger)]">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

function NumField({
  label,
  value,
  onChange,
  min,
  max,
  hint,
  disabled,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  hint?: string
  disabled?: boolean
}) {
  return (
    <Field label={label} hint={hint}>
      <Input
        type="number"
        dir="ltr"
        className="qx-num tabular-nums"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(n)
        }}
      />
    </Field>
  )
}

function SwitchField({
  label,
  checked,
  onCheckedChange,
  disabled,
  locked,
}: {
  label: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
  locked?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border p-3.5">
      <Label className={locked ? 'flex items-center gap-1.5 text-sm font-medium text-muted-foreground' : 'cursor-pointer text-sm font-medium'}>
        {locked && <Lock className="h-3.5 w-3.5 text-[var(--warning)]" aria-label="غير مفعّل في الترخيص" />}
        {label}
      </Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} aria-label={label} />
    </div>
  )
}

function InfoTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  )
}
