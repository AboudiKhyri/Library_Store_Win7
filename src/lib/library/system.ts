/**
 * LIBRARY_STORE — System & Settings Core Service
 * 100% Offline Standalone Architecture
 */

import { db } from '@/lib/db'
import { ensureDatabaseSchema } from './db-bootstrap'
import {
  DEFAULT_BACKUP,
  DEFAULT_BRANDING,
  DEFAULT_BUSINESS,
  DEFAULT_HARDWARE,
  DEFAULT_HARDWARE_CAPS,
  DEFAULT_LOCALIZATION,
  DEFAULT_MODULES,
  DEFAULT_POS,
  DEFAULT_SYSTEM,
  parseBackup,
  parseBranding,
  parseBusiness,
  parseHardware,
  parseLocalization,
  parsePos,
  parseSystem,
} from './config'
import type {
  BackupConfig,
  BrandingConfig,
  BusinessConfig,
  HardwareConfig,
  LocalizationConfig,
  PosConfig,
  SessionUser,
  SystemConfig,
  SystemStatus,
} from './types'
import { APP_BUILD, APP_VERSION } from './types'

export const PRODUCT_ID = 'LIBRARY_STORE'

let bootstrapped = false
let bootstrapPromise: Promise<void> | null = null

/**
 * Initializes the database schema, ensures baseline roles and settings exist.
 * Idempotent: safe to run repeatedly on any request or server boot.
 */
export async function ensureBootstrap(): Promise<void> {
  if (bootstrapped) return
  if (bootstrapPromise) return bootstrapPromise

  bootstrapPromise = (async () => {
    try {
      await ensureDatabaseSchema()

      // Ensure default roles exist
      const existingRoles = await db.role.count()
      if (existingRoles === 0) {
        const defaultRoles = [
          {
            id: 'role_owner',
            tenantId: 'default',
            key: 'owner',
            nameAr: 'المالك',
            nameEn: 'Owner',
            description: 'صلاحيات كاملة وغير مقيدة',
            permissions: JSON.stringify([
              'DASHBOARD_VIEW', 'PRODUCT_VIEW', 'PRODUCT_CREATE', 'PRODUCT_EDIT', 'PRODUCT_DELETE',
              'CATEGORY_VIEW', 'CATEGORY_MANAGE', 'INVENTORY_VIEW', 'INVENTORY_ADJUST', 'STOCKTAKE_CREATE',
              'SALES_VIEW', 'SALES_CREATE', 'SALES_CANCEL', 'SALES_RETURN',
              'PURCHASE_VIEW', 'PURCHASE_CREATE', 'PURCHASE_RECEIVE',
              'SUPPLIER_VIEW', 'SUPPLIER_MANAGE', 'CUSTOMER_VIEW', 'CUSTOMER_MANAGE',
              'REPORT_VIEW', 'REPORT_EXPORT', 'USER_VIEW', 'USER_MANAGE',
              'ROLE_VIEW', 'ROLE_MANAGE', 'SETTINGS_VIEW', 'SETTINGS_MANAGE',
              'HARDWARE_MANAGE', 'BACKUP_MANAGE', 'AUDIT_VIEW'
            ]),
            isSystem: true,
          },
          {
            id: 'role_manager',
            tenantId: 'default',
            key: 'manager',
            nameAr: 'مدير فرع',
            nameEn: 'Manager',
            description: 'إدارة العمليات اليومية والمخزون والمبيعات',
            permissions: JSON.stringify([
              'DASHBOARD_VIEW', 'PRODUCT_VIEW', 'PRODUCT_CREATE', 'PRODUCT_EDIT',
              'CATEGORY_VIEW', 'CATEGORY_MANAGE', 'INVENTORY_VIEW', 'INVENTORY_ADJUST', 'STOCKTAKE_CREATE',
              'SALES_VIEW', 'SALES_CREATE', 'SALES_CANCEL', 'SALES_RETURN',
              'PURCHASE_VIEW', 'PURCHASE_CREATE', 'PURCHASE_RECEIVE',
              'SUPPLIER_VIEW', 'CUSTOMER_VIEW', 'CUSTOMER_MANAGE',
              'REPORT_VIEW', 'REPORT_EXPORT', 'USER_VIEW', 'SETTINGS_VIEW',
              'HARDWARE_MANAGE', 'AUDIT_VIEW'
            ]),
            isSystem: true,
          },
          {
            id: 'role_cashier',
            tenantId: 'default',
            key: 'cashier',
            nameAr: 'كاشير',
            nameEn: 'Cashier',
            description: 'عمليات نقطة البيع والتحصيل والمرتجعات البسيطة',
            permissions: JSON.stringify([
              'DASHBOARD_VIEW', 'PRODUCT_VIEW', 'SALES_VIEW', 'SALES_CREATE', 'SALES_RETURN', 'CUSTOMER_VIEW'
            ]),
            isSystem: true,
          }
        ]

        for (const r of defaultRoles) {
          await db.role.create({ data: r }).catch(() => undefined)
        }
      }

      // Ensure default AppSettings row exists
      const existingSettings = await db.appSettings.findUnique({ where: { id: 'default' } })
      if (!existingSettings) {
        await db.appSettings.create({
          data: {
            id: 'default',
            business: JSON.stringify(DEFAULT_BUSINESS),
            branding: JSON.stringify(DEFAULT_BRANDING),
            hardware: JSON.stringify(DEFAULT_HARDWARE),
            pos: JSON.stringify(DEFAULT_POS),
            localization: JSON.stringify(DEFAULT_LOCALIZATION),
            backup: JSON.stringify(DEFAULT_BACKUP),
            system: JSON.stringify(DEFAULT_SYSTEM),
          },
        }).catch(() => undefined)
      }

      // Ensure default owner user exists so cashier/user foreign keys never fail
      const userCount = await db.user.count({ where: { tenantId: 'default' } })
      if (userCount === 0) {
        const { DEFAULT_OWNER_USER, hashPassword } = await import('./auth')
        await db.user.create({
          data: {
            id: DEFAULT_OWNER_USER.id,
            tenantId: 'default',
            username: DEFAULT_OWNER_USER.username,
            passwordHash: hashPassword('Admin@1234'),
            displayName: DEFAULT_OWNER_USER.displayName,
            roleKey: 'owner',
            active: true,
          },
        }).catch(() => undefined)
      }

      bootstrapped = true
    } finally {
      bootstrapPromise = null
    }
  })()

  return bootstrapPromise
}

