'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — client API helper (typed envelope over fetch)
// Gate-aware: LICENSE_LOCKED (423), NO_TENANT (403) and PROVISIONING_INCOMPLETE
// (409) responses notify a registered listener so the app gate can refresh
// SystemStatus immediately and re-render the correct screen.
import type { ApiResult } from '@/lib/library/types'

export class ApiClientError extends Error {
  code: string
  status: number
  details?: unknown
  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message)
    this.code = code
    this.status = status
    this.details = details
  }
}

/** Error codes that mean the store session/provisioning gate state changed. */
const GATE_CODES = new Set(['NO_TENANT', 'PROVISIONING_INCOMPLETE', 'ALREADY_PROVISIONED'])

type GateListener = (code: string) => void
let gateListener: GateListener | null = null

type AuthListener = () => void
let authListener: AuthListener | null = null

/** Registered once by the app store — called on session 401/expiry. */
export function onAuthError(listener: AuthListener | null) {
  authListener = listener
}

/** Registered once by the app store — called on gate-state errors. */
export function onGateError(listener: GateListener | null) {
  gateListener = listener
}

export async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}
): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api/library${path}`, {
      method: opts.method ?? 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
      cache: 'no-store',
    })
  } catch {
    throw new ApiClientError('تعذر الاتصال بالخادم — تحقق من التشغيل المحلي', 'NETWORK', 0)
  }
  let json: ApiResult<T>
  try {
    json = (await res.json()) as ApiResult<T>
  } catch {
    throw new ApiClientError('استجابة غير صالحة من الخادم', 'BAD_RESPONSE', res.status)
  }
  if (!json.ok) {
    const code = json.error?.code ?? 'UNKNOWN'
    if ((res.status === 401 || code === 'UNAUTHORIZED') && authListener && path !== '/auth/session' && path !== '/auth/login') {
      try {
        authListener()
      } catch {
        // ignore
      }
    }
    if (GATE_CODES.has(code) && gateListener) {
      try {
        gateListener(code)
      } catch {
        // listener errors never break the API call
      }
    }
    throw new ApiClientError(json.error?.message ?? 'خطأ غير معروف', code, res.status, json.error?.details)
  }
  return json.data
}

export function errMessage(e: unknown): string {
  if (e instanceof ApiClientError) return e.message
  if (e instanceof Error) return e.message
  return 'حدث خطأ غير متوقع'
}
