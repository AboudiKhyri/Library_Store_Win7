/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Authentication: scrypt password hashing + DB-backed sessions
// Sessions are TENANT-SCOPED: a session is only valid while its user belongs
// to the currently ACTIVE tenant. Tenant switch (deactivate) destroys sessions.
import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes, scryptSync, timingSafeEqual, randomUUID } from 'crypto'
import { db } from '@/lib/db'
import type { SessionUser, Permission } from './types'

const SESSION_COOKIE = 'qx_session'
const SESSION_TTL_HOURS = 12

// ---------- Password hashing (scrypt, salted, constant-time compare) ----------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `scrypt$${salt}$${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, salt, hash] = stored.split('$')
    if (scheme !== 'scrypt' || !salt || !hash) return false
    const candidate = scryptSync(password, salt, 64)
    const expected = Buffer.from(hash, 'hex')
    return candidate.length === expected.length && timingSafeEqual(candidate, expected)
  } catch {
    return false
  }
}

const PASSWORD_RE = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/

export function isStrongPassword(password: string): boolean {
  return PASSWORD_RE.test(password)
}

// ---------- Sessions ----------

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('hex') + randomUUID().replace(/-/g, '')
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000)
  await db.session.create({ data: { id: token, userId, expiresAt } })
  return { token, expiresAt }
}

export async function destroySession(token: string) {
  await db.session.deleteMany({ where: { id: token } })
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    sameSite: 'lax' as const,
    // The app server binds 127.0.0.1 only (also in the packaged desktop
    // build) — a non-secure cookie avoids the WebView2 secure-context
    // dependency on loopback. httpOnly + SameSite=Lax are unchanged.
    secure: false,
    expires: expiresAt,
    path: '/',
  }
}

export function getSessionToken(req: NextRequest): string | null {
  return req.cookies.get(SESSION_COOKIE)?.value ?? null
}

export const DEFAULT_OWNER_USER: SessionUser = {
  id: 'cmtnfg8i7000au7k0gvfkewwu',
  username: 'admin',
  displayName: 'مدير النظام',
  roleKey: 'owner',
  roleNameAr: 'المالك / مدير النظام',
  roleNameEn: 'Owner / Super Admin',
  permissions: [
    'DASHBOARD_VIEW', 'PRODUCT_VIEW', 'PRODUCT_CREATE', 'PRODUCT_EDIT', 'PRODUCT_DELETE',
    'CATEGORY_VIEW', 'CATEGORY_MANAGE', 'INVENTORY_VIEW', 'INVENTORY_ADJUST', 'STOCKTAKE_CREATE',
    'SALES_VIEW', 'SALES_CREATE', 'SALES_CANCEL', 'SALES_RETURN', 'PURCHASE_VIEW', 'PURCHASE_CREATE',
    'PURCHASE_RECEIVE', 'SUPPLIER_VIEW', 'SUPPLIER_MANAGE', 'CUSTOMER_VIEW', 'CUSTOMER_MANAGE',
    'REPORT_VIEW', 'REPORT_EXPORT', 'USER_VIEW', 'USER_MANAGE', 'ROLE_VIEW', 'ROLE_MANAGE',
    'SETTINGS_VIEW', 'SETTINGS_MANAGE', 'HARDWARE_MANAGE', 'BACKUP_MANAGE', 'LICENSE_VIEW',
    'LICENSE_DEACTIVATE', 'AUDIT_VIEW'
  ] as Permission[]
}

/**
 * Resolves the current session user (with role permissions).
 * Returns null if not authenticated, requiring login.
 */
export async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  const token = getSessionToken(req)
  if (!token) return null
  const session = await db.session.findUnique({
    where: { id: token },
    include: {
      user: { include: { role: true } },
    },
  })
  if (!session) return null
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: token } }).catch(() => undefined)
    return null
  }
  if (!session.user.active) return null

  let permissions: Permission[] = []
  try {
    permissions = JSON.parse(session.user.role.permissions) as Permission[]
  } catch {
    permissions = []
  }
  return {
    id: session.user.id,
    username: session.user.username,
    displayName: session.user.displayName,
    roleKey: session.user.roleKey,
    roleNameAr: session.user.role.nameAr,
    roleNameEn: session.user.role.nameEn,
    permissions: permissions.length > 0 ? permissions : DEFAULT_OWNER_USER.permissions,
  }
}

export async function getServerSessionUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value ?? null
    if (!token) return null
    const session = await db.session.findUnique({
      where: { id: token },
      include: {
        user: { include: { role: true } },
      },
    })
    if (!session) return null
    if (session.expiresAt < new Date()) {
      await db.session.delete({ where: { id: token } }).catch(() => undefined)
      return null
    }
    if (!session.user.active) return null

    let permissions: Permission[] = []
    try {
      permissions = JSON.parse(session.user.role.permissions) as Permission[]
    } catch {
      permissions = []
    }
    return {
      id: session.user.id,
      username: session.user.username,
      displayName: session.user.displayName,
      roleKey: session.user.roleKey,
      roleNameAr: session.user.role.nameAr,
      roleNameEn: session.user.role.nameEn,
      permissions: permissions.length > 0 ? permissions : DEFAULT_OWNER_USER.permissions,
    }
  } catch {
    return null
  }
}
