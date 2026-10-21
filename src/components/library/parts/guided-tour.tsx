'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — onboarding guided tour for Library_Store (Arabic RTL)
// Runs ONCE after first setup (auto-flag stored in localStorage) and can be
// reopened anytime from the user menu («جولة تعريفية بالنظام»).
// Controls: التالي / السابق / تخطي / إنهاء.
import { useEffect, useMemo, useState } from 'react'
import { useLibraryStore } from '../store'
import { Button } from '@/components/ui/button'
import {
  ShoppingCart,
  Package,
  Boxes,
  Truck,
  RotateCcw,
  BarChart3,
  Settings,
  Printer,
  DatabaseBackup,
  Users,
  KeyRound,
  ArrowRight,
  ArrowLeft,
  X,
} from 'lucide-react'

export interface TourStep {
  id: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  body: string
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    icon: KeyRound,
    title: 'أهلاً بك في Library Store 👋',
    body: 'جولة سريعة تعرّفك بأهم أجزاء النظام. يمكنك تخطي الجولة الآن وإعادة فتحها في أي وقت من قائمة المستخدم أعلى الشاشة.',
  },
  {
    id: 'pos',
    icon: ShoppingCart,
    title: 'نقطة البيع (POS)',
    body: 'شاشة البيع اليومي: امسح الباركود أو ابحث بالاسم أو الوزن، النظام يخصم المخزون تلقائياً ويطبع الإيصال ويفتح درج النقود.',
  },
  {
    id: 'products',
    icon: Package,
    title: 'الأصناف والأوزان',
    body: 'إدارة أصناف السوبرماركت: كرتونة صغيرة وكبيرة، أصناف بالوزن بالكيلو، باركود لكل صنف، مع تنبيهات المخزون المنخفض.',
  },
  {
    id: 'inventory',
    icon: Boxes,
    title: 'المخزون والجرد',
    body: 'متابعة الأرصدة وحركات المخزون، تسويات الفاقد، وجلسات الجرد الدوري مع مقارنة الكميات الفعلية بالنظامية.',
  },
  {
    id: 'purchases',
    icon: Truck,
    title: 'فواتير الشراء والموردين',
    body: 'سجّل فواتير الشراء واستلمها لتُضاف الكميات للمخزون تلقائياً وتُحدَّث أسعار التكلفة، مع ملف كامل لكل مورد.',
  },
  {
    id: 'returns',
    icon: RotateCcw,
    title: 'المرتجعات',
    body: 'مرتجعات البيع تُعاد لنفس الدفعة الأصلية (تتبع المرتجعات وأسبابها)، ومرتجعات الشراء تُخصم من المخزون مع حفظ السبب.',
  },
  {
    id: 'reports',
    icon: BarChart3,
    title: 'التقارير',
    body: 'تقارير المبيعات والأرباح وحركة الأصناف والأكثر مبيعاً — كلها بفلاتر تاريخ قابلة للتصدير والطباعة.',
  },
  {
    id: 'settings',
    icon: Settings,
    title: 'الإعدادات والهوية',
    body: 'بيانات السوبرماركت وشعاره وألوان الفاتورة وإعدادات الطباعة وولاء العملاء — كل ما يخص هوية متجرك في مكان واحد.',
  },
  {
    id: 'hardware',
    icon: Printer,
    title: 'الأجهزة الطرفية',
    body: 'سكانر الباركود وطابعة الإيصالات ودرج النقود — فعّل ما لديك فقط؛ النظام يعمل أيضاً بدون أي أجهزة إضافية.',
  },
  {
    id: 'backup',
    icon: DatabaseBackup,
    title: 'النسخ الاحتياطي',
    body: 'نسخ احتياطي كامل بضغطة واحدة (أو تلقائي حسب الجدولة) مع إمكانية الاستعادة الآمنة في أي وقت — بياناتك ملكك.',
  },
  {
    id: 'users',
    icon: Users,
    title: 'المستخدمون والصلاحيات',
    body: 'أنشئ حسابات لفريق العمل (مديرين، كاشير، مخزني) بحدود صلاحيات دقيقة، وكل عملية تُسجَّل في سجل التدقيق باسم صاحبها.',
  },
]

export function GuidedTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  // remount-on-open resets the tour (key={String(open)} below avoids setState-in-effect)
  return open ? <GuidedTourInner onClose={onClose} /> : null
}

function GuidedTourInner({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const setView = useLibraryStore((s) => s.setView)

  const current = useMemo(() => TOUR_STEPS[step], [step])
  if (!current) return null

  const isLast = step === TOUR_STEPS.length - 1
  const Icon = current.icon

  function finish() {
    try {
      localStorage.setItem('qx-tour-seen', new Date().toISOString())
    } catch {
      // storage unavailable — tour simply won't auto-open again this session
    }
    onClose()
  }

  function goTo(view: string) {
    setView(view)
    finish()
  }

  const stepViews: Record<string, string> = {
    pos: 'pos',
    products: 'products',
    inventory: 'inventory',
    purchases: 'purchases',
    returns: 'returns',
    reports: 'reports',
    settings: 'settings',
    backup: 'backup',
    users: 'users',
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="جولة تعريفية"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border/60 bg-background shadow-2xl">
        {/* header */}
        <div className="relative flex items-center gap-3 border-b bg-gradient-to-b from-primary/10 to-transparent p-4">
          <div className="rounded-xl bg-primary/15 p-2.5">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-primary">الجولة التعريفية</p>
            <h3 className="truncate text-base font-bold">{current.title}</h3>
          </div>
          <button
            onClick={finish}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="إغلاق الجولة"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* body */}
        <div className="p-5">
          <p className="min-h-[72px] text-sm leading-relaxed text-muted-foreground">{current.body}</p>

          {/* progress */}
          <div className="mt-4 flex items-center gap-1.5" aria-hidden>
            {TOUR_STEPS.map((s, i) => (
              <span
                key={s.id}
                className={
                  'h-1.5 flex-1 rounded-full transition-all ' +
                  (i < step ? 'bg-primary/60' : i === step ? 'bg-primary' : 'bg-muted')
                }
              />
            ))}
          </div>
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
            {step + 1} / {TOUR_STEPS.length}
          </p>
        </div>

        {/* controls */}
        <div className="flex items-center gap-2 border-t bg-muted/30 p-3">
          {step > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)}>
              <ArrowRight className="me-1 h-4 w-4" />
              السابق
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={finish}>
              تخطي
            </Button>
          )}

          <div className="ms-auto flex items-center gap-2">
            {stepViews[current.id] && (
              <Button variant="outline" size="sm" onClick={() => goTo(stepViews[current.id])}>
                فتح الشاشة
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={finish}>
                إنهاء
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep((s) => s + 1)}>
                التالي
                <ArrowLeft className="ms-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* footer credit */}
        <div className="flex items-center justify-center gap-1.5 border-t p-2 text-[10px] text-muted-foreground">
          Library Store · Offline POS
        </div>
      </div>
    </div>
  )
}
