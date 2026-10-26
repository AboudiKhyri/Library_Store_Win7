'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Keyboard shortcut help overlay
// Press "?" (or Shift+/) anywhere in the app for a cheat sheet of global and
// screen-specific shortcuts. Context-aware: POS shortcuts only shown on POS, etc.

import { useEffect, useState, useCallback } from 'react'
import { useLibraryStore } from '../store'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Keyboard, Command, ShoppingCart, LayoutDashboard, Search, Moon, Sun, Languages } from 'lucide-react'
import { Kbd } from './kit'

interface ShortcutDef {
  keys: string[]
  ar: string
  en: string
  scope: 'global' | 'pos' | 'palette'
}

const SHORTCUTS: ShortcutDef[] = [
  { keys: ['Ctrl', 'K'], ar: 'البحث الشامل — التنقل والأصناف والإجراءات', en: 'Command palette — nav, products, actions', scope: 'global' },
  { keys: ['?'], ar: 'عرض هذه المساعدة', en: 'Show this help', scope: 'global' },
  { keys: ['Ctrl', 'J'], ar: 'تبديل المظهر (داكن/فاتح)', en: 'Toggle theme (dark/light)', scope: 'global' },
  { keys: ['Esc'], ar: 'إغلاق النوافذ والقوائم', en: 'Close dialogs and menus', scope: 'global' },
  { keys: ['F2'], ar: 'التركيز على حقل البحث في نقطة البيع', en: 'Focus POS search box', scope: 'pos' },
  { keys: ['F6'], ar: 'تعليق الفاتورة الحالية', en: 'Suspend current cart', scope: 'pos' },
  { keys: ['F9'], ar: 'إتمام عملية البيع', en: 'Complete the sale', scope: 'pos' },
  { keys: ['Del'], ar: 'حذف آخر سطر من الفاتورة', en: 'Remove last cart line', scope: 'pos' },
  { keys: ['↑', '↓'], ar: 'التنقل بين نتائج البحث', en: 'Navigate search results', scope: 'pos' },
  { keys: ['Enter'], ar: 'إضافة الصنف المحدد للفاتورة (أو مسح الباركود)', en: 'Add selected product / scan barcode', scope: 'pos' },
]

const SCOPE_META: Record<string, { ar: string; en: string; icon: React.ComponentType<{ className?: string }> }> = {
  global: { ar: 'عامة', en: 'Global', icon: Command },
  pos: { ar: 'نقطة البيع', en: 'POS', icon: ShoppingCart },
  palette: { ar: 'اللوحة', en: 'Palette', icon: Search },
}

interface ShortcutsHelpOverlayProps {
  open?: boolean
  setOpen?: (open: boolean) => void
  onClose?: () => void
}

export function ShortcutsHelpOverlay({
  open: controlledOpen,
  setOpen: controlledSetOpen,
  onClose,
}: ShortcutsHelpOverlayProps = {}) {
  const view = useLibraryStore((s) => s.view)
  const lang = useLibraryStore((s) => s.lang)
  const [internalOpen, setInternalOpen] = useState(false)

  const isControlled = typeof controlledOpen === 'boolean'
  const open = isControlled ? controlledOpen : internalOpen

  const setOpen = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const nextValue = typeof value === 'function' ? value(open) : value
      if (!nextValue && onClose) {
        onClose()
      }
      if (controlledSetOpen) {
        controlledSetOpen(nextValue)
      } else {
        setInternalOpen(nextValue)
      }
    },
    [open, controlledSetOpen, onClose]
  )

  const toggle = useCallback(() => setOpen((v) => !v), [setOpen])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // "?" is Shift+/ on most layouts; also support direct "?" key
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        const target = e.target as HTMLElement | null
        const tag = target?.tagName?.toLowerCase()
        const typing = tag === 'input' || tag === 'textarea' || target?.isContentEditable
        if (typing) {
          // allow the shortcut when a text field is EMPTY (e.g. autofocused POS
          // search); block only while the user is actually typing content
          const value = (target as HTMLInputElement | HTMLTextAreaElement).value ?? ''
          if (value.length > 0) return
        }
        e.preventDefault()
        setOpen(true)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, setOpen])

  const onPos = view === 'pos'
  const groups: { scope: string; items: ShortcutDef[] }[] = [
    { scope: 'global', items: SHORTCUTS.filter((s) => s.scope === 'global') },
    ...(onPos ? [{ scope: 'pos', items: SHORTCUTS.filter((s) => s.scope === 'pos') }] : []),
  ].filter((g) => g.items.length > 0)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-primary" />
            {lang === 'ar' ? 'اختصارات لوحة المفاتيح' : 'Keyboard Shortcuts'}
          </DialogTitle>
          <DialogDescription>
            {lang === 'ar'
              ? onPos
                ? 'اختصرات نقطة البيع تخص شاشة الكاشير الحالية'
                : 'افتح نقطة البيع لعرض اختصارات الكاشير أيضاً'
              : onPos
                ? 'POS shortcuts apply to the current cashier screen'
                : 'Open the POS to see cashier shortcuts too'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {groups.map((group) => {
            const Meta = SCOPE_META[group.scope]
            const Icon = Meta.icon
            return (
              <div key={group.scope}>
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                  {lang === 'ar' ? Meta.ar : Meta.en}
                </p>
                <ul className="space-y-1">
                  {group.items.map((s) => (
                    <li key={s.keys.join('+')} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition hover:bg-muted/50">
                      <span className="text-xs text-foreground/90">{lang === 'ar' ? s.ar : s.en}</span>
                      <span className="flex shrink-0 items-center gap-1">
                        {s.keys.map((k, i) => (
                          <span key={i} className="flex items-center gap-1">
                            {i > 0 && <span className="text-[10px] text-muted-foreground">+</span>}
                            <Kbd>{k}</Kbd>
                          </span>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        <p className="border-t pt-3 text-center text-[10px] text-muted-foreground">
          {lang === 'ar' ? 'اضغط' : 'Press'} <Kbd>?</Kbd>{' '}
          {lang === 'ar' ? 'في أي وقت لعرض هذه المساعدة · Library Store' : 'anytime for this help · Library Store'}
        </p>
      </DialogContent>
    </Dialog>
  )
}
