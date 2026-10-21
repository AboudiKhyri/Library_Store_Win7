'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Command Palette (Ctrl+K)
// Global keyboard-first launcher: navigation, product search, quick actions.
// Products are searched live via API (server-side indexed queries) — the palette
// never loads the whole catalog (spec §34: search must stay fast with thousands of products).

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useLibraryStore } from '../store'
import { api } from '../api'
import { cn } from '@/lib/utils'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Undo2,
  Package,
  Tags,
  Boxes,
  ClipboardList,
  Truck,
  Building2,
  Users,
  BarChart3,
  UserCog,
  ShieldCheck,
  Settings,
  DatabaseBackup,
  Activity,
  KeyRound,
  ScrollText,
  Info,
  Search,
  Plus,
  Zap,
  ArrowLeft,
  Moon,
  Sun,
  Languages,
} from 'lucide-react'
import { NAV_SECTIONS, isItemVisible } from '../nav'

interface ProductHit {
  id: string
  nameAr: string
  sku: string
  barcode: string | null
  sellingPrice: number
  stockAvailable: number
}

export function CommandPalette({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const t = useLibraryStore((s) => s.t)
  const lang = useLibraryStore((s) => s.lang)
  const status = useLibraryStore((s) => s.status)
  const session = useLibraryStore((s) => s.session)
  const setView = useLibraryStore((s) => s.setView)
  const setTheme = useLibraryStore((s) => s.setTheme)
  const theme = useLibraryStore((s) => s.theme)
  const setLang = useLibraryStore((s) => s.setLang)
  const money = useLibraryStore((s) => s.money)

  const [query, setQuery] = useState('')
  const [products, setProducts] = useState<ProductHit[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // live product search (debounced, abortable — spec §34)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!open || query.trim().length < 2) {
      setProducts([])
      setLoadingProducts(false)
      return
    }
    setLoadingProducts(true)
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const data = await api<{ items: ProductHit[] }>(
          `/products?q=${encodeURIComponent(query.trim())}&pageSize=6&active=true`,
          { signal: controller.signal }
        )
        setProducts(data.items)
      } catch {
        // aborted or offline — keep previous results
      } finally {
        setLoadingProducts(false)
      }
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, open])

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const navigate = useCallback(
    (view: string) => {
      setOpen(false)
      setView(view)
    },
    [setOpen, setView]
  )

  if (!status || !session) return null

  // permission + module gated navigation items
  const navItems = NAV_SECTIONS.flatMap((section) =>
    section.items
      .filter((item) => isItemVisible(item, session, status))
      .map((item) => ({ ...item, sectionTitle: t(section.titleKey) }))
  )

  const can = (p: string) => session.permissions.includes(p as never)
  const modules = status.modules

  // quick actions (permission-gated)
  const actions: { id: string; labelAr: string; icon: React.ComponentType<{ className?: string }>; run: () => void; show: boolean; shortcut?: string }[] = [
    { id: 'new-sale', labelAr: 'فاتورة بيع جديدة', icon: ShoppingCart, run: () => navigate('pos'), show: can('SALES_CREATE') && !!modules.pos, shortcut: 'F2' },
    { id: 'new-product', labelAr: 'إضافة صنف جديد', icon: Plus, run: () => { setOpen(false); setView('products', { openCreate: true }) }, show: can('PRODUCT_CREATE') && !!modules.supermarket },
    { id: 'new-purchase', labelAr: 'فاتورة شراء جديدة', icon: Truck, run: () => { setOpen(false); setView('purchases', { openCreate: true }) }, show: can('PURCHASE_CREATE') && !!modules.purchasing },
    { id: 'backup-now', labelAr: 'إنشاء نسخة احتياطية', icon: DatabaseBackup, run: () => { setOpen(false); setView('backup', { createNow: true }) }, show: can('BACKUP_MANAGE') },
    { id: 'toggle-theme', labelAr: theme === 'dark' ? 'التبديل للمظهر الفاتح' : 'التبديل للمظهر الداكن', icon: theme === 'dark' ? Sun : Moon, run: () => setTheme(theme === 'dark' ? 'light' : 'dark'), show: true, shortcut: 'Ctrl+J' },
    { id: 'toggle-lang', labelAr: lang === 'ar' ? 'Switch to English' : 'التبديل للعربية', icon: Languages, run: () => setLang(lang === 'ar' ? 'en' : 'ar'), show: true },
  ].filter((a) => a.show)

  return (
    <CommandDialog open={open} onOpenChange={setOpen} className="max-w-xl">
      <CommandInput
        placeholder={lang === 'ar' ? 'ابحث عن شاشة أو صنف أو إجراء سريع...' : 'Search screens, products or quick actions...'}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="qx-scroll max-h-[70vh]">
        <CommandEmpty>{loadingProducts ? 'جارٍ البحث...' : lang === 'ar' ? 'لا توجد نتائج مطابقة' : 'No matching results'}</CommandEmpty>

        {/* quick actions */}
        {actions.length > 0 && (
          <CommandGroup heading={lang === 'ar' ? 'إجراءات سريعة' : 'Quick actions'}>
            {actions.map((action) => {
              const Icon = action.icon
              return (
                <CommandItem key={action.id} value={`action ${action.labelAr}`} onSelect={() => action.run()}>
                  <Icon className="me-2 h-4 w-4 shrink-0 text-primary" />
                  <span className="flex-1">{action.labelAr}</span>
                  {action.shortcut && <CommandShortcut>{action.shortcut}</CommandShortcut>}
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}

        {/* live product search results */}
        {(products.length > 0 || loadingProducts) && query.trim().length >= 2 && can('PRODUCT_VIEW') && (
          <>
            <CommandSeparator />
            <CommandGroup heading={lang === 'ar' ? 'الأصناف' : 'Products'}>
              {loadingProducts && products.length === 0 && (
                <div className="px-2 py-3 text-xs text-muted-foreground">جارٍ البحث في الأصناف...</div>
              )}
              {products.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`product ${p.nameAr} ${p.sku} ${p.barcode ?? ''}`}
                  onSelect={() => {
                    setOpen(false)
                    if (can('SALES_CREATE') && modules.pos) {
                      setView('pos', { productId: p.id })
                    } else {
                      setView('products', { focusId: p.id })
                    }
                  }}
                >
                  <Package className="me-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.nameAr}</p>
                      <p dir="ltr" className="truncate font-mono text-[10px] text-muted-foreground">
                        {p.sku}
                        {p.barcode ? ` · ${p.barcode}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                          p.stockAvailable <= 5 ? 'bg-[var(--danger)]/15 text-[var(--danger)]' : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {p.stockAvailable}
                      </span>
                      <span className="text-xs font-bold tabular-nums text-primary">{money(p.sellingPrice)}</span>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* navigation */}
        <CommandSeparator />
        <CommandGroup heading={lang === 'ar' ? 'التنقل' : 'Navigation'}>
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <CommandItem key={item.view} value={`nav ${t(item.labelKey)} ${item.sectionTitle}`} onSelect={() => navigate(item.view)}>
                <Icon className="me-2 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1">{t(item.labelKey)}</span>
                <span className="text-[10px] text-muted-foreground/60">{item.sectionTitle}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>

      <div className="flex items-center justify-between border-t px-3 py-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-2">
          <kbd className="rounded border bg-muted px-1 font-mono">↑↓</kbd> تنقل
          <kbd className="rounded border bg-muted px-1 font-mono">Enter</kbd> اختيار
          <kbd className="rounded border bg-muted px-1 font-mono">Esc</kbd> إغلاق
        </span>
        <span className="flex items-center gap-1">
          <Zap className="h-3 w-3 text-primary" />
          LIBRARY COMMAND
        </span>
      </div>
    </CommandDialog>
  )
}

/** Hook: global keyboard listener for the palette (Ctrl+K / Cmd+K). */
export function useCommandPaletteHotkey(setOpen: (v: boolean) => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setOpen])
}
