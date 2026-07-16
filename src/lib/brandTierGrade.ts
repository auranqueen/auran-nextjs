/** 등급 없음(null)이면 구매 가능. targetPrice가 현재보다 strictly 커야 업그레이드 가능 */
export function canUpgradeToTier(currentPrice: number | null, targetPrice: number): boolean {
  const target = Math.trunc(Number(targetPrice))
  if (!Number.isFinite(target) || target <= 0) return false

  if (currentPrice == null) return true

  const current = Math.trunc(Number(currentPrice))
  if (!Number.isFinite(current) || current <= 0) return true

  return target > current
}

/**
 * Track A 셀프 등급결제 청구액.
 * - 첫 가입(current null / 무효): 목표 등급 정가 전액
 * - 업그레이드: 목표 정가 − 현재 정가 (차액)
 * - 동일/하향: null (거절)
 */
export function computeTierUpgradeCharge(
  currentPrice: number | null,
  targetPrice: number,
): number | null {
  if (!canUpgradeToTier(currentPrice, targetPrice)) return null

  const target = Math.trunc(Number(targetPrice))
  if (currentPrice == null) return target

  const current = Math.trunc(Number(currentPrice))
  if (!Number.isFinite(current) || current <= 0) return target

  return target - current
}
