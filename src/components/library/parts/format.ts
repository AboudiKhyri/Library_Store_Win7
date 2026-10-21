'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — client-safe quantity formatting for the supermarket catalog.
// Weighable products (sold by weight) carry fractional quantities; everything
// else is integer-count. Keep this file free of server imports.

export const DEFAULT_WEIGHT_QTY_DECIMALS = 3

/**
 * Format a quantity for display.
 * - Non-weighable: integers are shown plain (5 → "5").
 * - Weighable: fractional values are trimmed to `decimals` places
 *   without trailing zeros (1.25 → "1.25", 1.250 → "1.25").
 */
export function formatQty(
  qty: number | null | undefined,
  weighable: boolean | null | undefined,
  decimals: number = DEFAULT_WEIGHT_QTY_DECIMALS
): string {
  const n = Number(qty)
  if (!Number.isFinite(n)) return weighable ? `0${decimals > 0 ? '.' + '0'.repeat(Math.min(decimals, 1)) : ''}` : '0'
  if (!weighable) {
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000)
  }
  const places = Math.max(0, Math.min(6, Number.isFinite(decimals) ? decimals : DEFAULT_WEIGHT_QTY_DECIMALS))
  const fixed = n.toFixed(places)
  // trim trailing zeros but keep at least one decimal for weighable values
  const trimmed = fixed.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
  return trimmed.includes('.') ? trimmed : trimmed
}

/** Clamp a raw quantity input to the POS rules (integer vs weight decimals). */
export function clampQty(
  raw: number,
  weighable: boolean,
  decimals: number = DEFAULT_WEIGHT_QTY_DECIMALS
): number {
  if (!Number.isFinite(raw) || raw <= 0) return weighable ? 0.001 : 1
  if (!weighable) return Math.max(1, Math.round(raw))
  const places = Math.max(0, Math.min(6, Number.isFinite(decimals) ? decimals : DEFAULT_WEIGHT_QTY_DECIMALS))
  return Math.round(raw * 10 ** places) / 10 ** places
}

/** Units considered weight/volume (fractional quantity) in the supermarket. */
export const WEIGHT_UNITS = new Set(['kg', 'g', 'l', 'ml'])
