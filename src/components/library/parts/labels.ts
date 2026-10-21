'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — shared label/enum→text helpers for screens
import type { Lang } from '@/lib/library/i18n'

export function paymentLabel(method: string, lang: Lang): string {
  const map: Record<string, [string, string]> = {
    cash: ['نقدي', 'Cash'],
    card: ['بطاقة', 'Card'],
    wallet: ['محفظة إلكترونية', 'Wallet'],
  }
  return (map[method] ?? [method, method])[lang === 'ar' ? 0 : 1]
}

export function saleStatusLabel(status: string, lang: Lang): string {
  const map: Record<string, [string, string]> = {
    COMPLETED: ['مكتملة', 'Completed'],
    CANCELLED: ['ملغاة', 'Cancelled'],
    RETURNED: ['مرتجعة كاملة', 'Fully returned'],
    PARTIALLY_RETURNED: ['مرتجع جزئي', 'Partially returned'],
  }
  return (map[status] ?? [status, status])[lang === 'ar' ? 0 : 1]
}

export function purchaseStatusLabel(status: string, lang: Lang): string {
  const map: Record<string, [string, string]> = {
    DRAFT: ['مسودة', 'Draft'],
    RECEIVED: ['مستلمة', 'Received'],
    CANCELLED: ['ملغاة', 'Cancelled'],
  }
  return (map[status] ?? [status, status])[lang === 'ar' ? 0 : 1]
}

export function paymentStatusBadge(status: string, lang: Lang): string {
  const map: Record<string, [string, string]> = {
    UNPAID: ['غير مدفوعة', 'Unpaid'],
    PARTIAL: ['مدفوعة جزئياً', 'Partial'],
    PAID: ['مدفوعة', 'Paid'],
  }
  return (map[status] ?? [status, status])[lang === 'ar' ? 0 : 1]
}

export function movementTypeLabel(type: string, lang: Lang): string {
  const map: Record<string, [string, string]> = {
    PURCHASE_RECEIVE: ['استلام شراء', 'Purchase receive'],
    SALE: ['بيع', 'Sale'],
    SALE_CANCEL_RESTOCK: ['إرجاع إلغاء فاتورة', 'Cancel restock'],
    RETURN_IN: ['مرتجع داخل', 'Return in'],
    ADJUSTMENT: ['تسوية', 'Adjustment'],
    DAMAGE: ['تلف', 'Damage'],
    EXPIRY_WRITEOFF: ['إعدام/تسوية مخزنية', 'Write-off adjustment'],
    STOCKTAKE: ['جرد', 'Stocktake'],
    INITIAL: ['رصيد افتتاحي', 'Initial'],
  }
  return (map[type] ?? [type, type])[lang === 'ar' ? 0 : 1]
}

export function unitLabel(unit: string, lang: Lang): string {
  // supermarket units of measure — any other key falls back to the key itself
  const map: Record<string, [string, string]> = {
    piece: ['قطعة', 'piece'],
    pack: ['عبوة', 'pack'],
    box: ['علبة', 'box'],
    kg: ['كيلوجرام', 'kg'],
    g: ['جرام', 'g'],
    l: ['لتر', 'l'],
    ml: ['مللي', 'ml'],
  }
  return (map[unit] ?? [unit, unit])[lang === 'ar' ? 0 : 1]
}

export function expiryState(_expiry: string | Date | null, _warningDays: number): 'VALID' {
  return 'VALID'
}

export function daysLabel(days: number, lang: Lang): string {
  if (days < 0) return lang === 'ar' ? `منتهي منذ ${Math.abs(days)} يوم` : `expired ${Math.abs(days)}d ago`
  return lang === 'ar' ? `${days} يوم` : `${days}d`
}
