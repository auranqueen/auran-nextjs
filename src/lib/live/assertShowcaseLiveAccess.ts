import type { SupabaseClient } from '@supabase/supabase-js'
import {
  STORE_ACTIVE_PERIOD_MS,
  STORE_TRIAL_PERIOD_MS,
  SHOWCASE_PLAN_SLUGS,
  getOwnerLayerPeriod,
  pickLayerActiveSub,
  resolveTrialStart,
  type OwnerStorePeriodPhase,
} from '@/lib/subscription/storeTrial'

export type ShowcaseLiveAccess = {
  ok: boolean
  phase: OwnerStorePeriodPhase
  daysLeft: number
  expiresAt: string | null
  locked: boolean
  /** public.users.id — 구독·살롱 조인용. 없으면 null */
  userId: string | null
}

type ServiceClient = SupabaseClient<any, 'public', any>

type ByAuthId = { authId: string; profileOwnerId?: never }
type ByProfileId = { profileOwnerId: string; authId?: never }

function expiredResult(partial?: Partial<ShowcaseLiveAccess>): ShowcaseLiveAccess {
  return {
    ok: false,
    phase: 'expired',
    daysLeft: 0,
    expiresAt: null,
    locked: true,
    userId: null,
    ...partial,
  }
}

function computeExpiresAt(
  phase: OwnerStorePeriodPhase,
  trialStart: string | null,
  activeSub: { expires_at?: string | null; started_at?: string | null } | null,
): string | null {
  if (activeSub?.expires_at) {
    const t = new Date(activeSub.expires_at).getTime()
    return Number.isFinite(t) ? new Date(t).toISOString() : null
  }
  if (phase === 'trial' && trialStart) {
    const started = new Date(trialStart).getTime()
    if (Number.isFinite(started)) return new Date(started + STORE_TRIAL_PERIOD_MS).toISOString()
  }
  if (activeSub?.started_at) {
    const started = new Date(activeSub.started_at).getTime()
    if (Number.isFinite(started)) return new Date(started + STORE_ACTIVE_PERIOD_MS).toISOString()
  }
  return null
}

async function accessFromUserRow(
  svc: ServiceClient,
  userRow: { id: string; created_at?: string | null; store_trial_started_at?: string | null },
): Promise<ShowcaseLiveAccess> {
  const trialStart = resolveTrialStart(userRow.store_trial_started_at, userRow.created_at)
  const { data: subRows, error } = await svc
    .from('owner_subscriptions')
    .select('plan, started_at, expires_at, status')
    .eq('owner_id', userRow.id)
    .eq('status', 'active')
    .in('plan', [...SHOWCASE_PLAN_SLUGS])
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[assertShowcaseLiveAccess] subscriptions query error', error)
    return expiredResult({ ok: false, userId: String(userRow.id) })
  }
  const activeSub = pickLayerActiveSub((subRows as any[]) || [], 'showcase')
  const period = getOwnerLayerPeriod({ trialStart, activeSubForLayer: activeSub })
  return {
    ok: true,
    phase: period.phase,
    daysLeft: period.daysLeft,
    expiresAt: computeExpiresAt(period.phase, trialStart, activeSub),
    locked: period.phase === 'expired',
    userId: String(userRow.id),
  }
}

/**
 * 쇼케이스(체험 포함) 라이브 접근 판정.
 * 구독은 public.users.id 기준. 방송 owner_id 는 profiles.id → auth_id → users.
 * 캐시 없음 — 호출마다 DB 계산.
 */
export async function assertShowcaseLiveAccess(
  svc: ServiceClient,
  opts: ByAuthId | ByProfileId,
): Promise<ShowcaseLiveAccess> {
  let authId: string | null = null

  if ('authId' in opts && opts.authId) {
    authId = opts.authId
  } else if ('profileOwnerId' in opts && opts.profileOwnerId) {
    const { data: profile, error } = await svc
      .from('profiles')
      .select('auth_id')
      .eq('id', opts.profileOwnerId)
      .maybeSingle()
    if (error) {
      console.error('[assertShowcaseLiveAccess] profile query error', error)
      return expiredResult()
    }
    authId = profile?.auth_id ? String(profile.auth_id) : null
  }

  if (!authId) return expiredResult()

  const { data: userRow, error: userError } = await svc
    .from('users')
    .select('id, created_at, store_trial_started_at')
    .eq('auth_id', authId)
    .maybeSingle()
  if (userError) {
    console.error('[assertShowcaseLiveAccess] user query error', userError)
    return expiredResult()
  }
  if (!userRow?.id) return expiredResult()

  return accessFromUserRow(svc, userRow as { id: string; created_at?: string | null; store_trial_started_at?: string | null })
}
