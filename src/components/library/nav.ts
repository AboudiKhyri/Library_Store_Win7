'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — navigation registry (permission + module gated)
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
  ScrollText,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { SystemStatus } from '@/lib/library/types'
import type { SessionUser } from '@/lib/library/types'

export interface NavItem {
  view: string
  labelKey: string
  icon: LucideIcon
  permission?: string
  module?: keyof SystemStatus['modules']
}

export interface NavSection {
  titleKey: string
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    titleKey: 'nav.dashboard',
    items: [{ view: 'dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, permission: 'DASHBOARD_VIEW' }],
  },
  {
    titleKey: 'nav.sales',
    items: [
      { view: 'pos', labelKey: 'nav.pos', icon: ShoppingCart, permission: 'SALES_CREATE', module: 'pos' },
      { view: 'sales-history', labelKey: 'nav.salesHistory', icon: Receipt, permission: 'SALES_VIEW', module: 'pos' },
      { view: 'returns', labelKey: 'nav.returns', icon: Undo2, permission: 'SALES_RETURN', module: 'pos' },
    ],
  },
  {
    titleKey: 'nav.inventory',
    items: [
      { view: 'products', labelKey: 'nav.products', icon: Package, permission: 'PRODUCT_VIEW', module: 'supermarket' },
      { view: 'categories', labelKey: 'nav.categories', icon: Tags, permission: 'CATEGORY_VIEW', module: 'supermarket' },
      { view: 'inventory', labelKey: 'nav.stock', icon: Boxes, permission: 'INVENTORY_VIEW', module: 'inventory' },
      { view: 'stocktake', labelKey: 'nav.stocktake', icon: ClipboardList, permission: 'STOCKTAKE_CREATE', module: 'stocktaking' },
    ],
  },
  {
    titleKey: 'nav.purchasing',
    items: [
      { view: 'purchases', labelKey: 'nav.purchases', icon: Truck, permission: 'PURCHASE_VIEW', module: 'purchasing' },
      { view: 'suppliers', labelKey: 'nav.suppliers', icon: Building2, permission: 'SUPPLIER_VIEW', module: 'purchasing' },
    ],
  },
  {
    titleKey: 'nav.customers',
    items: [{ view: 'customers', labelKey: 'nav.customers', icon: Users, permission: 'CUSTOMER_VIEW', module: 'customers' }],
  },
  {
    titleKey: 'nav.reports',
    items: [{ view: 'reports', labelKey: 'nav.reports', icon: BarChart3, permission: 'REPORT_VIEW', module: 'reports' }],
  },
  {
    titleKey: 'nav.administration',
    items: [
      { view: 'users', labelKey: 'nav.users', icon: UserCog, permission: 'USER_VIEW' },
      { view: 'roles', labelKey: 'nav.roles', icon: ShieldCheck, permission: 'ROLE_VIEW' },
      { view: 'settings', labelKey: 'nav.settings', icon: Settings, permission: 'SETTINGS_VIEW' },
    ],
  },
  {
    titleKey: 'nav.system',
    items: [
      { view: 'backup', labelKey: 'nav.backup', icon: DatabaseBackup, permission: 'BACKUP_MANAGE' },
      { view: 'audit', labelKey: 'nav.audit', icon: ScrollText, permission: 'AUDIT_VIEW' },
    ],
  },
]

export function isItemVisible(item: NavItem, user: SessionUser | null, status: SystemStatus | null): boolean {
  if (!user) return false
  if (item.permission && !user.permissions.includes(item.permission as never)) return false
  if (item.module && status && !status.modules[item.module]) return false
  return true
}
