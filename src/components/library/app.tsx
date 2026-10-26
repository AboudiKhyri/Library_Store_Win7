'use client'

/**
 * LIBRARY_STORE — Main Application Shell
 * 100% Offline Standalone Architecture
 */

import { useEffect, useState, ReactNode } from 'react'
import Image from 'next/image'
import { Spinner } from '@/components/ui/spinner'
import { useLibraryStore } from './store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { NAV_SECTIONS, isItemVisible } from './nav'
import { CommandPalette, useCommandPaletteHotkey } from './parts/command-palette'
import { AlertTicker } from './parts/alert-ticker'
import { ShortcutsHelpOverlay } from './parts/shortcuts-help'
import { GuidedTour } from './parts/guided-tour'
import {
  Menu,
  Moon,
  Sun,
  Languages,
  LogOut,
  ChevronLeft,
  PanelRightClose,
  PanelRightOpen,
  Loader2,
  Search,
  Keyboard,
  Sparkles,
} from 'lucide-react'
import type { SystemStatus, SessionUser } from '@/lib/library/types'

// screens
import { DashboardScreen } from './screens/dashboard'
import { AboutScreen } from './screens/about'
import { ProductsScreen } from './screens/products'
import { CategoriesScreen } from './screens/categories'
import { SuppliersScreen } from './screens/suppliers'
import { CustomersScreen } from './screens/customers'
import { PosScreen } from './screens/pos'
import { SalesHistoryScreen } from './screens/sales-history'
import { ReturnsScreen } from './screens/returns'
import { PurchasesScreen } from './screens/purchases'
import { InventoryScreen } from './screens/inventory'
import { StocktakeScreen } from './screens/stocktake'
import { ReportsScreen } from './screens/reports'
import { UsersScreen } from './screens/users'
import { RolesScreen } from './screens/roles'
import { SettingsScreen } from './screens/settings'
import { BackupScreen } from './screens/backup'
import { DiagnosticsScreen } from './screens/diagnostics'
import { AuditScreen } from './screens/audit'
import { LoginScreen } from './screens/login'

const VIEW_COMPONENTS: Record<string, ReactNode> = {
  dashboard: <DashboardScreen />,
  pos: <PosScreen />,
  'sales-history': <SalesHistoryScreen />,
  returns: <ReturnsScreen />,
  products: <ProductsScreen />,
  categories: <CategoriesScreen />,
  inventory: <InventoryScreen />,
  stocktake: <StocktakeScreen />,
  purchases: <PurchasesScreen />,
  suppliers: <SuppliersScreen />,
  customers: <CustomersScreen />,
  reports: <ReportsScreen />,
  users: <UsersScreen />,
  roles: <RolesScreen />,
  settings: <SettingsScreen />,
  backup: <BackupScreen />,
  diagnostics: <DiagnosticsScreen />,
  audit: <AuditScreen />,
  about: <AboutScreen />,
}

function SplashScreen() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 shadow-xl ring-1 ring-primary/30">
          <Image src="/logo.png" alt="Library Store" width={40} height={40} className="object-contain" priority />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Library Store</h1>
          <p className="text-xs text-muted-foreground">نظام إدارة المتاجر والمبيعات — وضع دون اتصال</p>
        </div>
        <div className="mt-4 flex flex-col items-center gap-2">
          <div className="h-[20px] w-[246px] rounded-[4px] border-[1.5px] border-[#0078d7] dark:border-primary/80 bg-[#f1f5f9] dark:bg-muted/40 overflow-hidden relative shadow-inner">
            <div className="absolute top-0 bottom-0 bg-[#0078d7] dark:bg-primary rounded-[2px] animate-simple-progress" />
          </div>
          <span className="text-xs font-semibold text-primary">جاري التحميل...</span>
        </div>
      </div>
    </div>
  )
}

