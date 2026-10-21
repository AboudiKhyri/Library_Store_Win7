/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Customer loyalty points service (tenant-scoped)
// Points are an append-only ledger (LoyaltyEvent); the balance is derived via
// SUM — no mutable counters that can drift. Earning is automatic on completed
// sales; redemption happens at POS with a configurable EGP-per-point rate.
// Business rules live HERE (spec §80), never in UI components.
// The loyalty ENTITLEMENT is enforced by the routes; the sales service calls
// in with `entitled=false` to disable earn/redeem silently.
import { db } from '@/lib/db'
import { ApiError } from '../api'
import { audit } from '../audit'
import { getSettings } from '../system'
import { r2 } from '../money'
import { serviceTenant } from './tenancy'
import type { PosConfig } from '../types'
import type { Prisma } from '@prisma/client'

type Tx = Prisma.TransactionClient

export interface LoyaltyConfig {
  /** master switch — when false no earning or redemption happens */
  enabled: boolean
  /** earn points per 100 EGP spent */
  earnRatePer100: number
  /** EGP value of one point when redeemed */
  pointValueEgp: number
  /** max share of an invoice total redeemable via points (0-1) */
  maxRedeemShare: number
  /** minimum points balance before redemption is allowed */
  minRedeemPoints: number
}

export const DEFAULT_LOYALTY: LoyaltyConfig = {
  enabled: true,
  earnRatePer100: 1,
  pointValueEgp: 0.1,
  maxRedeemShare: 0.5,
  minRedeemPoints: 10,
}

export function parseLoyalty(posConfigOrJson: PosConfig | string | null | undefined): LoyaltyConfig {
  if (!posConfigOrJson) return DEFAULT_LOYALTY
  try {
    const parsed: Record<string, unknown> = typeof posConfigOrJson === 'string'
      ? (JSON.parse(posConfigOrJson) as Record<string, unknown>)
      : (posConfigOrJson as unknown as Record<string, unknown>)
    const loyalty = (parsed.loyalty ?? {}) as Record<string, unknown>
    return {
      enabled: loyalty.enabled !== false, // on unless explicitly disabled
      earnRatePer100: Number(loyalty.earnRatePer100 ?? DEFAULT_LOYALTY.earnRatePer100) || 0,
      pointValueEgp: Number(loyalty.pointValueEgp ?? DEFAULT_LOYALTY.pointValueEgp) || 0,
      maxRedeemShare: Math.min(1, Math.max(0, Number(loyalty.maxRedeemShare ?? DEFAULT_LOYALTY.maxRedeemShare))),
      minRedeemPoints: Math.max(0, Math.round(Number(loyalty.minRedeemPoints ?? DEFAULT_LOYALTY.minRedeemPoints))),
    }
  } catch {
    return DEFAULT_LOYALTY
  }
}

/** Current derived points balance for a customer (tenant-scoped). */
export async function pointsBalance(
  customerId: string,
  tx?: Prisma.TransactionClient,
  tenantId?: string
): Promise<number> {
  const agg = await (tx ?? db).loyaltyEvent.aggregate({
    where: { customerId, ...(tenantId ? { tenantId } : {}) },
    _sum: { points: true },
  })
  return agg._sum.points ?? 0
}

/** Points earned for a purchase amount (floor to whole points). */
export function pointsForAmount(amount: number, cfg: LoyaltyConfig): number {
  if (!cfg.enabled || cfg.earnRatePer100 <= 0 || amount <= 0) return 0
  return Math.floor((amount / 100) * cfg.earnRatePer100)
}

/** Max points redeemable against an invoice total, respecting share cap + balance. */
export function maxRedeemable(total: number, balance: number, cfg: LoyaltyConfig): number {
  if (!cfg.enabled || cfg.pointValueEgp <= 0 || total <= 0 || balance < cfg.minRedeemPoints) return 0
  const capByValue = Math.floor((total * cfg.maxRedeemShare) / cfg.pointValueEgp)
  return Math.max(0, Math.min(balance, capByValue))
}

/** EGP value of redeeming N points. */
export function redeemValue(points: number, cfg: LoyaltyConfig): number {
  return r2(points * cfg.pointValueEgp)
}

// ---------- Sale integration (called INSIDE the sale transaction) ----------

/**
 * Records EARN events for a completed sale. Called by the sales service within
 * its transaction — never from the UI. Earned on the POST-discount total.
 * NOTE: settings are read by the CALLER (outside the tx) and passed in — SQLite
 * transactions must not run nested upserts (lock contention).
 */
export async function recordEarnForSale(
  tx: Tx,
  params: {
    tenantId: string
    customerId: string
    saleId: string
    total: number
    userId: string
    cfg: LoyaltyConfig
  }
): Promise<number> {
  const points = pointsForAmount(params.total, params.cfg)
  if (points <= 0) return 0
  await tx.loyaltyEvent.create({
    data: {
      tenantId: params.tenantId,
      customerId: params.customerId,
      saleId: params.saleId,
      type: 'EARN',
      points,
      value: 0,
      note: `نقاط مكتسبة من فاتورة ${params.total.toFixed(2)} ج.م`,
      userId: params.userId,
    },
  })
  return points
}

