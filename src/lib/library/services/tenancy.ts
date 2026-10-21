/**
 * LIBRARY_STORE — Tenancy & Document Numbering Service
 * 100% Offline Standalone Architecture
 */

import { NextRequest } from 'next/server'
import { ApiError, requireReady } from '../api'
import type { Entitlements, Permission, SessionUser } from '../types'
import type { Prisma } from '@prisma/client'

type Tx = Prisma.TransactionClient

const ALL_ENTITLEMENTS: Entitlements = {
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
}

/**
 * Returns full entitlements for the offline store.
 */
export function entitlementsOf(_activation?: unknown): Entitlements {
  return ALL_ENTITLEMENTS
}

/**
 * Active-tenant resolution for services (always 'default' in offline standalone).
 */
export async function serviceTenant(): Promise<{ tenantId: string }> {
  return { tenantId: 'default' }
}

/**
 * Combined route guard for every business route: requireReady plus permission check.
 */
export async function requireReadyPermission(
  req: NextRequest,
  permission: Permission,
  opts?: { entitlement?: keyof Entitlements }
): Promise<{ user: SessionUser; tenantId: string }> {
  const ctx = await requireReady(req, opts)
  if (!ctx.user.permissions.includes(permission)) {
    throw new ApiError('FORBIDDEN', `ليس لديك صلاحية لتنفيذ هذا الإجراء (${permission})`, 403)
  }
  return ctx
}

/** Compact document tag for document numbering. */
export function tenantDocTag(tenantId = 'default'): string {
  return tenantId === 'default' ? 'STORE' : tenantId.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'STORE'
}

/**
 * Atomically increments the store document counter and formats a document
 * number: `<PREFIX>-<year>-<TENANTTAG>-<000001>`.
 */
export async function nextDocNo(
  tx: Tx,
  tenantId: string,
  key: 'sale' | 'purchase' | 'return',
  prefix: 'INV' | 'PUR' | 'RET'
): Promise<string> {
  const tid = tenantId || 'default'
  let value: number | null = null

  for (let attempt = 0; attempt < 2 && value === null; attempt++) {
    const updated = await tx.counter
      .update({
        where: { tenantId_key: { tenantId: tid, key } },
        data: { value: { increment: 1 } },
      })
      .catch(() => null)
    if (updated) {
      value = updated.value
      continue
    }
    const created = await tx.counter
      .create({ data: { tenantId: tid, key, value: 1 } })
      .catch(() => null)
    if (created) value = created.value
  }

  if (value === null) {
    const row = await tx.counter.findUnique({ where: { tenantId_key: { tenantId: tid, key } } })
    value = (row?.value ?? 0) + 1
    await tx.counter.update({
      where: { tenantId_key: { tenantId: tid, key } },
      data: { value },
    })
  }

  return `${prefix}-${new Date().getFullYear()}-${tenantDocTag(tid)}-${String(value).padStart(6, '0')}`
}
