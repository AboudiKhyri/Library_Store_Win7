/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Shared domain types
// Used by both server services and client screens.

// ---------- Permissions ----------

export const PERMISSIONS = [
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
] as const

export type Permission = (typeof PERMISSIONS)[number]

// ---------- Config blocks (stored as JSON in AppSettings) ----------

export interface BusinessConfig {
  businessName: string
  displayName: string
  owner: string
  address: string
  phone: string
  phone2: string
  email: string
  taxId: string
  receiptHeader: string
  receiptFooter: string
  notes: string
}

export interface BrandingConfig {
  primary: string
  secondary: string
  accent: string
  appName: string
  logoDataUrl: string | null
  defaultTheme: 'dark' | 'light' | 'system'
}

export interface HardwareConfig {
  printerEnabled: boolean
  printerName: string
  paperWidth: 58 | 80
  scannerEnabled: boolean
  scannerSuffix: 'Enter' | 'Tab' | 'None'
  scannerMinIntervalMs: number
  cashDrawerEnabled: boolean
}

export interface LoyaltySettings {
  enabled: boolean
  earnRatePer100: number
  pointValueEgp: number
  maxRedeemShare: number
  minRedeemPoints: number
  /** tier thresholds (lifetime earned points) */
  tierBronze?: number
  tierSilver?: number
  tierGold?: number
}

export interface PosConfig {
  currency: string
  currencySymbol: string
  allowDiscount: boolean
  maxDiscountPercent: number
  lowStockThreshold: number
  receiptCopies: number
  defaultPaymentMethod: string
  paymentMethods: string[]
  /** units of measure offered in the supermarket catalog/POS */
  units: string[]
  /** decimal places for weighable product quantities (kg / g / l / ml) */
  weightQtyDecimals: number
  loyalty?: LoyaltySettings
}

export interface LocalizationConfig {
  language: 'ar' | 'en'
  timezone: string
  numberFormat: 'latn' | 'arab'
}

export interface BackupConfig {
  autoBackupEnabled: boolean
  intervalHours: number
  retentionCount: number
}

export interface SystemConfig {
  version: string
  build: string
  installationId: string
  lastLicenseValidation: string | null
  lastBackupAt: string | null
  /** high-water mark of trusted time (server-validated) for clock-rollback detection */
  timeHighWaterMark: string | null
}

export interface ModuleFlags {
  supermarket: boolean
  pos: boolean
  inventory: boolean
  purchasing: boolean
  customers: boolean
  reports: boolean
  stocktaking: boolean
  loyalty: boolean
}

export interface HardwareCaps {
  printer: boolean
  scanner: boolean
  cashDrawer: boolean
}

// ---------- License / Status ----------

/** Client-side license state machine. */
export type LicenseState =
  | 'UNPROVISIONED'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'EXPIRED'
  | 'REVOKED'
  | 'INVALID'
  | 'TEMPORARILY_UNAVAILABLE'
  | 'OFFLINE_GRACE_EXPIRED'

/** Provisioning wizard stages. */
export type ProvisioningStage =
  | 'ACTIVATED'
  | 'OWNER_CREATED'
  | 'BUSINESS_CONFIRMED'
  | 'HARDWARE_CONFIGURED'
  | 'READY'

/** Entitlement flags. */
export interface Entitlements {
  pos: boolean
  inventory: boolean
  purchasing: boolean
  customers: boolean
  reports: boolean
  stocktaking: boolean
  loyalty: boolean
  printing: boolean
  scanner: boolean
  cashDrawer: boolean
  multiUser: boolean
  backups: boolean
}

export interface LicenseArtifact {
  v: 1
  licenseId: string
  licenseKey: string
  productId: string
  plan: string
  tenantId: string
  tenantName: string
  deviceId: string
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'REVOKED' | 'INVALID'
  issuedAt: string
  expiresAt: string | null
  maxDevices: number
  policy: {
    offlineGraceHours: number
    validationIntervalHours: number
    minAppVersion: string
  }
  entitlements: Entitlements
  branding: {
    businessName: string
    displayName: string
    logoUrl: string
    primaryColor: string
    secondaryColor: string
    accentColor: string
    address: string
    phone: string
    email: string
    receiptHeader: string
    receiptFooter: string
  }
  hardware: {
    printer: { enabled: boolean; paperWidth: 58 | 80 }
    scanner: { enabled: boolean; suffix: 'Enter' | 'Tab' | 'None' }
    cashDrawer: { enabled: boolean }
  }
  locale: 'ar' | 'en'
  currency: string
  timezone: string
}

