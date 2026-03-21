import type { SupabaseClient } from '@supabase/supabase-js'

export type UserCouponRow = {
  id: string
  status: string
  issued_at: string | null
  used_at: string | null
  expired_at?: string | null
  coupon_id: string
  coupons: Record<string, unknown> | null
}

/**
 * 쿠폰함: RLS는 user_coupons.user_id = auth.uid() 기준.
 * 임베드 조인은 환경에 따라 실패할 수 있어, user_coupons 단독 조회 후 coupons 를 in() 으로 묶는 방식이 가장 안정적.
 */
export async function fetchUserCouponsWithCoupons(
  supabase: SupabaseClient,
  authUid: string,
  opts?: { status?: string }
): Promise<{ rows: UserCouponRow[]; error: Error | null }> {
  if (!authUid) return { rows: [], error: new Error('missing_auth_uid') }

  const selectFlat = 'id,status,issued_at,used_at,expired_at,coupon_id'
  const selectFlatNoExp = 'id,status,issued_at,used_at,coupon_id'

  let q1 = supabase.from('user_coupons').select(selectFlat).eq('user_id', authUid).order('issued_at', { ascending: false })
  if (opts?.status) q1 = q1.eq('status', opts.status)

  let first = await q1
  let ucs: any[] | null = first.data
  let ucErr = first.error
  if (ucErr && /expired_at|column .* does not exist|Could not find/i.test(ucErr.message)) {
    let q2 = supabase.from('user_coupons').select(selectFlatNoExp).eq('user_id', authUid).order('issued_at', { ascending: false })
    if (opts?.status) q2 = q2.eq('status', opts.status)
    const r2 = await q2
    ucs = r2.data
    ucErr = r2.error
  }
  if (ucErr) return { rows: [], error: new Error(ucErr.message) }

  const list = ucs || []
  const ids = Array.from(new Set(list.map((u: { coupon_id: string }) => u.coupon_id).filter(Boolean)))
  const couponMap: Record<string, Record<string, unknown>> = {}

  if (ids.length > 0) {
    const { data: cps, error: cErr } = await supabase.from('coupons').select('*').in('id', ids)
    if (cErr) {
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
    expired_at: uc.expired_at ?? null,
    coupon_id: uc.coupon_id,
    coupons: couponMap[uc.coupon_id] || null,
  }))

  return { rows, error: null }
}
