/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Purchasing domain service (tenant-scoped)
// Draft invoices, transactional receiving with batch creation, cancellation rules.
// Quantities are Float for weighable supermarket products.
import { db } from '@/lib/db'
import { ApiError } from '../api'
import { r2 } from '../money'
import { audit } from '../audit'
import { parsePos } from '../config'
import { getSettings } from '../system'
import { serviceTenant, nextDocNo } from './tenancy'
import { validateQuantity, weightDecimals, type QtyRuleProduct } from './quantities'
import type { SessionUser } from '../types'
import type { Prisma } from '@prisma/client'

type Tx = Prisma.TransactionClient

export interface PurchaseItemInput {
  productId: string
  quantity: number
  unitCost: number
  batchNo?: string
  expiryDate?: string | null
}

export async function createPurchase(
  user: SessionUser,
  input: {
    supplierId: string
    items: PurchaseItemInput[]
    discount?: number
    tax?: number
    paidAmount?: number
    notes?: string
    receiveNow?: boolean
  }
): Promise<{ purchaseId: string; invoiceNo: string; status: string }> {
  if (!input.items || input.items.length === 0) throw new ApiError('EMPTY_ITEMS', 'فاتورة الشراء فارغة', 400)

  const { tenantId } = await serviceTenant()
  const settings = await getSettings()
  const pos = parsePos(settings.pos)
  const decimals = weightDecimals(pos.weightQtyDecimals)

  const supplier = await db.supplier.findFirst({ where: { id: input.supplierId, tenantId } })
  if (!supplier) throw new ApiError('NOT_FOUND', 'المورد غير موجود', 404)

  // resolve every product in ONE tenant-scoped query + validate quantities
  const productIds = [...new Set(input.items.map((i) => i.productId))]
  const products = await db.product.findMany({ where: { id: { in: productIds }, tenantId } })
  const productById = new Map(products.map((p) => [p.id, p]))

  const validated = input.items.map((item) => {
    const product = productById.get(item.productId)
    if (!product) throw new ApiError('NOT_FOUND', 'صنف غير موجود في فاتورة الشراء', 404)
    if (item.unitCost < 0) throw new ApiError('COST_INVALID', 'سعر الوحدة غير صالح', 400)
    return { item, product, qty: validateQuantity(product as QtyRuleProduct, item.quantity, decimals) }
  })

  const purchase = await db.$transaction(async (tx) => {
    const invoiceNo = await nextDocNo(tx, tenantId, 'purchase', 'PUR')

    let subtotal = 0
    for (const v of validated) {
      subtotal = r2(subtotal + v.qty * v.item.unitCost)
    }

    const discount = r2(Math.max(0, input.discount ?? 0))
    if (discount > subtotal) throw new ApiError('DISCOUNT_TOO_LARGE', 'الخصم أكبر من قيمة الفاتورة', 400)
    const tax = r2(Math.max(0, input.tax ?? 0))
    const total = r2(subtotal - discount + tax)
    const paidAmount = r2(Math.max(0, input.paidAmount ?? 0))
    const paymentStatus = paidAmount >= total && total > 0 ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'UNPAID'

    const created = await tx.purchase.create({
      data: {
        tenantId,
        invoiceNo,
        supplierId: input.supplierId,
        status: 'DRAFT',
        subtotal,
        discount,
        tax,
        total,
        paidAmount,
        paymentStatus,
        notes: input.notes ?? null,
        userId: user.id,
      },
    })

    for (const v of validated) {
      await tx.purchaseItem.create({
        data: {
          tenantId,
          purchaseId: created.id,
          productId: v.item.productId,
          batchNo: v.item.batchNo?.trim() || null,
          expiryDate: null,
          quantity: v.qty,
          unitCost: r2(v.item.unitCost),
          total: r2(v.qty * v.item.unitCost),
        },
      })
    }

    return created
  })

  await audit({ userId: user.id, username: user.username }, 'PURCHASE_CREATE', {
    entity: 'purchase',
    entityId: purchase.id,
    metadata: { invoiceNo: purchase.invoiceNo, total: purchase.total },
  })

  if (input.receiveNow) {
    await receivePurchase(user, purchase.id)
    const refreshed = await db.purchase.findUniqueOrThrow({ where: { id: purchase.id } })
    return { purchaseId: purchase.id, invoiceNo: purchase.invoiceNo, status: refreshed.status }
  }
  return { purchaseId: purchase.id, invoiceNo: purchase.invoiceNo, status: purchase.status }
}

/**
 * Receiving: creates batches + stock movements + updates product cost price.
 * Atomic — inventory is never updated if persistence fails.
 */