/**
 * Applies a points redemption to a sale: consumes points (REDEEM event) and
 * returns the EGP discount value to subtract from the sale total.
 * Validation: balance ≥ points, points ≥ minRedeem, value ≤ maxRedeemShare×total.
 * NOTE: cfg is passed IN (read outside the transaction) to avoid SQLite locks.
 */
export async function applyRedemptionToSale(
  tx: Tx,
  params: {
    tenantId: string
    customerId: string
    saleId: string
    points: number
    saleTotalBefore: number
    userId: string
    cfg: LoyaltyConfig
  }
): Promise<{ value: number }> {
  const cfg = params.cfg

  if (!Number.isInteger(params.points) || params.points <= 0) {
    throw new ApiError('POINTS_INVALID', 'عدد النقاط غير صالح', 400)
  }
  const balance = await pointsBalance(params.customerId, tx, params.tenantId)
  if (params.points > balance) {
    throw new ApiError('POINTS_INSUFFICIENT', `رصيد النقاط غير كافٍ — المتاح ${balance} نقطة`, 409)
  }
  if (balance < cfg.minRedeemPoints || params.points < cfg.minRedeemPoints) {
    throw new ApiError('POINTS_MIN', `أقل عدد نقاط للاستبدال هو ${cfg.minRedeemPoints}`, 409)
  }
  const value = redeemValue(params.points, cfg)
  const cap = r2(params.saleTotalBefore * cfg.maxRedeemShare)
  if (value > cap + 1e-9) {
    throw new ApiError(
      'POINTS_CAP',
      `قيمة الاستبدال تتجاوز الحد المسموح (${cap.toFixed(2)} ج.م كحد أقصى لهذه الفاتورة)`,
      409
    )
  }

  await tx.loyaltyEvent.create({
    data: {
      tenantId: params.tenantId,
      customerId: params.customerId,
      saleId: params.saleId,
      type: 'REDEEM',
      points: -params.points,
      value,
      note: `استبدال ${params.points} نقطة بخصم ${value.toFixed(2)} ج.م`,
      userId: params.userId,
    },
  })
  return { value }
}

/** Reverses loyalty effects when a sale is cancelled (opposite events, keeping the ledger honest). */
export async function reverseLoyaltyForSale(
  tx: Tx,
  params: { tenantId: string; saleId: string; userId: string }
): Promise<void> {
  const events = await tx.loyaltyEvent.findMany({
    where: { saleId: params.saleId, tenantId: params.tenantId },
  })
  for (const ev of events) {
    await tx.loyaltyEvent.create({
      data: {
        tenantId: params.tenantId,
        customerId: ev.customerId,
        // NOTE: saleId intentionally NULL — the (saleId,type) unique constraint
        // allows one EARN + one REDEEM per sale; reversal events are standalone
        // ADJUST rows whose note references the original sale.
        saleId: null,
        type: 'ADJUST',
        points: -ev.points, // opposite sign cancels the original event
        value: ev.value,
        note: `عكس أثر إلغاء الفاتورة (${ev.type === 'EARN' ? 'استرجاع نقاط مكتسبة' : 'إرجاع نقاط مستبدلة'})`,
        userId: params.userId,
      },
    })
  }
}

/** Manual adjustment (admin tool) — tenant-scoped, customer must belong to the tenant. */
export async function adjustPoints(
  userId: string,
  params: { customerId: string; points: number; note?: string }
): Promise<{ balance: number }> {
  const { tenantId } = await serviceTenant()
  if (!Number.isInteger(params.points) || params.points === 0) {
    throw new ApiError('POINTS_INVALID', 'أدخل عدد نقاط صحيحاً غير صفري', 400)
  }
  const customer = await db.customer.findFirst({
    where: { id: params.customerId, tenantId },
    select: { id: true, name: true },
  })
  if (!customer) throw new ApiError('NOT_FOUND', 'العميل غير موجود', 404)

  await db.$transaction(async (tx) => {
    await tx.loyaltyEvent.create({
      data: {
        tenantId,
        customerId: params.customerId,
        type: 'ADJUST',
        points: params.points,
        value: 0,
        note: params.note?.trim() || 'تسوية يدوية',
        userId,
      },
    })
  })
  await audit({ userId, username: 'loyalty' }, 'LOYALTY_ADJUST', {
    entity: 'customer',
    entityId: params.customerId,
    metadata: { points: params.points, customerName: customer.name },
  })
  return { balance: await pointsBalance(params.customerId, undefined, tenantId) }
}

/** Full loyalty profile for a customer (balance + recent events) — tenant-scoped. */
export async function loyaltyProfile(customerId: string) {
  const { tenantId } = await serviceTenant()
  const settings = await getSettings()
  const cfg = parseLoyalty(settings.pos)
  const [balance, events, customer] = await Promise.all([
    pointsBalance(customerId, undefined, tenantId),
    db.loyaltyEvent.findMany({
      where: { customerId, tenantId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    db.customer.findFirst({ where: { id: customerId, tenantId } }),
  ])
  if (!customer) throw new ApiError('NOT_FOUND', 'العميل غير موجود', 404)
  return {
    customer: { id: customer.id, name: customer.name, phone: customer.phone },
    balance,
    pointValueEgp: cfg.pointValueEgp,
    balanceValueEgp: redeemValue(balance, cfg),
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      points: e.points,
      value: e.value,
      note: e.note,
      createdAt: e.createdAt.toISOString(),
    })),
  }
}
