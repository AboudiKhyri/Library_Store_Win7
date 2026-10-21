/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Dashboard metrics (tenant-scoped, real queries only)
import { db } from '@/lib/db'
import { r2, r3 } from '../money'
import { parsePos } from '../config'
import { getSettings } from '../system'
import { serviceTenant } from './tenancy'

export interface DashboardData {
  todaySales: number
  todayCount: number
  avgTransaction: number
  monthSales: number
  monthPurchases: number
  monthPurchaseCount: number
  lowStockCount: number
  expiredCount: number
  stockValue: number
  activeProducts: number
  weeklySales: { date: string; total: number; count: number }[]
  recentSales: {
    id: string
    invoiceNo: string
    total: number
    status: string
    paymentMethod: string
    cashierName: string
    createdAt: string
    itemsCount: number
  }[]
  topProducts: { productId: string; nameAr: string; qty: number; revenue: number }[]
}

export async function getDashboardData(): Promise<DashboardData> {
  const { tenantId } = await serviceTenant()
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const weekStart = new Date(todayStart.getTime() - 6 * 86400000)

  const settings = await getSettings()
  const pos = parsePos(settings.pos)
  // expiry removed for stationery store
  const warningLimit = new Date(todayStart.getTime() + warningDays * 86400000)

  const tenantSale = {
    tenantId,
    createdAt: { gte: todayStart },
    status: { not: 'CANCELLED' },
  }
  const monthSale = {
    tenantId,
    createdAt: { gte: monthStart },
    status: { not: 'CANCELLED' },
  }

  const [
    todayAgg,
    todayCountAgg,
    monthAgg,
    monthPurchases,
    monthPurchaseCount,
    recentSales,
    batches,
    products,
    weeklyRaw,
    topRaw,
  ] = await Promise.all([
    db.sale.aggregate({
      where: tenantSale,
      _sum: { total: true },
    }),
    db.sale.count({ where: tenantSale }),
    db.sale.aggregate({
      where: monthSale,
      _sum: { total: true },
    }),
    db.purchase.aggregate({
      where: { tenantId, createdAt: { gte: monthStart }, status: 'RECEIVED' },
      _sum: { total: true },
    }),
    db.purchase.count({ where: { tenantId, createdAt: { gte: monthStart }, status: 'RECEIVED' } }),
    db.sale.findMany({
      where: { tenantId, status: { not: 'CANCELLED' } },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { cashier: true, _count: { select: { items: true } } },
    }),
    db.batch.findMany({
      where: { tenantId, quantity: { gt: 0 }, status: 'ACTIVE' },
      select: { productId: true, quantity: true, costPrice: true },
    }),
    db.product.findMany({
      where: { active: true, tenantId },
      select: { id: true, reorderLevel: true },
    }),
    db.sale.findMany({
      where: { tenantId, createdAt: { gte: weekStart }, status: { not: 'CANCELLED' } },
      select: { createdAt: true, total: true },
    }),
    db.saleItem.groupBy({
      by: ['productId', 'productName'],
      where: {
        tenantId,
        sale: { createdAt: { gte: new Date(todayStart.getTime() - 30 * 86400000) }, status: { not: 'CANCELLED' } },
      },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 7,
    }),
  ])

  const todaySales = r2(todayAgg._sum.total ?? 0)
  const todayCount = todayCountAgg

  // stock computations
  let stockValue = 0
  let expiredCount = 0
  const perProduct = new Map<string, number>()
  for (const b of batches) {
    stockValue += b.quantity * b.costPrice
    perProduct.set(b.productId, r3((perProduct.get(b.productId) ?? 0) + b.quantity))
  }

  let lowStockCount = 0
  for (const p of products) {
    const available = perProduct.get(p.id) ?? 0
    if (available <= p.reorderLevel + 1e-9) lowStockCount++
  }

  // weekly series
  const weeklyMap = new Map<string, { total: number; count: number }>()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayStart.getTime() - i * 86400000)
    weeklyMap.set(d.toISOString().slice(0, 10), { total: 0, count: 0 })
  }
  for (const s of weeklyRaw) {
    const key = s.createdAt.toISOString().slice(0, 10)
    const entry = weeklyMap.get(key)
    if (entry) {
      entry.total = r2(entry.total + s.total)
      entry.count++
    }
  }

  return {
    todaySales,
    todayCount,
    avgTransaction: todayCount > 0 ? r2(todaySales / todayCount) : 0,
    monthSales: r2(monthAgg._sum.total ?? 0),
    monthPurchases: r2(monthPurchases._sum.total ?? 0),
    monthPurchaseCount,
    lowStockCount,
    expiredCount,
    stockValue: r2(stockValue),
    activeProducts: products.length,
    weeklySales: Array.from(weeklyMap.entries()).map(([date, v]) => ({ date, total: v.total, count: v.count })),
    recentSales: recentSales.map((s) => ({
      id: s.id,
      invoiceNo: s.invoiceNo,
      total: r2(s.total),
      status: s.status,
      paymentMethod: s.paymentMethod,
      cashierName: s.cashier.displayName,
      createdAt: s.createdAt.toISOString(),
      itemsCount: s._count.items,
    })),
    topProducts: topRaw.map((t) => ({
      productId: t.productId,
      nameAr: t.productName,
      qty: r3(t._sum.quantity ?? 0),
      revenue: r2(t._sum.total ?? 0),
    })),
  }
}
