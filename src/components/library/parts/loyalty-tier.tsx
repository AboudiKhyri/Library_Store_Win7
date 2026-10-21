'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Loyalty tier badge
// Tier computed from LIFETIME earned points (not current balance — redemptions
// must never demote a customer). Thresholds are fixed commercial tiers.

import { Crown, Medal, Award, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export type LoyaltyTier = 'gold' | 'silver' | 'bronze' | 'member'

export interface TierInfo {
  tier: LoyaltyTier
  labelAr: string
  icon: React.ComponentType<{ className?: string }>
  className: string
}

const TIERS: Record<LoyaltyTier, TierInfo> = {
  gold: {
    tier: 'gold',
    labelAr: 'ذهبي',
    icon: Crown,
    className: 'border-amber-500/50 bg-amber-500/15 text-amber-600 dark:text-amber-400',
  },
  silver: {
    tier: 'silver',
    labelAr: 'فضي',
    icon: Medal,
    className: 'border-slate-400/50 bg-slate-400/15 text-slate-600 dark:text-slate-300',
  },
  bronze: {
    tier: 'bronze',
    labelAr: 'برونزي',
    icon: Award,
    className: 'border-orange-700/40 bg-orange-700/10 text-orange-800 dark:text-orange-400',
  },
  member: {
    tier: 'member',
    labelAr: 'عضو',
    icon: Star,
    className: 'border-primary/30 bg-primary/10 text-primary',
  },
}

/** Default lifetime-earned-points thresholds (overridable via settings). */
export const DEFAULT_THRESHOLDS = { gold: 500, silver: 100, bronze: 20 }

export interface TierThresholds {
  gold: number
  silver: number
  bronze: number
}

/** Accepts either TierThresholds keys or the persisted LoyaltySettings shape. */
function normalizeThresholds(thresholds?: Partial<TierThresholds> & { tierBronze?: number; tierSilver?: number; tierGold?: number }): TierThresholds {
  const t = { ...DEFAULT_THRESHOLDS }
  if (thresholds?.bronze != null) t.bronze = thresholds.bronze
  if (thresholds?.tierBronze != null) t.bronze = thresholds.tierBronze
  if (thresholds?.silver != null) t.silver = thresholds.silver
  if (thresholds?.tierSilver != null) t.silver = thresholds.tierSilver
  if (thresholds?.gold != null) t.gold = thresholds.gold
  if (thresholds?.tierGold != null) t.gold = thresholds.tierGold
  return t
}

export function tierForLifetime(
  lifetimePoints: number,
  thresholds?: Partial<TierThresholds> & { tierBronze?: number; tierSilver?: number; tierGold?: number }
): TierInfo {
  const t = normalizeThresholds(thresholds)
  if (lifetimePoints >= Math.max(t.gold, t.silver, t.bronze)) return TIERS.gold
  if (lifetimePoints >= Math.max(t.silver, t.bronze)) return TIERS.silver
  if (lifetimePoints >= t.bronze) return TIERS.bronze
  return TIERS.member
}

export const TIER_THRESHOLDS = DEFAULT_THRESHOLDS

export function LoyaltyTierBadge({
  lifetimePoints,
  balance,
  compact = false,
  className,
  thresholds,
}: {
  lifetimePoints: number
  balance?: number
  compact?: boolean
  className?: string
  thresholds?: Partial<TierThresholds> & { tierBronze?: number; tierSilver?: number; tierGold?: number }
}) {
  const info = tierForLifetime(lifetimePoints, thresholds)
  const Icon = info.icon
  return (
    <span
      title={`عميل ${info.labelAr} — ${lifetimePoints} نقطة مكتسبة عبر مدى التعامل${balance != null ? ` · الرصيد الحالي ${balance}` : ''}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap',
        info.className,
        className
      )}
    >
      <Icon className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {!compact && info.labelAr}
    </span>
  )
}
