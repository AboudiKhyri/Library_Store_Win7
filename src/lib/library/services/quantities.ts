/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Supermarket quantity validation
// Weighable products (kg / g / l / ml) accept fractional quantities with at
// most `weightQtyDecimals` fractional digits (POS settings); everything else
// is sold in whole units. Applied consistently across sales, returns,
// purchase items, inventory adjustments and stocktake lines.
import { ApiError } from '../api'
import { r3 } from '../money'

export interface QtyRuleProduct {
  isWeighable: boolean
  nameAr: string
}

const QTY_MAX = 10_000_000

/** Normalized weightQtyDecimals (0..6, defaults to 3). */
export function weightDecimals(raw: unknown): number {
  const n = Math.trunc(Number(raw))
  if (!Number.isFinite(n)) return 3
  return Math.min(6, Math.max(0, n))
}

/**
 * Validates a raw line-item quantity against the product's weighable flag.
 * Returns the quantity to persist (r3-snapped for weighable products).
 * `allowZero` permits a zero count (inventory adjustments / stocktake lines).
 */
export function validateQuantity(
  product: QtyRuleProduct,
  raw: unknown,
  decimals: number,
  opts: { what?: string; allowZero?: boolean } = {}
): number {
  const label = opts.what ?? `الصنف ${product.nameAr}`
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n) || n < 0 || (n === 0 && !opts.allowZero)) {
    throw new ApiError('QTY_INVALID', `الكمية يجب أن تكون رقماً أكبر من صفر (${label})`, 400)
  }
  if (n > QTY_MAX) {
    throw new ApiError('QTY_INVALID', `الكمية كبيرة جداً (${label})`, 400)
  }
  if (n === 0) return 0
  if (product.isWeighable) {
    const maxDecimals = weightDecimals(decimals)
    const factor = 10 ** maxDecimals
    if (Math.abs(n * factor - Math.round(n * factor)) > 1e-6) {
      throw new ApiError(
        'QTY_FRACTION_INVALID',
        `كمية ${product.nameAr} تقبل ${maxDecimals} خانات عشرية كحد أقصى (منتج يُوزن)`,
        400
      )
    }
    return r3(n)
  }
  if (!Number.isInteger(n)) {
    throw new ApiError(
      'QTY_INTEGER_REQUIRED',
      `كمية ${product.nameAr} يجب أن تكون عدداً صحيحاً (منتج لا يُوزن — لا تُقبل الكسور)`,
      400
    )
  }
  return n
}
