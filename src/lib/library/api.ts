/**
 * LIBRARY_STORE — API Route Helpers & Route Guards
 * 100% Offline Standalone Architecture
 */

import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import type { Entitlements, Permission } from './types'
import { getSessionUser } from './auth'

export class ApiError extends Error {
  code: string
  status: number
  /** Optional machine-readable payload (e.g. health-check results). */
  details?: unknown
  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message)
    this.code = code
    this.status = status
    this.details = details
  }
}

export function ok<T>(data: T, init?: number) {
  return NextResponse.json({ ok: true, data }, { status: init ?? 200 })
}

export function fail(code: string, message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: details === undefined ? { code, message } : { code, message, details } },
    { status }
  )
}

/** Wraps a route handler: catches ApiError and unexpected errors with reference IDs. */
export async function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof ApiError) {
      return fail(e.code, e.message, e.status, e.details)
    }
    const errorId = randomBytes(6).toString('hex').toUpperCase()
    console.error(`[LIBRARY_STORE][ERR-${errorId}]`, e)
    return fail(
      'INTERNAL',
      `حدث خطأ غير متوقع — رقم مرجعي ${errorId} | Unexpected error — ref ${errorId}`,
      500
    )
  }
}

/** Requires a signed-in user; throws 401. */
export async function requireUser(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) throw new ApiError('UNAUTHORIZED', 'انتهت الجلسة — أعد تسجيل الدخول', 401)
  return user
}

/** Requires a signed-in user holding the given permission; throws 401/403. */
export async function requirePermission(req: NextRequest, permission: Permission) {
  const user = await requireUser(req)
  if (!user.permissions.includes(permission)) {
    throw new ApiError(
      'FORBIDDEN',
      `ليس لديك صلاحية لتنفيذ هذا الإجراء (${permission})`,
      403
    )
  }
  return user
}

/**
 * Full business-route guard: session + offline tenant context.
 * Returns { user, tenantId: 'default' }.
 */
export async function requireReady(
  req: NextRequest,
  _opts?: { entitlement?: keyof Entitlements }
): Promise<{ user: Awaited<ReturnType<typeof requireUser>>; tenantId: string }> {
  const user = await requireUser(req)
  return { user, tenantId: 'default' }
}

export async function readJson<T>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T
  } catch {
    throw new ApiError('BAD_JSON', 'طلب غير صالح', 400)
  }
}

export function pageParams(url: URL, defaultSize = 20) {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || String(defaultSize), 10) || defaultSize))
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize }
}

export function dateRange(url: URL): { from: Date; to: Date } | null {
  const f = url.searchParams.get('from')
  const t = url.searchParams.get('to')
  if (!f && !t) return null
  const to = t ? new Date(t) : new Date()
  to.setHours(23, 59, 59, 999)
  const from = f ? new Date(f) : new Date(to.getTime() - 29 * 86400000)
  from.setHours(0, 0, 0, 0)
  return { from, to }
}
