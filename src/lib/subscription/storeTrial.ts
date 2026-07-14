/** 원장 스토어 3개월(90일) 무료 체험 기간 (ms) */
export const STORE_TRIAL_PERIOD_MS = 90 * 24 * 60 * 60 * 1000

/** 결제 후 이용기간 fallback (expires_at 없을 때) */
export const STORE_ACTIVE_PERIOD_MS = 365 * 24 * 60 * 60 * 1000

export type OwnerStorePeriodPhase = 'trial' | 'active' | 'expired'

export type OwnerStoreActiveSub = {
  started_at?: string | null
  expires_at?: string | null
  status?: string | null
} | null

export type OwnerStorePeriod = {
  phase: OwnerStorePeriodPhase
  daysLeft: number
}

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

function daysLeftUntil(endMs: number): number {
  if (!Number.isFinite(endMs)) return 0
  return Math.max(0, Math.ceil((endMs - Date.now()) / 86400000))
}

/**
 * 결제 전(90일 체험) / 결제 후(이용기간) / 만료 통합 판정.
 * activeSub는 status='active' 행을 넘기는 것을 전제.
 */
export function getOwnerStorePeriod(args: {
  createdAt: string | null | undefined
  activeSub: OwnerStoreActiveSub
}): OwnerStorePeriod {
  const { createdAt, activeSub } = args
  const now = Date.now()

  if (activeSub) {
    let endMs = NaN
    if (activeSub.expires_at) {
      endMs = new Date(activeSub.expires_at).getTime()
    } else if (activeSub.started_at) {
      const started = new Date(activeSub.started_at).getTime()
      if (Number.isFinite(started)) endMs = started + STORE_ACTIVE_PERIOD_MS
    }
    if (Number.isFinite(endMs) && endMs > now) {
      return { phase: 'active', daysLeft: daysLeftUntil(endMs) }
    }
    return { phase: 'expired', daysLeft: 0 }
  }

  if (createdAt && isInStoreTrialPeriod(createdAt)) {
    const startedAt = new Date(createdAt).getTime()
    const endMs = startedAt + STORE_TRIAL_PERIOD_MS
    return { phase: 'trial', daysLeft: daysLeftUntil(endMs) }
  }

  return { phase: 'expired', daysLeft: 0 }
}
