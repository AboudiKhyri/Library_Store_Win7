/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Typed configuration blocks with safe defaults
import type {
  BackupConfig,
  BrandingConfig,
  BusinessConfig,
  HardwareConfig,
  LocalizationConfig,
  ModuleFlags,
  HardwareCaps,
  PosConfig,
  SystemConfig,
} from './types'
import { APP_BUILD, APP_VERSION } from './types'

function parse<T>(val: string | T | null | undefined, fallback: T): T {
  if (!val) return fallback
  if (typeof val === 'object') return { ...fallback, ...val }
  if (typeof val === 'string') {
    try {
      return { ...fallback, ...(JSON.parse(val) as object) } as T
    } catch {
      return fallback
    }
  }
  return fallback
}

// Library_Store default store configurations
export const DEFAULT_BUSINESS: BusinessConfig = {
  businessName: '',
  displayName: '',
  owner: '',
  address: '',
  phone: '',
  phone2: '',
  email: '',
  taxId: '',
  receiptHeader: '',
  receiptFooter: 'شكراً لزيارتكم',
  notes: '',
}

export const DEFAULT_BRANDING: BrandingConfig = {
  primary: '#00c8e0',
  secondary: '#14b8a6',
  accent: '#22d3ee',
  appName: 'Library Store',
  logoDataUrl: null,
  defaultTheme: 'dark',
}

export const DEFAULT_HARDWARE: HardwareConfig = {
  printerEnabled: true,
  printerName: 'Default Receipt Printer',
  paperWidth: 80,
  scannerEnabled: true,
  scannerSuffix: 'Enter',
  scannerMinIntervalMs: 30,
  cashDrawerEnabled: true,
}

export const DEFAULT_POS: PosConfig = {
  currency: 'EGP',
  currencySymbol: 'ج.م',
  allowDiscount: true,
  maxDiscountPercent: 20,
  lowStockThreshold: 10,
  receiptCopies: 1,
  defaultPaymentMethod: 'cash',
  paymentMethods: ['cash', 'card', 'wallet'],
  units: ['piece', 'pack', 'box', 'kg', 'g', 'l', 'ml'],
  weightQtyDecimals: 3,
}

export const DEFAULT_LOCALIZATION: LocalizationConfig = {
  language: 'ar',
  timezone: 'Africa/Cairo',
  numberFormat: 'latn',
}

export const DEFAULT_BACKUP: BackupConfig = {
  autoBackupEnabled: false,
  intervalHours: 24,
  retentionCount: 10,
}

export const DEFAULT_MODULES: ModuleFlags = {
  supermarket: true,
  pos: true,
  inventory: true,
  purchasing: true,
  customers: true,
  reports: true,
  stocktaking: true,
  loyalty: true,
}

export const DEFAULT_HARDWARE_CAPS: HardwareCaps = {
  printer: true,
  scanner: true,
  cashDrawer: true,
}

export const DEFAULT_ENTITLEMENTS = {
  pos: true,
  inventory: true,
  purchasing: true,
  customers: true,
  reports: true,
  stocktaking: true,
  loyalty: true,
  printing: true,
  scanner: true,
  cashDrawer: true,
  multiUser: true,
  backups: true,
} as const

export const DEFAULT_SYSTEM: SystemConfig = {
  version: APP_VERSION,
  build: APP_BUILD,
  installationId: '',
  lastLicenseValidation: null,
  lastBackupAt: null,
  timeHighWaterMark: null,
}

export const parseBusiness = (j?: string | BusinessConfig | null) => parse<BusinessConfig>(j, DEFAULT_BUSINESS)
export const parseBranding = (j?: string | BrandingConfig | null) => parse<BrandingConfig>(j, DEFAULT_BRANDING)
export const parseHardware = (j?: string | HardwareConfig | null) => parse<HardwareConfig>(j, DEFAULT_HARDWARE)
export const parsePos = (j?: string | PosConfig | null) => parse<PosConfig>(j, DEFAULT_POS)
export const parseLocalization = (j?: string | LocalizationConfig | null) => parse<LocalizationConfig>(j, DEFAULT_LOCALIZATION)
export const parseBackup = (j?: string | BackupConfig | null) => parse<BackupConfig>(j, DEFAULT_BACKUP)
export const parseSystem = (j?: string | SystemConfig | null) => parse<SystemConfig>(j, DEFAULT_SYSTEM)
export const parseModules = (j: string | null | undefined): ModuleFlags =>
  j ? { ...DEFAULT_MODULES, ...(JSON.parse(j) as object) } : DEFAULT_MODULES
export const parseHardwareCaps = (j: string | null | undefined): HardwareCaps =>
  j ? { ...DEFAULT_HARDWARE_CAPS, ...(JSON.parse(j) as object) } : DEFAULT_HARDWARE_CAPS

/** Effective hardware config in offline standalone mode (no license caps). */
export function effectiveHardware(_caps: HardwareCaps, local: HardwareConfig): HardwareConfig {
  return {
    ...local,
  }
}
