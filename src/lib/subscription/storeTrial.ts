/** 원장 스토어 3개월(90일) 무료 체험 기간 (ms) */
export const STORE_TRIAL_PERIOD_MS = 90 * 24 * 60 * 60 * 1000

/**
 * users.created_at 기준 90일 이내인지 판정.
 * store/page.tsx isInTrialPeriod 로직 공통화.
 */
export function isInStoreTrialPeriod(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false
  const startedAt = new Date(createdAt).getTime()
  if (!Number.isFinite(startedAt)) return false
  return Date.now() - startedAt < STORE_TRIAL_PERIOD_MS
}