function MainApp({ status, session }: { status: SystemStatus; session: SessionUser }) {
  const t = useLibraryStore((s) => s.t)
  const view = useLibraryStore((s) => s.view)
  const setView = useLibraryStore((s) => s.setView)
  const lang = useLibraryStore((s) => s.lang)
  const setLang = useLibraryStore((s) => s.setLang)
  const theme = useLibraryStore((s) => s.theme)
  const setTheme = useLibraryStore((s) => s.setTheme)
  const sidebarOpen = useLibraryStore((s) => s.sidebarOpen)
  const toggleSidebar = useLibraryStore((s) => s.toggleSidebar)
  const sidebarCollapsed = useLibraryStore((s) => s.sidebarCollapsed)
  const setSidebarCollapsed = useLibraryStore((s) => s.setSidebarCollapsed)
  const logout = useLibraryStore((s) => s.logout)

  const [paletteOpen, setPaletteOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)

  useCommandPaletteHotkey(() => setPaletteOpen(true))

  const displayName = status.business?.displayName || status.business?.businessName || 'Library Store'
  const appName = status.branding?.appName || 'Library Store'

  const navSections = (NAV_SECTIONS ?? []).map((s) => ({
    ...s,
    items: (s?.items ?? []).filter((item) => isItemVisible(item, session, status)),
  })).filter((s) => s.items.length > 0)

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden shrink-0 flex-col border-e bg-[var(--sidebar)] transition-all duration-200 lg:flex',
          sidebarCollapsed ? 'w-[4.25rem]' : 'w-64'
        )}
      >
        <SidebarContent collapsed={sidebarCollapsed} sections={navSections} view={view} onSelect={setView} status={status} />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={(v) => !v && toggleSidebar()}>
        <SheetContent side="right" className="w-72 p-0 bg-[var(--sidebar)]">
          <SheetTitle className="sr-only">القائمة</SheetTitle>
          <SidebarContent collapsed={false} sections={navSections} view={view} onSelect={setView} status={status} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur sm:px-4">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={toggleSidebar} aria-label="القائمة">
            <Menu className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:flex"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label="طي القائمة"
          >
            {sidebarCollapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
          </Button>



          <div className="ms-auto flex items-center gap-1">
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden h-9 items-center gap-2 rounded-lg border bg-muted/40 px-3 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground sm:flex"
              aria-label="البحث الشامل"
            >
              <Search className="h-3.5 w-3.5" />
              <span>{lang === 'ar' ? 'بحث سريع...' : 'Quick search...'}</span>
              <kbd className="rounded border bg-background px-1 font-mono text-[10px] font-semibold">Ctrl K</kbd>
            </button>
            <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setPaletteOpen(true)} aria-label="البحث الشامل">
              <Search className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setHelpOpen(true)} aria-label="اختصارات لوحة المفاتيح" title="اختصارات لوحة المفاتيح (?)">
              <Keyboard className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} aria-label="اللغة">
              <Languages className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="المظهر"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary ring-1 ring-primary/30">
                    {session.displayName.slice(0, 1)}
                  </div>
                  <div className="hidden text-start leading-tight sm:block">
                    <p className="text-xs font-semibold">{session.displayName}</p>
                    <p className="text-[10px] text-muted-foreground">{lang === 'ar' ? session.roleNameAr : session.roleNameEn}</p>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>
                  <p className="text-sm font-semibold">{session.displayName}</p>
                  <p className="text-xs font-normal text-muted-foreground">{session.username}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setTourOpen(true)}>
                  <Sparkles className="me-2 h-4 w-4" />
                  جولة تعريفية بالنظام
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-[var(--danger)] focus:text-[var(--danger)]"
                  onClick={() => void logout()}
                >
                  <LogOut className="me-2 h-4 w-4" />
                  تسجيل الخروج
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Proactive operational alerts (low stock / near expiry) */}
        <AlertTicker />

        {/* Content — animated view transitions */}
        <main className="qx-scroll flex-1 overflow-y-auto p-4 sm:p-6">
          <div key={view} className="view-transition">
            {VIEW_COMPONENTS[view] ?? VIEW_COMPONENTS.dashboard}
          </div>
        </main>

        {/* Sticky footer */}
        <footer className="flex h-8 shrink-0 items-center justify-between gap-2 border-t bg-background px-4 text-[11px] text-muted-foreground">
          <span className="truncate">Library Store · © 2026 Library Store · All rights reserved</span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="font-bold text-primary">Library Store</span>
            <span className="tabular-nums opacity-70">v{status?.version ?? '1.0.1'}</span>
          </span>
        </footer>
      </div>

      {/* Global command palette (Ctrl+K) */}
      <CommandPalette open={paletteOpen} setOpen={setPaletteOpen} />

      {/* Keyboard shortcuts help (?) */}
      <ShortcutsHelpOverlay open={helpOpen} setOpen={setHelpOpen} />

      {/* Onboarding guided tour */}
      <GuidedTour open={tourOpen} onClose={() => setTourOpen(false)} />
    </div>
  )
}

// ---------------- Sidebar ----------------

function formatSidebarDate(lang: string = 'ar'): string {
  try {
    const now = new Date()
    if (lang === 'en') {
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(now)
    }
    return new Intl.DateTimeFormat('ar-u-nu-latn', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now).replace('،', '')
  } catch {
    return new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')
  }
}

