import type { SupabaseClient } from '@supabase/supabase-js'

export type UserCouponRow = {
  id: string
  status: string
  issued_at: string | null
  used_at: string | null
  coupon_id: string
  coupons: Record<string, unknown> | null
}

/**
 * user_coupons → coupon_id 로 coupons 를 따로 조회해 병합 (PostgREST embed/RLS 이슈 회피)
 */
export async function fetchUserCouponsWithCoupons(
  supabase: SupabaseClient,
  authUid: string,
  opts?: { status?: string }
): Promise<{ rows: UserCouponRow[]; error: Error | null }> {
  let q = supabase
    .from('user_coupons')
    .select('id,status,issued_at,used_at,coupon_id')
    .eq('user_id', authUid)
    .order('issued_at', { ascending: false })

  if (opts?.status) q = q.eq('status', opts.status)

  const { data: ucs, error: ucErr } = await q
  if (ucErr) return { rows: [], error: new Error(ucErr.message) }

  const list = ucs || []
  const ids = Array.from(new Set(list.map((u: { coupon_id: string }) => u.coupon_id).filter(Boolean)))
  const couponMap: Record<string, Record<string, unknown>> = {}

  if (ids.length > 0) {
    const { data: cps, error: cErr } = await supabase.from('coupons').select('*').in('id', ids)
    if (cErr) {
      // 쿠폰 메타는 실패해도 user_coupons 행은 유지
      console.warn('[fetchUserCouponsWithCoupons] coupons batch:', cErr.message)
    }
    for (const c of cps || []) {
      const row = c as Record<string, unknown>
      const id = row.id as string
      if (id) couponMap[id] = row
    }
  }

  const rows: UserCouponRow[] = list.map((uc: any) => ({
    id: uc.id,
    status: uc.status,
    issued_at: uc.issued_at,
    used_at: uc.used_at,
    coupon_id: uc.coupon_id,
    coupons: couponMap[uc.coupon_id] || null,
  }))

  return { rows, error: null }
}
