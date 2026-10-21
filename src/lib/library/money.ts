/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Money / number formatting driven by configuration
import type { PosConfig, LocalizationConfig } from './types'

export function formatMoney(amount: number, pos: PosConfig, loc?: LocalizationConfig): string {
  const n = Number.isFinite(amount) ? amount : 0
  const formatted = new Intl.NumberFormat(loc?.language === 'en' ? 'en-EG' : 'ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    numberingSystem: loc?.numberFormat === 'arab' ? 'arab' : 'latn',
  }).format(n)
  return `${formatted} ${pos.currencySymbol}`
}

export function formatNumber(n: number, loc?: LocalizationConfig): string {
  return new Intl.NumberFormat(loc?.language === 'en' ? 'en-EG' : 'ar-EG', {
    numberingSystem: loc?.numberFormat === 'arab' ? 'arab' : 'latn',
  }).format(Number.isFinite(n) ? n : 0)
}

export function toSafeDate(val: unknown): Date | null {
  if (val === null || val === undefined || val === '') return null
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val
  }
  if (typeof val === 'number') {
    const d = new Date(val)
    return isNaN(d.getTime()) ? null : d
  }
  if (typeof val === 'string') {
    const s = val.trim()
    if (!s) return null
    let iso = s
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) {
      iso = s.replace(' ', 'T') + (s.endsWith('Z') ? '' : 'Z')
    }
    const d = new Date(iso)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

export function formatDate(d: unknown, lang: 'ar' | 'en' = 'ar'): string {
  const date = toSafeDate(d)
  if (!date) return '-'
  try {
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date)
  } catch {
    return '-'
  }
}

export function formatDateTime(d: unknown, lang: 'ar' | 'en' = 'ar'): string {
  const date = toSafeDate(d)
  if (!date) return '-'
  try {
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  } catch {
    return '-'
  }
}

export function daysUntil(d: unknown): number {
  const date = toSafeDate(d)
  if (!date) return 0
  const now = new Date()
  const a = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((a - b) / 86400000)
}

/** Rounds to 2 decimals safely (float arithmetic guard). */
export function r2(n: number): number {
  return Math.round(((Number.isFinite(n) ? n : 0) + Number.EPSILON) * 100) / 100
}

/**
 * Rounds to 3 decimals — the write-boundary guard for supermarket quantities
 * (weighable products: kg / g / l / ml). Money stays r2; quantities stay r3.
 */
export function r3(n: number): number {
  return Math.round(((Number.isFinite(n) ? n : 0) + Number.EPSILON) * 1000) / 1000
}