export interface EffectiveSettings {
  business: BusinessConfig
  branding: BrandingConfig
  hardware: HardwareConfig
  pos: PosConfig
  localization: LocalizationConfig
  backup: BackupConfig
  system: SystemConfig
}

/**
 * Returns merged settings for the given tenant (defaults to 'default').
 * Fully unlocked — zero licensing caps.
 */
export async function getSettings(tenantId = 'default'): Promise<EffectiveSettings> {
  await ensureBootstrap()

  let row = await db.appSettings.findUnique({ where: { id: tenantId } })
  if (!row && tenantId !== 'default') {
    row = await db.appSettings.findUnique({ where: { id: 'default' } })
  }

  const business = parseBusiness(row?.business)
  const branding = parseBranding(row?.branding)
  const hardware = parseHardware(row?.hardware)
  const pos = parsePos(row?.pos)
  const localization = parseLocalization(row?.localization)
  const backup = parseBackup(row?.backup)
  const system = parseSystem(row?.system)

  return {
    business,
    branding,
    hardware,
    pos,
    localization,
    backup,
    system,
  }
}

/**
 * Updates a specific settings block in AppSettings for the store.
 */
export async function saveSettingsBlock<K extends keyof EffectiveSettings>(
  block: K,
  data: EffectiveSettings[K],
  tenantId = 'default',
  _user?: SessionUser
): Promise<EffectiveSettings> {
  await ensureBootstrap()

  const current = await getSettings(tenantId)
  const updated = { ...current, [block]: data }

  await db.appSettings.upsert({
    where: { id: tenantId },
    create: {
      id: tenantId,
      business: JSON.stringify(updated.business),
      branding: JSON.stringify(updated.branding),
      hardware: JSON.stringify(updated.hardware),
      pos: JSON.stringify(updated.pos),
      localization: JSON.stringify(updated.localization),
      backup: JSON.stringify(updated.backup),
      system: JSON.stringify(updated.system),
    },
    update: {
      [block]: JSON.stringify(data),
      updatedAt: new Date(),
    },
  })

  return updated
}

/**
 * Sweeps expired batches and flags them as EXPIRED.
 */
export async function sweepExpiredBatches(tenantId = 'default'): Promise<number> {
  const now = new Date()
  const result = await db.batch.updateMany({
    where: {
      tenantId,
      status: 'ACTIVE',
      expiryDate: { lt: now },
    },
    data: {
      status: 'EXPIRED',
    },
  })
  return result.count
}

/**
 * Returns clean, offline system status.
 */
export async function getSystemStatus(): Promise<SystemStatus> {
  const settings = await getSettings('default')

  return {
    productId: PRODUCT_ID,
    phase: 'READY',
    licenseState: 'ACTIVE',
    provisioningStage: 'READY',
    version: APP_VERSION,
    build: APP_BUILD,
    license: null,
    modules: DEFAULT_MODULES,
    hardware: settings.hardware,
    hardwareCaps: DEFAULT_HARDWARE_CAPS,
    branding: settings.branding,
    localization: settings.localization,
    pos: settings.pos,
    business: settings.business,
    installationId: 'offline-standalone',
    tenantId: 'default',
    licenseServer: { reachable: false, checkedAt: null },
    pid: process.pid,
    runtime: 'node',
  }
}
