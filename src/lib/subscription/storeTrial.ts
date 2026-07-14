/** 원장 레이어1+2 통합 90일 무료 체험 기간 (ms) */
export const STORE_TRIAL_PERIOD_MS = 90 * 24 * 60 * 60 * 1000

/** 결제 후 이용기간 fallback (expires_at 없을 때) */
export const STORE_ACTIVE_PERIOD_MS = 365 * 24 * 60 * 60 * 1000

export type OwnerStorePeriodPhase = 'trial' | 'active' | 'expired'

export type OwnerSubLayer = 'store' | 'showcase'

export type OwnerStoreActiveSub = {
  started_at?: string | null
  expires_at?: string | null
  status?: string | null
  plan?: string | null
} | null

export type OwnerStorePeriod = {
  phase: OwnerStorePeriodPhase
  daysLeft: number
}

export const STORE_PLAN_SLUGS = [
  'track_a_store_annual',
  'track_b_store_annual',
] as const

export const SHOWCASE_PLAN_SLUGS = [
  'track_a_showcase_annual',
  'track_b_showcase_annual',
] as const

export function resolveTrialStart(
  trialStartedAt: string | null | undefined,
  createdAt: string | null | undefined,
): string | null {
  const started = trialStartedAt ? String(trialStartedAt).trim() : ''
  if (started) return started
  const created = createdAt ? String(createdAt).trim() : ''
  return created || null
}

export function isInUnifiedTrialPeriod(trialStart: string | null | undefined): boolean {
  if (!trialStart) return false
  const startedAt = new Date(trialStart).getTime()
  if (!Number.isFinite(startedAt)) return false
  return Date.now() - startedAt < STORE_TRIAL_PERIOD_MS
}

/** @deprecated 통합 체험은 resolveTrialStart + isInUnifiedTrialPeriod 사용 */
export function isInStoreTrialPeriod(createdAt: string | null | undefined): boolean {
  return isInUnifiedTrialPeriod(resolveTrialStart(null, createdAt))
}

function daysLeftUntil(endMs: number): number {
  if (!Number.isFinite(endMs)) return 0
  return Math.max(0, Math.ceil((endMs - Date.now()) / 86400000))
}

function activeSubEndMs(activeSub: NonNullable<OwnerStoreActiveSub>): number {
  if (activeSub.expires_at) {
    return new Date(activeSub.expires_at).getTime()
  }
  if (activeSub.started_at) {
    const started = new Date(activeSub.started_at).getTime()
    if (Number.isFinite(started)) return started + STORE_ACTIVE_PERIOD_MS
  }
  return NaN
}

/**
 * 레이어별 이용기간 판정.
 * active·미만료 → active / 없고 통합 체험 중 → trial / 그 외 → expired
 */
export function getOwnerLayerPeriod(args: {
  trialStart: string | null | undefined
  activeSubForLayer: OwnerStoreActiveSub
}): OwnerStorePeriod {
  const { trialStart, activeSubForLayer } = args
  const now = Date.now()

  if (activeSubForLayer) {
    const endMs = activeSubEndMs(activeSubForLayer)
    if (Number.isFinite(endMs) && endMs > now) {
      return { phase: 'active', daysLeft: daysLeftUntil(endMs) }
    }
    return { phase: 'expired', daysLeft: 0 }
  }

  if (trialStart && isInUnifiedTrialPeriod(trialStart)) {
    const startedAt = new Date(trialStart).getTime()
    const endMs = startedAt + STORE_TRIAL_PERIOD_MS
    return { phase: 'trial', daysLeft: daysLeftUntil(endMs) }
  }

  return { phase: 'expired', daysLeft: 0 }
}

/**
 * 하위호환: 레이어 무관 activeSub 1건 + created_at(또는 trialStartedAt) 기준.
 * 내부적으로 getOwnerLayerPeriod 재사용.
 */
export function getOwnerStorePeriod(args: {
  createdAt: string | null | undefined
  activeSub: OwnerStoreActiveSub
  trialStartedAt?: string | null | undefined
}): OwnerStorePeriod {
  const trialStart = resolveTrialStart(args.trialStartedAt, args.createdAt)
  return getOwnerLayerPeriod({
    trialStart,
    activeSubForLayer: args.activeSub,
  })
}

export function isPlanForLayer(plan: string | null | undefined, layer: OwnerSubLayer): boolean {
  const p = String(plan || '')
  if (layer === 'store') return (STORE_PLAN_SLUGS as readonly string[]).includes(p)
  return (SHOWCASE_PLAN_SLUGS as readonly string[]).includes(p)
}

/** active 구독 목록에서 레이어용 최신 1건 선택 (호출측이 created_at desc 정렬 권장) */
export function pickLayerActiveSub(
  rows: OwnerStoreActiveSub[] | null | undefined,
  layer: OwnerSubLayer,
): OwnerStoreActiveSub {
  if (!rows?.length) return null
  for (const row of rows) {
    if (!row) continue
    if (row.status && row.status !== 'active') continue
    if (isPlanForLayer(row.plan, layer)) return row
  }
  return null
}
