export const BRAND_TIER_ORDER = ['취급점', '전문점', '프리미엄전문점', '메디슈티컬'] as const
export type BrandTierName = (typeof BRAND_TIER_ORDER)[number]

export function brandTierRank(grade: string | null | undefined): number {
  if (!grade) return -1
  return BRAND_TIER_ORDER.indexOf(grade as BrandTierName)
}

/** 현재 등급보다 strictly 높은 tier만 구매 가능 */
export function canUpgradeToTier(current: string | null | undefined, target: string): boolean {
  const cur = brandTierRank(current)
  const tgt = brandTierRank(target)
  if (tgt < 0) return false
  if (cur < 0) return true
  return tgt > cur
}
