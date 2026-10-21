/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Backup & Restore service (TENANT-SCOPED)
// A backup contains ONLY the active tenant's rows (business tables + this
// tenant's users/counters/audit trail + its AppSettings row + system roles).
// Restore is transactional, guarded by a PRE_RESTORE safety backup, and can
// NEVER cross tenants: backup.meta.tenantId must equal the active tenant id
// (403 TENANT_MISMATCH otherwise). License/device state (Activation rows and
// the '__device__' settings row) is installation-level and never restored.
import { db } from '@/lib/db'
import { ApiError } from '../api'
import { audit } from '../audit'
import { parseBusiness } from '../config'
import { randomUUID } from 'crypto'
import { mkdir, writeFile, readFile, unlink, readdir } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import type { SessionUser } from '../types'

/**
 * Backups live beside the DATABASE file (the OS app-data directory in the
 * packaged desktop build) — NEVER inside the read-only install directory
 * (process.cwd() is C:\Program Files\... for the perMachine NSIS install).
 */
function backupDir(): string {
  const override = process.env.LIBRARY_BACKUP_DIR?.trim()
  if (override) return override
  const url = process.env.DATABASE_URL ?? 'file:../db/custom.db'
  const filePart = url.replace(/^file:/, '')
  const dbPath = filePart.startsWith('/') ? filePart : resolve(process.cwd(), 'prisma', filePart)
  return join(dirname(dbPath), 'backups')
}

const BACKUP_FORMAT = 'library-backup-v1'

// Tenant data tables in RESTORE (parents before children) order.
// 'role' holds system roles (shared) + this tenant's custom roles.
const TABLES = [
  'role',
  'appSettings',
  'user',
  'category',
  'supplier',
  'customer',
  'product',
  'batch',
  'purchase',
  'purchaseItem',
  'sale',
  'saleItem',
  'return',
  'returnItem',
  'stockMovement',
  'suspendedCart',
  'stocktakeSession',
  'stocktakeLine',
  'loyaltyEvent',
  'counter',
  'auditLog',
  'backupRecord',
] as const

type TableName = (typeof TABLES)[number]

/** Tenant filters per table (defense: never export another tenant's rows). */
function tenantWhere(table: TableName, tenantId: string): Record<string, unknown> {
  switch (table) {
    case 'appSettings':
      return { id: tenantId }
    case 'role':
      return { OR: [{ isSystem: true }, { tenantId }] }
    default:
      return { tenantId }
  }
}

async function ensureDir(): Promise<string> {
  const dir = backupDir()
  await mkdir(dir, { recursive: true })
  return dir
}

export interface BackupSummary {
  id: string
  filename: string
  sizeBytes: number
  type: string
  createdAt: string
  note?: string | null
  counts: Record<string, number>
}

export async function createBackup(
  type: 'MANUAL' | 'AUTO' | 'PRE_RESTORE',
  user: SessionUser | null,
  note?: string
): Promise<BackupSummary> {
  const tenantId = 'default'
  const dir = await ensureDir()
  const data: Record<string, unknown[]> = {}
  const counts: Record<string, number> = {}

  for (const table of TABLES) {
    const rows = await (db as any)[table].findMany({ where: tenantWhere(table, tenantId) })
    data[table] = rows
    counts[table] = rows.length
  }

  let tenantName = 'Library_Store'
  try {
    const settings = await db.appSettings.findUnique({ where: { id: tenantId } })
    const business = parseBusiness(settings?.business)
    if (business.businessName?.trim()) tenantName = business.businessName.trim()
  } catch {
    // keep default name
  }

  const meta = {
    app: 'library-store',
    format: BACKUP_FORMAT,
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    tenantId,
    tenantName,
    counts,
  }

  const filename = `library-backup-${Date.now()}-${randomUUID().slice(0, 8)}.json`
  const payload = JSON.stringify({ meta, data }, null, 2)
  await writeFile(join(dir, filename), payload, 'utf8')

  const record = await db.backupRecord.create({
    data: {
      tenantId,
      filename,
      sizeBytes: Buffer.byteLength(payload, 'utf8'),
      type,
      entityCounts: JSON.stringify(counts),
      note: note ?? null,
      userId: user?.id ?? null,
    },
  })

  // update lastBackupAt in the system config of the ACTIVE tenant
  const settings = await db.appSettings.findUnique({ where: { id: tenantId } })
  if (settings) {
    const system = JSON.parse(settings.system || '{}')
    system.lastBackupAt = new Date().toISOString()
    await db.appSettings.update({ where: { id: tenantId }, data: { system: JSON.stringify(system) } })
  }

  if (user) {
    await audit({ userId: user.id, username: user.username }, 'BACKUP_CREATE', {
      entity: 'backup',
      entityId: record.id,
      metadata: { filename, type, sizeBytes: record.sizeBytes, tenantId },
    })
  }

  await applyRetention()

  return {
    id: record.id,
    filename,
    sizeBytes: record.sizeBytes,
    type,
    createdAt: record.createdAt.toISOString(),
    note,
    counts,
  }
}

