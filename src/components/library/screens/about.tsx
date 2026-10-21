'use client'

/**
 * LIBRARY_STORE — About & System Info Screen
 * 100% Offline Standalone Architecture
 */

import Image from 'next/image'
import { useLibraryStore } from '../store'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Info, Store, ShieldCheck, Database, HardDrive } from 'lucide-react'
import { PageHeader } from '../parts/kit'

export function AboutScreen() {
  const status = useLibraryStore((s) => s.status)!
  const t = useLibraryStore((s) => s.t)

  const storeName = status?.business?.displayName || status?.business?.businessName || 'المتجر الرئيسي'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={t('nav.about')} description="معلومات وهوية النظام" icon={<Info className="h-5 w-5" />} />

      {/* Hero Card */}
      <Card className="relative overflow-hidden border-primary/20">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/15 to-transparent" />
        <div className="pointer-events-none absolute -bottom-20 start-1/2 h-52 w-52 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <CardContent className="relative flex flex-col items-center gap-5 p-8 text-center sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">نظام إدارة نقاط البيع والمتاجر</p>

          <div className="relative">
            <div className="absolute inset-0 rounded-3xl bg-primary/30 blur-2xl" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-card shadow-2xl ring-1 ring-primary/30">
              <Image
                src="/logo.png"
                alt="Library Store Logo"
                width={64}
                height={64}
                className="relative object-contain"
                priority
              />
            </div>
          </div>

          <div>
            <h1 className="text-3xl font-black tracking-wide">
              Library <span className="text-primary qx-glow-text">Store</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">نظام مستقل بنسبة 100% دون اتصال بالإنترنت</p>
          </div>

          <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Store className="h-3.5 w-3.5" />
            المنشأة: {storeName}
          </p>

          <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
            إدارة نقاط البيع · المخزون والدفعات · المشتريات والموردين · العملاء والولاء · التقارير المالية والضريبية · النسخ الاحتياطي المحلي
          </p>

          <Separator className="w-24" />

          <div className="grid w-full max-w-md grid-cols-2 gap-3 text-start sm:grid-cols-3">
            <AboutField label="المنتج" value="Library Store" />
            <AboutField label="الإصدار" value={`v${status?.version ?? '1.0.0'}`} mono />
            <AboutField label="البناء" value={status?.build ?? '2026092201'} mono />
          </div>
        </CardContent>
      </Card>

      {/* System & Architecture Card */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <p className="text-sm font-bold text-primary">المعمارية وحالة التشغيل</p>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <AboutField
              label="نمط التشغيل"
              value="مستقل أوفلاين (Offline-First)"
              badge={
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-400">
                  <ShieldCheck className="me-1 h-3 w-3" /> نشط محلياً
                </Badge>
              }
            />
            <AboutField label="قاعدة البيانات" value="SQLite (WAL Mode)" mono />
            <AboutField label="محرك الخادم" value="Node.js Standalone" mono />
            <AboutField label="الوصول للشبكة" value="محلي فقط (127.0.0.1)" />
          </div>
          <div className="rounded-lg bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
            يعمل هذا النظام باستقلالية كاملة دون الحاجة إلى اتصال بالإنترنت أو الاعتماد على أي خوادم خارجية. يتم تخزين جميع البيانات والعمليات محلياً على جهازك بأعلى درجات الخصوصية والأمان.
          </div>
        </CardContent>
      </Card>

      <p className="pb-4 text-center text-[11px] text-muted-foreground">
        © 2026 Library Store — جميع الحقوق محفوظة
      </p>
    </div>
  )
}

function AboutField({
  label,
  value,
  mono,
  badge,
}: {
  label: string
  value: string
  mono?: boolean
  badge?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border bg-card/60 p-3">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className={`text-sm font-semibold ${mono ? 'font-mono' : ''}`}>{value}</p>
        {badge}
      </div>
    </div>
  )
}
