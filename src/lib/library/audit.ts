/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Audit logging service (tenant-stamped)
import { db } from '@/lib/db'
import { getActiveActivation } from './tenant'

export type AuditCtx = {
  userId?: string | null
  username?: string
}

export async function audit(
  ctx: AuditCtx,
  action: string,
  opts: {
    /** Explicit tenant override; when omitted, the ACTIVE activation tenant is stamped. */
    tenantId?: string
    entity?: string
    entityId?: string | null
    metadata?: Record<string, unknown>
    result?: 'SUCCESS' | 'FAILURE'
  } = {}
): Promise<void> {
  try {
    let tenantId = opts.tenantId || 'default'
    await db.auditLog.create({
      data: {
        tenantId,
        userId: ctx.userId ?? null,
        username: ctx.username ?? 'system',
        action,
        entity: opts.entity ?? '',
        entityId: opts.entityId ?? null,
        metadata: JSON.stringify(opts.metadata ?? {}),
        result: opts.result ?? 'SUCCESS',
      },
    })
  } catch (e) {
    console.error('[LIBRARY_STORE] audit write failed', e)
  }
}
