import type { SupabaseClient } from '@supabase/supabase-js'
import { issueCouponManualToUser } from '@/lib/admin/issueCouponManual'

export type IssueBulkRow = {
  user_id: string
  status: 'success' | 'already_issued' | 'error' | 'user_not_found'
  message?: string
}

/**
 * auth.users.id 배열에 대해 순차 발급 (쿠폰 한도·중복은 건별 처리)
 */
export async function issueCouponsToAuthUsers(
  svc: SupabaseClient,
  coupon_id: string,
  user_auth_ids: string[]
): Promise<{ results: IssueBulkRow[]; summary: { success: number; duplicate: number; failed: number } }> {
  const seen = new Set<string>()
  const unique = user_auth_ids.filter((id) => {
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })

  const results: IssueBulkRow[] = []
  for (const user_id of unique) {
    const r = await issueCouponManualToUser(svc, coupon_id, user_id)
    if (r.ok) {
      results.push({ user_id, status: 'success' })
      continue
    }
    if (r.error === 'already_issued') {
      results.push({ user_id, status: 'already_issued' })
      continue
    }
    if (r.error === 'user_not_found') {
      results.push({ user_id, status: 'user_not_found', message: r.error })
      continue
    }
    results.push({ user_id, status: 'error', message: r.error })
  }

  const summary = {
    success: results.filter((x) => x.status === 'success').length,
    duplicate: results.filter((x) => x.status === 'already_issued').length,
    failed: results.filter((x) => x.status === 'error' || x.status === 'user_not_found').length,
  }
  return { results, summary }
}