export interface TenantConfig {
  tenantId: string
  tenantName: string
  businessType: 'supermarket'
  branding: LicenseArtifact['branding']
  hardware: LicenseArtifact['hardware']
  entitlements: LicenseArtifact['entitlements']
  locale: 'ar' | 'en'
  currency: string
  timezone: string
}

export interface LicenseInfo {
  licenseKey: string
  licenseId: string
  plan: string
  productId: string
  tenantId: string
  tenantName: string
  businessType: string
  serverStatus: string
  licenseState: LicenseState
  activatedAt: string
  expiresAt: string | null
  lastValidatedAt: string
  graceRemainingHours: number | null
  offlineGraceHours: number
  maxDevices: number
  notes: null
  deviceId: string
  deviceName: string
  entitlements: Entitlements
  hardwareCaps: HardwareCaps
}

export type AppPhase = 'UNACTIVATED' | 'PROVISIONING' | 'READY'

export interface SystemStatus {
  productId: string
  phase: AppPhase
  licenseState: LicenseState
  provisioningStage: ProvisioningStage | null
  version: string
  build: string
  license: LicenseInfo | null
  modules: ModuleFlags
  hardware: HardwareConfig
  hardwareCaps: HardwareCaps
  branding: BrandingConfig
  localization: LocalizationConfig
  pos: PosConfig
  business: BusinessConfig | null
  installationId: string
  tenantId: string | null
  licenseServer: { reachable: boolean; checkedAt: string | null }
  pid: number
  runtime: string
}

// ---------- Auth ----------

export interface SessionUser {
  id: string
  username: string
  displayName: string
  roleKey: string
  roleNameAr: string
  roleNameEn: string
  permissions: Permission[]
}

// ---------- POS / Sales ----------

export interface CartLine {
  productId: string
  nameAr: string
  sku: string
  barcode: string | null
  unitPrice: number
  quantity: number
  discount: number
  stockAvailable: number
  /** supermarket: weighable products accept fractional quantities (kg / l) */
  isWeighable?: boolean
  /** unit of measure label (piece / pack / box / kg / g / l / ml) */
  unit?: string | null
}

export interface SaleInputItem {
  productId: string
  quantity: number
  unitPrice?: number
  discount?: number
}

export interface SaleInput {
  items: SaleInputItem[]
  customerId?: string | null
  paymentMethod: string
  paidAmount: number
  discount?: number
  notes?: string
}

export interface ReceiptData {
  saleId: string
  invoiceNo: string
  createdAt: string
  cashierName: string
  customerName: string | null
  items: {
    productName: string
    batchNo: string | null
    quantity: number
    unitPrice: number
    discount: number
    total: number
    allocations: { batchNo: string | null; qty: number }[]
  }[]
  subtotal: number
  discount: number
  tax: number
  total: number
  paidAmount: number
  changeAmount: number
  paymentMethod: string
  loyalty?: {
    redeemedPoints: number
    redeemedValue: number
    earnedPoints: number
    balanceAfter: number
  }
}

// ---------- API envelope ----------

export interface ApiOk<T> {
  ok: true
  data: T
}
export interface ApiErr {
  ok: false
  error: { code: string; message: string; errorId?: string; details?: unknown }
}
export type ApiResult<T> = ApiOk<T> | ApiErr

// ---------- Misc ----------

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export const APP_VERSION = '1.0.1'
export const APP_BUILD = '2026092201'
export const VENDOR = {
  company: 'Library Store',
  product: 'Library Store',
  logo: '/logo.png',
  taglineAr: 'نظام إدارة المتاجر والمكتبات دون اتصال',
  taglineEn: 'Offline Store & POS Management System',
}