export async function receivePurchase(user: SessionUser, purchaseId: string): Promise<void> {
  const { tenantId } = await serviceTenant()
  await db.$transaction(
    async (tx) => {
      const purchase = await tx.purchase.findFirst({
        where: { id: purchaseId, tenantId },
        include: { items: true },
      })
      if (!purchase) throw new ApiError('NOT_FOUND', 'فاتورة الشراء غير موجودة', 404)
      if (purchase.status === 'RECEIVED') throw new ApiError('ALREADY_RECEIVED', 'تم استلام هذه الفاتورة بالفعل', 409)
      if (purchase.status === 'CANCELLED') throw new ApiError('CANCELLED', 'هذه الفاتورة ملغاة', 409)

      for (const [index, item] of purchase.items.entries()) {
        const product = await tx.product.findFirst({ where: { id: item.productId, tenantId } })
        if (!product) throw new ApiError('NOT_FOUND', 'صنف غير موجود في فاتورة الشراء', 404)

        // duplicate batch guard: same product + same batchNo within this tenant
        const batchNo = item.batchNo?.trim() || `AUTO-${purchase.invoiceNo}-${index + 1}`
        const existingBatch = await tx.batch.findFirst({
          where: { productId: item.productId, batchNo, tenantId },
        })

        let batchId: string
        if (existingBatch) {
          // merge into existing batch (same lot replenishment)
          const updated = await tx.batch.update({
            where: { id: existingBatch.id },
            data: {
              quantity: { increment: item.quantity },
              costPrice: item.unitCost,
              status: 'ACTIVE',
              supplierId: purchase.supplierId,
              purchaseId: purchase.id,
            },
          })
          // snap to 3 decimals at the write boundary
          const snapped = Math.round(updated.quantity * 1000) / 1000
          if (snapped !== updated.quantity) {
            await tx.batch.update({ where: { id: existingBatch.id }, data: { quantity: snapped } })
          }
          batchId = updated.id
        } else {
          const batch = await tx.batch.create({
            data: {
              tenantId,
              productId: item.productId,
              batchNo,
              expiryDate: null,
              quantity: item.quantity,
              costPrice: item.unitCost,
              sellPrice: product.sellingPrice,
              supplierId: purchase.supplierId,
              purchaseId: purchase.id,
              status: 'ACTIVE',
            },
          })
          batchId = batch.id
        }

        await tx.stockMovement.create({
          data: {
            tenantId,
            productId: item.productId,
            batchId,
            type: 'PURCHASE_RECEIVE',
            quantity: item.quantity,
            unitCost: item.unitCost,
            refType: 'purchase',
            refId: purchase.id,
            userId: user.id,
          },
        })

        await tx.purchaseItem.update({
          where: { id: item.id },
          data: { receivedQty: item.quantity, batchId },
        })

        // latest cost price propagates to the product
        await tx.product.update({
          where: { id: item.productId },
          data: { purchasePrice: item.unitCost },
        })
      }

      await tx.purchase.update({
        where: { id: purchaseId },
        data: { status: 'RECEIVED', receivedAt: new Date() },
      })
    },
    { timeout: 15000 }
  )

  await audit({ userId: user.id, username: user.username }, 'PURCHASE_RECEIVE', {
    entity: 'purchase',
    entityId: purchaseId,
  })
}

export async function cancelPurchase(user: SessionUser, purchaseId: string): Promise<void> {
  const { tenantId } = await serviceTenant()
  const purchase = await db.purchase.findFirst({ where: { id: purchaseId, tenantId } })
  if (!purchase) throw new ApiError('NOT_FOUND', 'فاتورة الشراء غير موجودة', 404)
  if (purchase.status === 'RECEIVED') {
    throw new ApiError(
      'CANNOT_CANCEL_RECEIVED',
      'لا يمكن إلغاء فاتورة مستلمة — استخدم تسوية المخزون للتصحيح',
      409
    )
  }
  if (purchase.status === 'CANCELLED') throw new ApiError('ALREADY_CANCELLED', 'الفاتورة ملغاة بالفعل', 409)

  await db.purchase.update({ where: { id: purchaseId }, data: { status: 'CANCELLED' } })
  await audit({ userId: user.id, username: user.username }, 'PURCHASE_CANCEL', {
    entity: 'purchase',
    entityId: purchaseId,
  })
}

export async function recordPurchasePayment(
  user: SessionUser,
  purchaseId: string,
  input: { amount?: number; notes?: string }
): Promise<{ purchaseId: string; paidAmount: number; paymentStatus: string }> {
  const { tenantId } = await serviceTenant()
  const purchase = await db.purchase.findFirst({ where: { id: purchaseId, tenantId } })
  if (!purchase) throw new ApiError('NOT_FOUND', 'فاتورة الشراء غير موجودة', 404)
  if (purchase.status === 'CANCELLED') throw new ApiError('ALREADY_CANCELLED', 'لا يمكن سداد فاتورة ملغاة', 409)

  const remaining = r2(Math.max(0, purchase.total - purchase.paidAmount))
  if (remaining <= 0) throw new ApiError('ALREADY_PAID', 'الفاتورة مسددة بالكامل بالفعل', 400)

  const payAmount = input.amount != null && input.amount > 0 ? r2(input.amount) : remaining
  if (payAmount <= 0) throw new ApiError('INVALID_AMOUNT', 'المبلغ المدفوع غير صالح', 400)

  const newPaid = r2(Math.min(purchase.total, purchase.paidAmount + payAmount))
  const paymentStatus = newPaid >= purchase.total ? 'PAID' : 'PARTIAL'

  const notes = input.notes?.trim()
    ? purchase.notes
      ? `${purchase.notes}\n[سداد ${new Date().toLocaleDateString('ar-EG')}]: ${input.notes.trim()}`
      : `[سداد ${new Date().toLocaleDateString('ar-EG')}]: ${input.notes.trim()}`
    : purchase.notes

  await db.purchase.update({
    where: { id: purchaseId },
    data: {
      paidAmount: newPaid,
      paymentStatus,
      notes,
      updatedAt: new Date(),
    },
  })

  await audit({ userId: user.id, username: user.username }, 'PURCHASE_PAY', {
    entity: 'purchase',
    entityId: purchaseId,
    metadata: { paidAdded: payAmount, newPaid, paymentStatus },
  })

  return { purchaseId, paidAmount: newPaid, paymentStatus }
}

