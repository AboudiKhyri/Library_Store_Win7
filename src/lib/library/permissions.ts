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
    nameAr: 'المالك / مدير النظام',
    nameEn: 'Owner / Super Admin',
    description: 'وصول كامل للنظام بدون قيود',
    permissions: [...ALL_PERMISSIONS],
  },
  {
    key: 'manager',
    nameAr: 'مدير الفرع',
    nameEn: 'Branch Manager',
    description: 'إدارة تشغيلية شاملة بدون إدارة المستخدمين والتراخيص',
    permissions: [
      ...sales_view,
      'SALES_CREATE',
      'SALES_CANCEL',
      'SALES_RETURN',
      'PRODUCT_CREATE',
      'PRODUCT_EDIT',
      'CATEGORY_VIEW',
      'CATEGORY_MANAGE',
      'INVENTORY_VIEW',
      'INVENTORY_ADJUST',
      'STOCKTAKE_CREATE',
      'PURCHASE_VIEW',
      'PURCHASE_CREATE',
      'PURCHASE_RECEIVE',
      'SUPPLIER_VIEW',
      'SUPPLIER_MANAGE',
      'CUSTOMER_MANAGE',
      'REPORT_VIEW',
      'REPORT_EXPORT',
      'USER_VIEW',
      'SETTINGS_VIEW',
      'SETTINGS_MANAGE',
      'HARDWARE_MANAGE',
      'BACKUP_MANAGE',
      'LICENSE_VIEW',
      'AUDIT_VIEW',
    ],
  },
  {
    key: 'cashier',
    nameAr: 'كاشير',
    nameEn: 'Cashier',
    description: 'نقطة البيع والعمليات النقدية فقط',
    permissions: [
      'DASHBOARD_VIEW',
      'PRODUCT_VIEW',
      'SALES_VIEW',
      'SALES_CREATE',
      'CUSTOMER_VIEW',
      'CUSTOMER_MANAGE',
    ],
  },
  {
    key: 'inventory',
    nameAr: 'أمين المخزن',
    nameEn: 'Inventory Staff',
    description: 'إدارة الأصناف والمخزون والجرد',
    permissions: [
      'DASHBOARD_VIEW',
      'PRODUCT_VIEW',
      'PRODUCT_CREATE',
      'PRODUCT_EDIT',
      'CATEGORY_VIEW',
      'INVENTORY_VIEW',
      'INVENTORY_ADJUST',
      'STOCKTAKE_CREATE',
      'SUPPLIER_VIEW',
      'PURCHASE_VIEW',
    ],
  },
  {
    key: 'purchasing',
    nameAr: 'مسؤول المشتريات',
    nameEn: 'Purchasing Staff',
    description: 'المشتريات والموردين',
    permissions: [
      'DASHBOARD_VIEW',
      'PRODUCT_VIEW',
      'CATEGORY_VIEW',
      'INVENTORY_VIEW',
      'PURCHASE_VIEW',
      'PURCHASE_CREATE',
      'PURCHASE_RECEIVE',
      'SUPPLIER_VIEW',
      'SUPPLIER_MANAGE',
    ],
  },
  {
    key: 'accountant',
    nameAr: 'المحاسب',
    nameEn: 'Accountant / Finance',
    description: 'التقارير المالية والاطلاع على الحركات',
    permissions: [
      'DASHBOARD_VIEW',
      'PRODUCT_VIEW',
      'INVENTORY_VIEW',
      'SALES_VIEW',
      'PURCHASE_VIEW',
      'SUPPLIER_VIEW',
      'CUSTOMER_VIEW',
      'REPORT_VIEW',
      'REPORT_EXPORT',
      'AUDIT_VIEW',
    ],
  },
]

export function getSystemRole(key: string): RoleDef | undefined {
  return SYSTEM_ROLES.find((r) => r.key === key)
}