function SidebarContent({
  collapsed,
  sections,
  view,
  onSelect,
  status,
}: {
  collapsed: boolean
  sections: { titleKey: string; items: { view: string; labelKey: string; icon: React.ComponentType<{ className?: string }>; permission?: string; module?: string }[] }[]
  view: string
  onSelect: (view: string) => void
  status: SystemStatus
}) {
  const t = useLibraryStore((s) => s.t)
  const lang = useLibraryStore((s) => s.lang)
  const [todayDate, setTodayDate] = useState(() => formatSidebarDate(lang))

  useEffect(() => {
    setTodayDate(formatSidebarDate(lang))
    const timer = setInterval(() => {
      setTodayDate(formatSidebarDate(lang))
    }, 60000)
    return () => clearInterval(timer)
  }, [lang])

  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-14 items-center gap-2 border-b px-4', collapsed && 'justify-center px-0')}>
        {status?.branding?.logoDataUrl ? (
          <img src={status?.branding?.logoDataUrl} alt="Library Store" className="h-7 w-7 rounded-lg object-contain" />
        ) : (
          <Image src="/logo.png" alt="Library Store" width={28} height={28} className="rounded-lg object-contain" />
        )}
        {!collapsed && (
          <div className="leading-tight">
            <p className="text-sm font-extrabold tracking-wide">{status?.business?.displayName || status?.branding?.appName || 'Library Store'}</p>
            <p className="text-[10px] text-muted-foreground">{status?.business?.businessName || (status?.branding as any)?.tagline || 'نظام إدارة المتاجر'}</p>
          </div>
        )}
      </div>
      <nav className="qx-scroll flex-1 space-y-4 overflow-y-auto p-2" aria-label="التنقل الرئيسي">
        {(sections ?? []).map((section) => (
          <div key={section.titleKey}>
            {!collapsed && (
              <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                {t(section.titleKey)}
              </p>
            )}
            <ul className="space-y-0.5">
              {(section?.items ?? []).map((item) => {
                const Icon = item.icon
                const active = view === item.view
                return (
                  <li key={item.view}>
                    <button
                      onClick={() => onSelect(item.view)}
                      title={collapsed ? t(item.labelKey) : undefined}
                      className={cn(
                        'group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition',
                        active
                          ? 'bg-primary/15 text-primary font-bold shadow-sm ring-1 ring-primary/30'
                          : 'text-[var(--sidebar-foreground)]/80 hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]',
                        collapsed && 'justify-center px-0'
                      )}
                      aria-current={active ? 'page' : undefined}
                    >
                      <Icon className={cn('h-4.5 w-4.5 shrink-0', active ? 'text-primary' : 'opacity-80 group-hover:opacity-100')} />
                      {!collapsed && <span className={cn('truncate', active ? 'font-bold text-primary' : '')}>{t(item.labelKey)}</span>}
                      {!collapsed && active && <ChevronLeft className="ms-auto h-3.5 w-3.5 rtl:rotate-0 ltr:rotate-180 text-primary" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t p-3">
        <div
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-muted-foreground',
            collapsed && 'justify-center px-0'
          )}
        >
          {!collapsed && <span className="truncate">{todayDate}</span>}
        </div>
      </div>
    </div>
  )
}

export function LibraryStoreApp({
  initialStatus,
  initialSession,
}: {
  initialStatus: SystemStatus | null
  initialSession: SessionUser | null
}) {
  const booted = useLibraryStore((s) => s.booted)
  const boot = useLibraryStore((s) => s.boot)
  const initServerData = useLibraryStore((s) => s.initServerData)
  const status = useLibraryStore((s) => s.status) || initialStatus
  const session = useLibraryStore((s) => s.session) ?? initialSession

  useEffect(() => {
    if (initialStatus) {
      initServerData(initialStatus, initialSession)
    } else {
      void boot()
    }
  }, [initialStatus, initialSession, initServerData, boot])

  // Startup Flow: Neutral splash while booting -> Login screen -> Main App
  // While booted is false or status is not yet loaded, render neutral splash screen
  if (!booted || !status) {
    return <SplashScreen />
  }

  // Gate: Unauthenticated users MUST see ONLY LoginScreen. Never render shell, sidebar, or dashboard.
  if (!session) {
    return <LoginScreen />
  }

  return <MainApp status={status} session={session} />
}

export default LibraryStoreApp
export type { SystemStatus, SessionUser }
