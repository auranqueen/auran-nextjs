import type { SupabaseClient } from '@supabase/supabase-js'
import { isValidCustomerGrade } from '@/lib/customerGrade'

function computeExpiredAtIso(couponEndAt: string | null | undefined): string {
  const now = Date.now()
  const days30 = 30 * 86400000
  if (couponEndAt) {
    const t = new Date(couponEndAt).getTime()
    if (Number.isFinite(t) && t > now) return new Date(t).toISOString()
  }
  return new Date(now + days30).toISOString()
}

const CHUNK = 400

export type BulkIssueTarget = 'all' | 'grade' | 'selected'

export type BulkIssueSpecialResult =
  | { ok: true; issued: number; skipped: number }
  | { ok: false; error: string; status: number }

/**
 * 특별이벤트 쿠폰만 — user_coupons + notifications 벌크 (서비스 롤)
 */
export async function bulkIssueSpecialEventCoupon(
  svc: SupabaseClient,
  coupon_id: string,
  opts: {
    target: BulkIssueTarget
    /** target === 'grade' 일 때 users.customer_grade */
    customer_grade?: string | null
    /** target === 'selected' 일 때 auth.users id 목록 */
    auth_ids?: string[]
  }
): Promise<BulkIssueSpecialResult> {
  if (!coupon_id) return { ok: false, error: 'missing_coupon_id', status: 400 }

  const { data: coupon, error: cErr } = await svc
    .from('coupons')
    .select('id,name,issued_count,max_issue_count,end_at,coupon_type')
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
    coupon_type?: string
  }

  if ((c.coupon_type || 'regular') !== 'special_event') {
    return { ok: false, error: 'not_special_event_coupon', status: 400 }
  }

  if (c.max_issue_count != null && (c.issued_count || 0) >= c.max_issue_count) {
    return { ok: false, error: 'issue_limit_reached', status: 400 }
  }

  let q = svc.from('users').select('id,auth_id').eq('role', 'customer').not('auth_id', 'is', null)

  if (opts.target === 'grade') {
    const g = (opts.customer_grade || '').trim()
    if (!g || !isValidCustomerGrade(g)) return { ok: false, error: 'customer_grade_required', status: 400 }
    q = q.eq('customer_grade', g)
  } else if (opts.target === 'selected') {
    const ids = (opts.auth_ids || []).filter((x) => typeof x === 'string' && x.length > 10)
    if (!ids.length) return { ok: false, error: 'no_recipients', status: 400 }
    q = q.in('auth_id', ids)
  }

  const { data: recipients, error: rErr } = await q
  if (rErr) return { ok: false, error: rErr.message || 'recipients_query_failed', status: 500 }

  const rows = (recipients || []) as { id: string; auth_id: string }[]
  const maxNew =
    c.max_issue_count == null ? rows.length : Math.max(0, c.max_issue_count - (c.issued_count || 0))
  if (maxNew === 0) return { ok: false, error: 'issue_limit_reached', status: 400 }

  const { data: existing } = await svc.from('user_coupons').select('user_id').eq('coupon_id', coupon_id)
  const already = new Set((existing || []).map((x: { user_id: string }) => x.user_id))

  const issuedAt = new Date().toISOString()
  const expiredAt = computeExpiredAtIso(c.end_at)
  const couponName = (c.name || '쿠폰').trim()

  let skippedAlready = 0
  const eligible: { user_id: string; profile_id: string }[] = []
  for (const r of rows) {
    if (!r.auth_id || !r.id) continue
    if (already.has(r.auth_id)) {
      skippedAlready += 1
      continue
    }
    eligible.push({ user_id: r.auth_id, profile_id: r.id })
  }

  const cappedOut = Math.max(0, eligible.length - maxNew)
  const toInsert = eligible.slice(0, maxNew)
  const skipped = skippedAlready + cappedOut

  if (!toInsert.length) {
    return { ok: true, issued: 0, skipped }
  }

  const notifTitle = '🎁 특별 쿠폰이 도착했어요!'
  const notifBody = `[${couponName}] 쿠폰이 발급되었습니다. 유효기간 내 사용해보세요 ✨`

  let inserted = 0
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const slice = toInsert.slice(i, i + CHUNK)
    const ucRows = slice.map((x) => ({
      user_id: x.user_id,
      coupon_id,
      status: 'unused' as const,
      issued_at: issuedAt,
      expired_at: expiredAt,
    }))

    let insErr = (await svc.from('user_coupons').insert(ucRows as any)).error
    if (insErr && /expired_at|created_at|column .* does not exist|Could not find/i.test(insErr.message)) {
      insErr = (
        await svc.from('user_coupons').insert(
          slice.map((x) => ({
            user_id: x.user_id,
            coupon_id,
            status: 'unused',
            issued_at: issuedAt,
          })) as any
        )
      ).error
    }
    if (insErr) {
      return { ok: false, error: insErr.message || 'user_coupons_bulk_failed', status: 500 }
    }

    const notifRows = slice.map((x) => ({
      user_id: x.profile_id,
      type: 'coupon_issued',
      title: notifTitle,
      body: notifBody,
      link: '/my/coupons',
      is_read: false,
      icon: '🎁',
    }))

    const nErr = (await svc.from('notifications').insert(notifRows as any)).error
    if (nErr) {
      return { ok: false, error: nErr.message || 'notifications_bulk_failed', status: 500 }
    }

    inserted += slice.length
  }

  await svc
    .from('coupons')
    .update({ issued_count: (c.issued_count || 0) + inserted })
    .eq('id', coupon_id)

  return { ok: true, issued: inserted, skipped }
}