export async function listBackups(): Promise<BackupSummary[]> {
  const records = await db.backupRecord.findMany({
    where: { tenantId: 'default' },
    orderBy: { createdAt: 'desc' },
  })
  return records.map((r) => ({
    id: r.id,
    filename: r.filename,
    sizeBytes: r.sizeBytes,
    type: r.type,
    createdAt: r.createdAt.toISOString(),
    note: r.note,
    counts: JSON.parse(r.entityCounts || '{}'),
  }))
}

interface BackupFile {
  meta: {
    app: string
    format: string
    version: string
    createdAt: string
    tenantId?: string
    tenantName?: string
    counts: Record<string, number>
  }
  data: Record<string, unknown[]>
}

export async function readBackupFile(filename: string): Promise<BackupFile> {
  if (!/^(qx|library)-backup-[a-zA-Z0-9-]+\.json$/.test(filename)) {
    throw new ApiError('BAD_FILENAME', 'اسم ملف غير صالح', 400)
  }
  let raw: string
  try {
    raw = await readFile(join(backupDir(), filename), 'utf8')
  } catch {
    throw new ApiError('FILE_MISSING', 'ملف النسخة الاحتياطية غير موجود', 404)
  }
  let parsed: BackupFile
  try {
    parsed = JSON.parse(raw) as BackupFile
  } catch {
    throw new ApiError('CORRUPT_BACKUP', 'ملف النسخة الاحتياطية تالف', 422)
  }
  if (
    !parsed.meta ||
    parsed.meta.format !== BACKUP_FORMAT ||
    !parsed.data
  ) {
    throw new ApiError('CORRUPT_BACKUP', 'صيغة النسخة الاحتياطية غير معروفة', 422)
  }
  // Format-version guard: a payload that lacks critical table data cannot be restored
  if (!TABLES.every((table) => Array.isArray(parsed.data[table]))) {
    throw new ApiError(
      'BACKUP_INCOMPATIBLE',
      'النسخة الاحتياطية قديمة وغير متوافقة مع هذا الإصدار. لا يمكن استعادتها.',
      422
    )
  }
  return parsed
}

