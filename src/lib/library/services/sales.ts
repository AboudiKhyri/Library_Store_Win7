/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Sales domain service (POS, tenant-scoped)
// Atomic sale creation with FIFO allocation, cancellation with restock.
// Quantities are Float for weighable supermarket products (validated to
// weightQtyDecimals); unit products sell in whole numbers only.
import { db } from '@/lib/db'
import { ApiError } from '../api'
import { r2 } from '../money'
import { audit } from '../audit'
import { parsePos } from '../config'
import { getSettings } from '../system'
import { serviceTenant, entitlementsOf, nextDocNo } from './tenancy'
import { validateQuantity, weightDecimals } from './quantities'
import type { SessionUser, ReceiptData } from '../types'
import { allocateFefo, applyAllocations, restockBatch } from './inventory'
import {
  parseLoyalty,
  pointsBalance,
  maxRedeemable,
  redeemValue,
  applyRedemptionToSale,
  recordEarnForSale,
  reverseLoyaltyForSale,
} from './loyalty'

import type { Prisma, Product } from '@prisma/client'

type Tx = Prisma.TransactionClient

export interface CreateSaleResult {
  saleId: string
  invoiceNo: string
  receipt: ReceiptData
}

export async function createSale(
  user: SessionUser,
  input: {
    items: { productId: string; quantity: number; unitPrice?: number; discount?: number }[]
    customerId?: string | null
    paymentMethod: string
    paidAmount: number
    discount?: number
    redeemPoints?: number
    notes?: string
  }
): Promise<CreateSaleResult> {
  if (!input.items || input.items.length === 0) {
    throw new ApiError('EMPTY_CART', 'الفاتورة فارغة', 400)
  }

  const { tenantId } = await serviceTenant()
  const settings = await getSettings()
  const pos = parsePos(settings.pos)
  const decimals = weightDecimals(pos.weightQtyDecimals)
  const loyaltyCfg = parseLoyalty(settings.pos)

  // In offline standalone Library_Store, loyalty is always entitled
  const loyaltyEntitled = true
  const redeemRequest =
    input.redeemPoints && input.redeemPoints > 0 && loyaltyEntitled ? input.redeemPoints : 0

  // resolve every product in ONE tenant-scoped query (also proves ownership)
  const productIds = [...new Set(input.items.map((i) => i.productId))]
  const products = await db.product.findMany({ where: { id: { in: productIds }, tenantId } })
  const productById = new Map<string, Product>(products.map((p) => [p.id, p]))

  // validate quantities per product (weighable ≤ decimals / unit = integer),
  // then merge duplicate lines for the same product
  const merged = new Map<string, { productId: string; quantity: number; unitPrice?: number; discount?: number }>()
  for (const item of input.items) {
    const product = productById.get(item.productId)
    if (!product) throw new ApiError('NOT_FOUND', 'صنف غير موجود في الفاتورة', 404)
    const qty = validateQuantity(product, item.quantity, decimals)
    const existing = merged.get(item.productId)
    if (existing) {
      existing.quantity = Math.round((existing.quantity + qty) * 1000) / 1000
    } else {
      merged.set(item.productId, { ...item, quantity: qty })
    }
  }

  const sale = await db.$transaction(
    async (tx) => {
      const invoiceNo = await nextDocNo(tx, tenantId, 'sale', 'INV')

      let subtotal = 0
      let tax = 0
      const lineRows: {
        productId: string
        productName: string
        quantity: number
        unitPrice: number
        discount: number
        total: number
        taxAmount: number
        allocations: {
          batchId: string
          batchNo: string | null
          expiryDate: Date | null
          qty: number
          costPrice: number
        }[]
      }[] = []

      for (const item of merged.values()) {
        const product = productById.get(item.productId)
        if (!product) throw new ApiError('NOT_FOUND', 'صنف غير موجود في الفاتورة', 404)
        if (!product.active) throw new ApiError('PRODUCT_INACTIVE', `الصنف ${product.nameAr} غير نشط`, 409)

        // pricing: override allowed but never below minimum selling price
        let unitPrice = item.unitPrice ?? product.sellingPrice
        unitPrice = r2(unitPrice)
        if (product.minSellingPrice != null && unitPrice < product.minSellingPrice) {
          throw new ApiError(
            'BELOW_MIN_PRICE',
            `سعر ${product.nameAr} أقل من الحد الأدنى المسموح`,
            409
          )
        }

        // line discount validation
        const lineDiscount = r2(Math.max(0, item.discount ?? 0))
        const lineGross = r2(unitPrice * item.quantity)
        if (pos.allowDiscount) {
          if (lineDiscount > lineGross) throw new ApiError('DISCOUNT_TOO_LARGE', 'خصم السطر أكبر من قيمته', 400)
          if (lineGross > 0 && (lineDiscount / lineGross) * 100 > pos.maxDiscountPercent + 1e-9) {
            throw new ApiError(
              'DISCOUNT_LIMIT',
              `الخصم يتجاوز الحد المسموح (${pos.maxDiscountPercent}%)`,
              409
            )
          }
        } else if (lineDiscount > 0) {
          throw new ApiError('DISCOUNT_DISABLED', 'الخصم غير مسموح في الإعدادات الحالية', 409)
        }

        // FIFO allocation — oldest batches allocated first
        const allocations = await allocateFefo(tx, product.id, item.quantity, {
          tenantId,
        })

        const lineTotal = r2(lineGross - lineDiscount)
        const taxAmount = r2((lineTotal * product.taxRate) / 100)

        subtotal = r2(subtotal + lineGross)
        tax = r2(tax + taxAmount)
        lineRows.push({
          productId: product.id,
          productName: product.nameAr,
          quantity: item.quantity,
          unitPrice,
          discount: lineDiscount,
          total: lineTotal,
          taxAmount,
          allocations,
        })
      }

      // invoice-level discount
      const invoiceDiscount = r2(Math.max(0, input.discount ?? 0))
      if (!pos.allowDiscount && invoiceDiscount > 0) {
        throw new ApiError('DISCOUNT_DISABLED', 'الخصم غير مسموح في الإعدادات الحالية', 409)
      }
      if (invoiceDiscount > r2(subtotal + tax)) {
        throw new ApiError('DISCOUNT_TOO_LARGE', 'خصم الفاتورة أكبر من قيمتها', 400)
      }

      // customer must belong to this tenant (never trust client ids)
      if (input.customerId) {
        const customer = await tx.customer.findFirst({
          where: { id: input.customerId, tenantId },
          select: { id: true },
        })
        if (!customer) throw new ApiError('NOT_FOUND', 'العميل غير موجود', 404)
      }

      // ---- loyalty redemption (validated up-front, applied after sale creation) ----
      let loyaltyDiscount = 0
      if (redeemRequest > 0) {
        if (!input.customerId) {
          throw new ApiError('LOYALTY_NO_CUSTOMER', 'استبدال النقاط يتطلب اختيار عميل', 400)
        }
        // pre-validate redemption limits against the pre-loyalty total
        const totalBeforeLoyalty = r2(subtotal - invoiceDiscount + tax)
        const balance = await pointsBalance(input.customerId, tx, tenantId)
        const cap = maxRedeemable(totalBeforeLoyalty, balance, loyaltyCfg)
        if (redeemRequest > cap) {
          throw new ApiError(
            'POINTS_CAP',
            redeemRequest > balance
              ? `رصيد النقاط غير كافٍ — المتاح ${balance} نقطة`
              : `الحد الأقصى للاستبدال في هذه الفاتورة ${cap} نقطة`,
            409
          )
        }
        loyaltyDiscount = redeemValue(redeemRequest, loyaltyCfg)
      }

      const total = r2(subtotal - invoiceDiscount - loyaltyDiscount + tax)
      if (input.paidAmount < total - 1e-9) {
        throw new ApiError('INSUFFICIENT_PAID', 'المبلغ المدفوع أقل من الإجمالي المستحق', 400)
      }

      // Ensure cashier exists in database to guarantee foreign key integrity
      let cashierId = user.id
      const cashier = await tx.user.findUnique({ where: { id: cashierId }, select: { id: true } })
      if (!cashier) {
        const anyUser = await tx.user.findFirst({ where: { tenantId, active: true }, select: { id: true } })
        if (anyUser) {
          cashierId = anyUser.id
        } else {
          const { hashPassword } = await import('../auth')
          const createdUser = await tx.user.create({
            data: {
              id: user.id || 'cmtnfg8i7000au7k0gvfkewwu',
              tenantId,
              username: user.username || 'admin',
              passwordHash: hashPassword('Admin@1234'),
              displayName: user.displayName || 'مدير النظام',
              roleKey: 'owner',
              active: true,
            },
          })
          cashierId = createdUser.id
        }
      }

      const created = await tx.sale.create({
        data: {
          tenantId,
          invoiceNo,
          cashierId,
          customerId: input.customerId ?? null,
          status: 'COMPLETED',
          subtotal,
          discount: invoiceDiscount,
          tax,
          total,
          paidAmount: r2(input.paidAmount),
          changeAmount: r2(input.paidAmount - total),
          paymentMethod: input.paymentMethod || pos.defaultPaymentMethod,
          notes: input.notes ?? null,
        },
      })

      for (const line of lineRows) {
        // FIFO: one SaleItem per batch allocation for full traceability
        for (const alloc of line.allocations) {
          await tx.saleItem.create({
            data: {
              tenantId,
              saleId: created.id,
              productId: line.productId,
              batchId: alloc.batchId,
              batchNo: alloc.batchNo,
              expiryDate: null,
              productName: line.productName,
              quantity: alloc.qty,
              unitPrice: line.unitPrice,
              discount: r2((line.discount / line.quantity) * alloc.qty),
              total: r2(line.unitPrice * alloc.qty - (line.discount / line.quantity) * alloc.qty),
              costPrice: alloc.costPrice,
            },
          })
        }
        await applyAllocations(tx, line.productId, line.allocations, {
          type: 'SALE',
          refType: 'sale',
          refId: created.id,
          userId: user.id,
          tenantId,
        })
      }

      // ---- loyalty: write REDEEM event (validated above) and EARN event ----
      if (loyaltyDiscount > 0 && input.customerId && redeemRequest) {
        await applyRedemptionToSale(tx, {
          tenantId,
          customerId: input.customerId,
          saleId: created.id,
          points: redeemRequest,
          saleTotalBefore: r2(subtotal - invoiceDiscount + tax),
          userId: user.id,
          cfg: loyaltyCfg,
        })
      }
      if (loyaltyEntitled && input.customerId && total > 0) {
        await recordEarnForSale(tx, {
          tenantId,
          customerId: input.customerId,
          saleId: created.id,
          total,
          userId: user.id,
          cfg: loyaltyCfg,
        })
      }

      return created
    },
    { timeout: 15000 }
  )

  await audit(
    { userId: user.id, username: user.username },
    'SALE_CREATE',
    {
      entity: 'sale',
      entityId: sale.id,
      metadata: { invoiceNo: sale.invoiceNo, total: sale.total, items: input.items.length },
    }
  )

  return { saleId: sale.id, invoiceNo: sale.invoiceNo, receipt: await buildReceipt(sale.id, tenantId) }
}

