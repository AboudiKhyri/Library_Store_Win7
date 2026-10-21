/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Sales returns domain service (tenant-scoped)
// Validated returns with restock into original batches (traceability preserved).
// Quantities are Float for weighable supermarket products; over-return guards
// compare returnedQty with a float-safe epsilon.
import { db } from '@/lib/db'
import { ApiError } from '../api'
import { r2, r3 } from '../money'
import { audit } from '../audit'
import { parsePos } from '../config'
import { getSettings } from '../system'
import { serviceTenant, nextDocNo } from './tenancy'
import { validateQuantity, weightDecimals } from './quantities'
import { restockBatch } from './inventory'
import type { SessionUser } from '../types'

export interface ReturnInput {
  saleId: string
  items: { saleItemId: string; quantity: number }[]
  reason?: string
}

export async function createReturn(user: SessionUser, input: ReturnInput): Promise<{ returnId: string; returnNo: string; total: number }> {
  if (!input.items || input.items.length === 0) throw new ApiError('EMPTY_ITEMS', 'لا توجد أصناف في المرتجع', 400)

  const { tenantId } = await serviceTenant()
  const settings = await getSettings()
  const pos = parsePos(settings.pos)
  const decimals = weightDecimals(pos.weightQtyDecimals)

  const result = await db.$transaction(
    async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id: input.saleId, tenantId },
        include: { items: true },
      })
      if (!sale) throw new ApiError('NOT_FOUND', 'فاتورة البيع غير موجودة', 404)
      if (sale.status === 'CANCELLED') throw new ApiError('SALE_CANCELLED', 'لا يمكن عمل مرتجع لفاتورة ملغاة', 409)

      const returnNo = await nextDocNo(tx, tenantId, 'return', 'RET')

      // resolve the products of the original sale items (weighable rules)
      const productIds = [...new Set(sale.items.map((i) => i.productId))]
      const products = await tx.product.findMany({ where: { id: { in: productIds }, tenantId } })
      const productById = new Map(products.map((p) => [p.id, p]))

      let total = 0
      const lines: { saleItemId: string; productId: string; batchId: string | null; quantity: number; unitPrice: number; total: number }[] = []

      for (const item of input.items) {
        const saleItem = sale.items.find((i) => i.id === item.saleItemId)
        if (!saleItem) throw new ApiError('NOT_FOUND', 'صنف غير موجود في الفاتورة الأصلية', 404)

        // quantity rules follow the ORIGINAL product (weighable → fractional)
        const product = productById.get(saleItem.productId)
        const qty = validateQuantity(
          { isWeighable: (product as { isWeighable?: boolean })?.isWeighable ?? false, nameAr: saleItem.productName },
          item.quantity,
          decimals,
          { what: `مرتجع ${saleItem.productName}` }
        )

        const returnable = r3(saleItem.quantity - saleItem.returnedQty)
        if (qty > returnable + 1e-9) {
          throw new ApiError(
            'OVER_RETURN',
            `الكمية المطلوب إرجاعها أكبر من المتاح للإرجاع (${returnable}) للصنف ${saleItem.productName}`,
            409
          )
        }

        // restock into the ORIGINAL batch — full traceability
        if (saleItem.batchId) {
          const batch = await tx.batch.findFirst({
            where: { id: saleItem.batchId, tenantId },
            select: { id: true },
          })
          if (batch) {
            await restockBatch(tx, {
              batchId: saleItem.batchId,
              productId: saleItem.productId,
              qty,
              movementType: 'RETURN_IN',
              refType: 'return',
              refId: sale.id,
              userId: user.id,
              note: input.reason ?? null,
              unitCost: saleItem.costPrice,
              tenantId,
            })
          }
        }

        const lineTotal = r2(saleItem.unitPrice * qty)
        total = r2(total + lineTotal)
        lines.push({
          saleItemId: saleItem.id,
          productId: saleItem.productId,
          batchId: saleItem.batchId,
          quantity: qty,
          unitPrice: saleItem.unitPrice,
          total: lineTotal,
        })
      }

      const created = await tx.return.create({
        data: {
          tenantId,
          returnNo,
          saleId: sale.id,
          userId: user.id,
          total,
          reason: input.reason ?? null,
          items: {
            create: lines.map((l) => ({
              tenantId,
              saleItemId: l.saleItemId,
              productId: l.productId,
              batchId: l.batchId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              total: l.total,
            })),
          },
        },
      })

      // update returned quantities + sale status (float-safe comparisons)
      for (const line of lines) {
        await tx.saleItem.update({
          where: { id: line.saleItemId },
          data: { returnedQty: { increment: line.quantity } },
        })
      }
      const refreshedItems = await tx.saleItem.findMany({ where: { saleId: sale.id, tenantId } })
      const fullyReturned = refreshedItems.every((i) => i.returnedQty >= i.quantity - 1e-9)
      await tx.sale.update({
        where: { id: sale.id },
        data: { status: fullyReturned ? 'RETURNED' : 'PARTIALLY_RETURNED' },
      })

      return { returnId: created.id, returnNo, total }
    },
    { timeout: 15000 }
  )

  await audit({ userId: user.id, username: user.username }, 'SALES_RETURN', {
    entity: 'return',
    entityId: result.returnId,
    metadata: { returnNo: result.returnNo, saleId: input.saleId, total: result.total, reason: input.reason ?? null },
  })

  return result
}