export async function restoreBackup(user: SessionUser | null, filename: string): Promise<void> {
  const tenantId = 'default'
  const backup = await readBackupFile(filename)

  // safety backup BEFORE touching anything
  await createBackup('PRE_RESTORE', user, `نسخة أمان قبل استعادة ${filename}`)

  // strict tenant filter on EVERY row (tampered files cannot inject foreign rows)
  const pick = (table: TableName): Record<string, unknown>[] => {
    const rows = (backup.data[table] ?? []) as Record<string, unknown>[]
    if (table === 'role') {
      return rows.filter((r) => r.isSystem === true || r.tenantId === tenantId)
    }
    if (table === 'appSettings') {
      return rows.filter((r) => r.id === tenantId)
    }
    return rows.filter((r) => r.tenantId === tenantId)
  }

  const inserts: Record<TableName, Record<string, unknown>[]> = {} as Record<TableName, Record<string, unknown>[]>
  for (const table of TABLES) {
    inserts[table] = pick(table)
  }

  await db.$transaction(
    async (tx) => {
      // wipe ONLY this tenant's rows, children first (reverse restore order);
      // backupRecord rows are device-local operational records and are kept.
      const wipeOrder: TableName[] = [
        'auditLog',
        'counter',
        'loyaltyEvent',
        'stocktakeLine',
        'stocktakeSession',
        'suspendedCart',
        'stockMovement',
        'returnItem',
        'return',
        'saleItem',
        'sale',
        'purchaseItem',
        'purchase',
        'batch',
        'product',
        'customer',
        'supplier',
        'category',
      ]
      for (const table of wipeOrder) {
        await (tx as any)[table].deleteMany({ where: tenantWhere(table, tenantId) })
      }

      // sessions of this tenant's users die with the users (explicit — the
      // caller's own session included; the route clears the cookie)
      await tx.session.deleteMany({ where: { user: { tenantId } } })
      await tx.user.deleteMany({ where: { tenantId } })
      // the tenant settings row is replaced from the backup
      await tx.appSettings.deleteMany({ where: { id: tenantId } })

      // insert in dependency order — roles first (users reference role keys)
      for (const role of inserts.role) {
        const key = String(role.key)
        const existing = await tx.role.findUnique({ where: { key } })
        if (!existing) {
          await tx.role.create({ data: role as never })
        } else if (existing.isSystem || existing.tenantId === tenantId) {
          // restore the role's fields but keep the CURRENT row id stable
          await tx.role.update({
            where: { key },
            data: {
              tenantId: (role.tenantId as string | null) ?? null,
              nameAr: String(role.nameAr ?? existing.nameAr),
              nameEn: String(role.nameEn ?? existing.nameEn),
              description: (role.description as string | null) ?? null,
              permissions: String(role.permissions ?? existing.permissions),
              isSystem: role.isSystem === true,
            },
          })
        } else {
          // key taken by another tenant's custom role — refuse instead of overwriting
          throw new ApiError(
            'RESTORE_CONFLICT',
            `تعارض في الاستعادة: مفتاح الدور "${key}" مستخدم بالفعل في فرع آخر`,
            409
          )
        }
      }
      for (const s of inserts.appSettings) await tx.appSettings.create({ data: s as never })
      for (const u of inserts.user) await tx.user.create({ data: u as never })
      for (const c of inserts.category) await tx.category.create({ data: c as never })
      for (const s of inserts.supplier) await tx.supplier.create({ data: s as never })
      for (const c of inserts.customer) await tx.customer.create({ data: c as never })
      for (const p of inserts.product) await tx.product.create({ data: p as never })
      for (const b of inserts.batch) await tx.batch.create({ data: b as never })
      for (const p of inserts.purchase) await tx.purchase.create({ data: p as never })
      for (const i of inserts.purchaseItem) await tx.purchaseItem.create({ data: i as never })
      for (const s of inserts.sale) await tx.sale.create({ data: s as never })
      for (const i of inserts.saleItem) await tx.saleItem.create({ data: i as never })
      for (const r of inserts.return) await tx.return.create({ data: r as never })
      for (const i of inserts.returnItem) await tx.returnItem.create({ data: i as never })
      for (const m of inserts.stockMovement) await tx.stockMovement.create({ data: m as never })
      for (const s of inserts.suspendedCart) await tx.suspendedCart.create({ data: s as never })
      for (const s of inserts.stocktakeSession) await tx.stocktakeSession.create({ data: s as never })
      for (const l of inserts.stocktakeLine) await tx.stocktakeLine.create({ data: l as never })
      for (const le of inserts.loyaltyEvent) await tx.loyaltyEvent.create({ data: le as never })
      for (const c of inserts.counter) await tx.counter.create({ data: c as never })
      for (const a of inserts.auditLog) await tx.auditLog.create({ data: a as never })
      // NOTE: backupRecord rows are intentionally NOT replaced — they track
      // the backup files physically present on THIS device.
    },
    { timeout: 60000 }
  )

  if (user) {
    await audit({ userId: user.id, username: user.username }, 'BACKUP_RESTORE', {
      entity: 'backup',
      metadata: { filename, tenantId },
    })
  }
}

export async function deleteBackup(user: SessionUser | null, id: string): Promise<void> {
  const tenantId = 'default'
  const record = await db.backupRecord.findFirst({
    where: { id, tenantId },
  })
  if (!record) throw new ApiError('NOT_FOUND', 'النسخة غير موجودة', 404)
  await unlink(join(backupDir(), record.filename)).catch(() => undefined)
  await db.backupRecord.delete({ where: { id } })
  if (user) {
    await audit({ userId: user.id, username: user.username }, 'BACKUP_DELETE', {
      entity: 'backup',
      entityId: id,
      metadata: { filename: record.filename },
    })
  }
}

/** Keeps only the newest N backups of the ACTIVE tenant (by type combined). */
async function applyRetention(): Promise<void> {
  const { parseBackup } = await import('../config')
  const tenantId = 'default'
  const settings = await db.appSettings.findUnique({ where: { id: tenantId } })
  const cfg = parseBackup(settings?.backup)
  const records = await db.backupRecord.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  })
  const excess = records.slice(cfg.retentionCount)
  for (const record of excess) {
    await unlink(join(backupDir(), record.filename)).catch(() => undefined)
    await db.backupRecord.delete({ where: { id: record.id } }).catch(() => undefined)
  }
}

/** Storage stats for diagnostics (device-level: physical files on disk). */
export async function backupStorageStats(): Promise<{ files: number; totalBytes: number }> {
  await ensureDir()
  const files = await readdir(backupDir())
  let totalBytes = 0
  for (const f of files) {
    try {
      const stat = await readFile(join(backupDir(), f))
      totalBytes += stat.byteLength
    } catch {
      // ignore unreadable files
    }
  }
  return { files: files.length, totalBytes }
}
