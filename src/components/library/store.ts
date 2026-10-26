'use client'

/**
 * LIBRARY_STORE — Global Client State (Zustand)
 * 100% Offline Standalone Architecture
 */

import { create } from 'zustand'
import { api, onGateError, onAuthError } from './api'
import type { SessionUser, SystemStatus } from '@/lib/library/types'
import type { Lang } from '@/lib/library/i18n'
import { t as translate } from '@/lib/library/i18n'
import { formatMoney as fmtMoney, formatDateTime as fmtDateTime, formatDate as fmtDate } from '@/lib/library/money'

export interface LibraryStoreState {
  // boot
  booted: boolean
  bootError: string | null
  status: SystemStatus | null
  session: SessionUser | null
  // ui
  view: string
  viewParams: Record<string, unknown>
  lang: Lang
  theme: 'dark' | 'light'
  sidebarOpen: boolean
  sidebarCollapsed: boolean

  // actions
  boot: () => Promise<void>
  initServerData: (status: SystemStatus | null, session: SessionUser | null) => void
  refreshStatus: () => Promise<void>
  refreshSession: () => Promise<void>
  setSession: (user: SessionUser | null) => void
  setView: (view: string, params?: Record<string, unknown>) => void
  setLang: (lang: Lang) => void
  setTheme: (theme: 'dark' | 'light') => void
  toggleSidebar: () => void
  setSidebarCollapsed: (v: boolean) => void
  logout: () => Promise<void>

  // derived helpers
  t: (key: string) => string
  money: (n: number) => string
  fmtDate: (d: unknown) => string
  fmtDateTime: (d: unknown) => string
  has: (permission: string) => boolean
}

function applyDocument(lang: Lang, theme: 'dark' | 'light') {
  if (typeof document === 'undefined') return
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export const useLibraryStore = create<LibraryStoreState>((set, get) => {
  onGateError(() => {
    void get().refreshStatus()
  })

  onAuthError(() => {
    set({ session: null, view: 'login', viewParams: {} })
  })

  return {
    booted: false,
    bootError: null,
    status: null,
    session: null,
    view: 'login',
    viewParams: {},
    lang: 'ar',
    theme: (typeof window !== 'undefined' && ((localStorage.getItem('library-theme') as 'dark' | 'light') || (localStorage.getItem('qx-theme') as 'dark' | 'light'))) || 'dark',
    sidebarOpen: false,
    sidebarCollapsed: false,

    initServerData: (status, session) => {
      if (!status) return
      const lang = status.localization?.language ?? 'ar'
      let theme: 'dark' | 'light' = status.branding?.defaultTheme === 'light' ? 'light' : 'dark'
      if (typeof window !== 'undefined') {
        const saved = (localStorage.getItem('library-theme') as 'dark' | 'light') ||
                      (localStorage.getItem('qx-theme') as 'dark' | 'light')
        if (saved) theme = saved
      }
      applyDocument(lang, theme); applyBranding(status?.branding);
      set({
        booted: true,
        bootError: null,
        status,
        session,
        lang,
        theme,
        view: 'dashboard',
      })
    },

    boot: async () => {
      try {
        const status = await api<SystemStatus>('/system/status')
        const session = await api<{ user: SessionUser | null }>('/auth/session').catch(() => ({ user: null }))
        const lang = status.localization?.language ?? 'ar'
        let theme: 'dark' | 'light' = status.branding?.defaultTheme === 'light' ? 'light' : 'dark'
        if (typeof window !== 'undefined') {
          const saved = (localStorage.getItem('library-theme') as 'dark' | 'light') ||
                        (localStorage.getItem('qx-theme') as 'dark' | 'light')
          if (saved) theme = saved
        }
        applyDocument(lang, theme)
        const user = session.user
        set({
          booted: true,
          bootError: null,
          status,
          session: user,
          lang,
          theme,
          view: user ? pickFirstView(status, user) : 'login',
        })
      } catch (e) {
        set({ booted: true, bootError: (e as Error).message ?? 'boot failed' })
      }
    },

    refreshStatus: async () => {
      try {
        const status = await api<SystemStatus>('/system/status')
        applyBranding(status?.branding); set({ status })
      } catch {
        // keep last known status when offline
      }
    },

    refreshSession: async () => {
      try {
        const { user } = await api<{ user: SessionUser | null }>('/auth/session')
        set({ session: user })
      } catch {
        // offline — keep current session
      }
    },

    setSession: (user) => {
      if (user) {
        const status = get().status
        set({ session: user, view: pickFirstView(status, user) })
      } else {
        set({ session: null, view: 'login', viewParams: {} })
      }
    },

    setView: (view, params) => set({ view, viewParams: params ?? {}, sidebarOpen: false }),
    setLang: (lang) => {
      applyDocument(lang, get().theme)
      set({ lang })
    },
    setTheme: (theme) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('library-theme', theme)
        localStorage.setItem('qx-theme', theme)
      }
      applyDocument(get().lang, theme)
      set({ theme })

      // Persist chosen theme to server branding settings in background
      const currentStatus = get().status
      if (currentStatus) {
        const branding = { ...currentStatus.branding, defaultTheme: theme }
        api('/system/settings/branding', { method: 'PUT', body: branding })
          .then(() => {
            set((s) => s.status ? { status: { ...s.status, branding: { ...s.status.branding, defaultTheme: theme } } } : s)
          })
          .catch(() => {})
      }
    },
    toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),

    logout: async () => {
      try {
        await api('/auth/logout', { method: 'POST' })
      } catch {
        // local sign-out regardless
      }
      set({ session: null, view: 'login', viewParams: {} })
    },

    t: (key) => translate(key, get().lang),
    money: (n) => {
      const s = get().status
      return fmtMoney(n, s?.pos ?? { currency: 'EGP', currencySymbol: 'ج.م' } as never, s?.localization)
    },
    fmtDate: (d) => fmtDate(d, get().lang),
    fmtDateTime: (d) => fmtDateTime(d, get().lang),
    has: (permission) => {
      const s = get().session
      return Boolean(s && Array.isArray(s.permissions) && s.permissions.includes(permission as never))
    },
  }
})

/** First accessible view for a user (dashboard first, else any permitted). */
function pickFirstView(status: SystemStatus | null, user: SessionUser | null): string {
  if (!user) return 'login'
  const perms = Array.isArray(user?.permissions) ? user.permissions : []
  // Cashier lands directly on POS
  if (user.roleKey && user.roleKey.toLowerCase() === 'cashier') {
    return 'pos'
  }
  // Manager or owner or user with DASHBOARD_VIEW lands on dashboard
  if (user.roleKey === 'owner' || user.roleKey === 'admin' || perms.includes('DASHBOARD_VIEW')) {
    return 'dashboard'
  }
  const fallbacks = ['pos', 'products', 'sales-history', 'purchases', 'reports']
  for (const v of fallbacks) {
    const perm =
      v === 'pos' ? 'SALES_CREATE' : v === 'products' ? 'PRODUCT_VIEW' : v === 'sales-history' ? 'SALES_VIEW' : v === 'purchases' ? 'PURCHASE_VIEW' : 'REPORT_VIEW'
    if (user.permissions.includes(perm as never)) {
      if (!status || moduleEnabledForView(status, v)) return v
    }
  }
  return 'dashboard'
}

function moduleEnabledForView(status: SystemStatus, view: string): boolean {
  const m = status.modules
  switch (view) {
    case 'pos':
      return m.pos
    case 'products':
      return m.supermarket
    case 'sales-history':
      return m.pos
    case 'purchases':
      return m.purchasing
    case 'reports':
      return m.reports
    default:
      return true
  }
}