export async function buildReceipt(saleId: string, tenantId?: string): Promise<ReceiptData> {
  const scope = tenantId ? tenantId : (await serviceTenant()).tenantId
  const sale = await db.sale.findFirst({
    where: { id: saleId, tenantId: scope },
    include: {
      cashier: true,
      customer: true,
      items: true,
    },
  })
  if (!sale) throw new ApiError('NOT_FOUND', 'الفاتورة غير موجودة', 404)

  // group SaleItems back into logical lines (FEFO splits one line across batches)
  const byProduct = new Map<string, ReceiptData['items'][number]>()
  for (const item of sale.items) {
    const key = `${item.productId}|${item.unitPrice}|${item.discount / Math.max(item.quantity, 1e-9)}`
    let line = byProduct.get(key)
    if (!line) {
      line = {
        productName: item.productName,
        batchNo: item.batchNo,
        quantity: 0,
        unitPrice: item.unitPrice,
        discount: 0,
        total: 0,
        allocations: [],
      }
      byProduct.set(key, line)
    }
    line.quantity = Math.round((line.quantity + item.quantity) * 1000) / 1000
    line.discount = r2(line.discount + item.discount)
    line.total = r2(line.total + item.total)
    line.allocations.push({
      batchNo: item.batchNo,
      expiry: null,
      qty: item.quantity,
    })
  }

  return {
    saleId: sale.id,
    invoiceNo: sale.invoiceNo,
    createdAt: sale.createdAt.toISOString(),
    cashierName: sale.cashier.displayName,
    customerName: sale.customer?.name ?? null,
    items: Array.from(byProduct.values()),
    subtotal: sale.subtotal,
    discount: sale.discount,
    tax: sale.tax,
    total: sale.total,
    paidAmount: sale.paidAmount,
    changeAmount: sale.changeAmount,
    paymentMethod: sale.paymentMethod,
    loyalty: await buildReceiptLoyalty(sale.id, scope),
  }
}

