import type { SupabaseClient } from '@supabase/supabase-js'
import { insertNotificationForProfile } from '@/lib/notifications/notifyProfile'

function computeExpiredAtIso(couponEndAt: string | null | undefined): string {
  const now = Date.now()
  const days30 = 30 * 86400000
  if (couponEndAt) {
    const t = new Date(couponEndAt).getTime()
    if (Number.isFinite(t) && t > now) return new Date(t).toISOString()
  }
  return new Date(now + days30).toISOString()
}

export type IssueCouponResult =
  | { ok: true }
  | { ok: false; error: string; status: number }

/**
 * 서비스 롤 클라이언트로만 호출 — user_coupons INSERT + 알림
 * (expired_at 컬럼은 migration 029 이후 사용)
 */
export async function issueCouponManualToUser(
  svc: SupabaseClient,
  coupon_id: string,
  user_auth_id: string
): Promise<IssueCouponResult> {
  if (!coupon_id || !user_auth_id) {
    return { ok: false, error: 'missing_fields', status: 400 }
  }

  const { data: coupon, error: cErr } = await svc
    .from('coupons')
    .select('id,name,issued_count,max_issue_count,end_at')
    .eq('id', coupon_id)
    .maybeSingle()

  if (cErr || !coupon) {
    return { ok: false, error: 'coupon_not_found', status: 400 }
  }

  const c = coupon as {
    id: string
    name?: string
    issued_count?: number
    max_issue_count?: number | null
    end_at?: string | null
  }
  if (c.max_issue_count != null && (c.issued_count || 0) >= c.max_issue_count) {
    return { ok: false, error: 'issue_limit_reached', status: 400 }
  }

  const { data: exists } = await svc
    .from('user_coupons')
    .select('id')
    .eq('user_id', user_auth_id)
    .eq('coupon_id', coupon_id)
    .maybeSingle()
  if (exists) {
    return { ok: false, error: 'already_issued', status: 400 }
  }

  const issuedAt = new Date().toISOString()
  const expiredAt = computeExpiredAtIso(c.end_at)

  const insertRow = {
    user_id: user_auth_id,
    coupon_id,
    status: 'unused' as const,
    issued_at: issuedAt,
    expired_at: expiredAt,
  }

  let insErr = (await svc.from('user_coupons').insert(insertRow as any)).error
  if (insErr && /expired_at|created_at|column .* does not exist|Could not find/i.test(insErr.message)) {
    insErr = (
      await svc.from('user_coupons').insert({
        user_id: user_auth_id,
        coupon_id,
        status: 'unused',
        issued_at: issuedAt,
      } as any)
    ).error
  }
  if (insErr) {
    return { ok: false, error: insErr.message || 'user_coupons_insert_failed', status: 500 }
  }

  await svc
    .from('coupons')
    .update({ issued_count: (c.issued_count || 0) + 1 })
    .eq('id', coupon_id)

  const { data: recipient } = await svc.from('users').select('id').eq('auth_id', user_auth_id).maybeSingle()
  const couponName = (c.name || '쿠폰').trim()
  if (recipient?.id) {
    await insertNotificationForProfile(svc, recipient.id, {
      type: 'coupon_issued',
      title: '🎁 쿠폰이 도착했어요!',
      body: `[${couponName}] 쿠폰이 발급되었습니다.`,
      link: '/my/coupons',
      icon: '🎁',
    })
  }

  return { ok: true }
}
