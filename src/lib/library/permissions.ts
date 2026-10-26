/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — RBAC: role definitions + permission matrix
import type { Permission } from './types'

export const ALL_PERMISSIONS: Permission[] = [
  'DASHBOARD_VIEW',
  'PRODUCT_VIEW',
  'PRODUCT_CREATE',
  'PRODUCT_EDIT',
  'PRODUCT_DELETE',
  'CATEGORY_VIEW',
  'CATEGORY_MANAGE',
  'INVENTORY_VIEW',
  'INVENTORY_ADJUST',
  'STOCKTAKE_CREATE',
  'SALES_VIEW',
  'SALES_CREATE',
  'SALES_CANCEL',
  'SALES_RETURN',
  'PURCHASE_VIEW',
  'PURCHASE_CREATE',
  'PURCHASE_RECEIVE',
  'SUPPLIER_VIEW',
  'SUPPLIER_MANAGE',
  'CUSTOMER_VIEW',
  'CUSTOMER_MANAGE',
  'REPORT_VIEW',
  'REPORT_EXPORT',
  'USER_VIEW',
  'USER_MANAGE',
  'ROLE_VIEW',
  'ROLE_MANAGE',
  'SETTINGS_VIEW',
  'SETTINGS_MANAGE',
  'HARDWARE_MANAGE',
  'BACKUP_MANAGE',
  'LICENSE_VIEW',
  'LICENSE_DEACTIVATE',
  'AUDIT_VIEW',
]

export interface RoleDef {
  key: string
  nameAr: string
  nameEn: string
  description: string
  permissions: Permission[]
}

const sales_view: Permission[] = ['DASHBOARD_VIEW', 'SALES_VIEW', 'PRODUCT_VIEW', 'CUSTOMER_VIEW']

export const SYSTEM_ROLES: RoleDef[] = [
  {
    key: 'owner',
    nameAr: 'المالك',
    nameEn: 'Owner',
    description: 'صلاحيات كاملة بدون قيود',
    permissions: [...ALL_PERMISSIONS],
  },
  {
    key: 'cashier',
    nameAr: 'كاشير',
    nameEn: 'Cashier',
    description: 'عمليات نقطة البيع والتحصيل',
    permissions: [
      'DASHBOARD_VIEW',
      'PRODUCT_VIEW',
      'SALES_VIEW',
      'SALES_CREATE',
      'SALES_RETURN',
      'CUSTOMER_VIEW',
    ],
  },
]

export function getSystemRole(key: string): RoleDef | undefined {
  return SYSTEM_ROLES.find((r) => r.key === key)
}