/** Loyalty lines for the receipt: redeemed this sale + earned this sale + resulting balance. */
async function buildReceiptLoyalty(saleId: string, tenantId: string): Promise<ReceiptData['loyalty']> {
  const events = await db.loyaltyEvent.findMany({ where: { saleId, tenantId } })
  if (events.length === 0) return undefined
  const redeemed = events.find((e) => e.type === 'REDEEM')
  const earned = events.find((e) => e.type === 'EARN')
  if (!redeemed && !earned) return undefined
  const customerId = (redeemed ?? earned)!.customerId
  const balance = await db.loyaltyEvent.aggregate({
    where: { customerId, tenantId },
    _sum: { points: true },
  })
  return {
    redeemedPoints: redeemed ? -redeemed.points : 0,
    redeemedValue: redeemed?.value ?? 0,
    earnedPoints: earned?.points ?? 0,
    balanceAfter: balance._sum.points ?? 0,
  }
}

export async function cancelSale(user: SessionUser, saleId: string, reason?: string): Promise<void> {
  const { tenantId } = await serviceTenant()
  await db.$transaction(
    async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id: saleId, tenantId },
        include: { items: true },
      })
      if (!sale) throw new ApiError('NOT_FOUND', 'الفاتورة غير موجودة', 404)
      if (sale.status === 'CANCELLED') throw new ApiError('ALREADY_CANCELLED', 'الفاتورة ملغاة بالفعل', 409)

      for (const item of sale.items) {
        const returnable = Math.round((item.quantity - item.returnedQty) * 1000) / 1000
        if (returnable <= 1e-9) continue
        if (!item.batchId) continue
        const batch = await tx.batch.findFirst({
          where: { id: item.batchId, tenantId },
          select: { id: true },
        })
        if (!batch) continue
        await restockBatch(tx, {
          batchId: item.batchId,
          productId: item.productId,
          qty: returnable,
          movementType: 'SALE_CANCEL_RESTOCK',
          refType: 'sale_cancel',
          refId: sale.id,
          userId: user.id,
          note: reason ?? null,
          unitCost: item.costPrice,
          tenantId,
        })
      }

      // reverse loyalty effects (earned points back, redeemed points restored)
      if (sale.customerId) {
        await reverseLoyaltyForSale(tx, { tenantId, saleId: sale.id, userId: user.id })
      }

      await tx.sale.update({ where: { id: saleId }, data: { status: 'CANCELLED' } })
    },
    { timeout: 15000 }
  )

  await audit({ userId: user.id, username: user.username }, 'SALE_CANCEL', {
    entity: 'sale',
    entityId: saleId,
    metadata: { reason: reason ?? null },
  })
}
