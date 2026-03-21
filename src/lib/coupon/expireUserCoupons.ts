import { tryCreateServiceClient } from '@/lib/supabase/service'

/** 쿠폰 템플릿 end_at 이 지난 미사용 user_coupons 를 expired 로 표시 */
export async function expireUnusedCouponsPastEnd(): Promise<{ updated: number }> {
  const client = tryCreateServiceClient()
  if (!client) return { updated: 0 }

  const { data: expiredCouponRows } = await client
    .from('coupons')
    .select('id')
    .not('end_at', 'is', null)
    .lt('end_at', new Date().toISOString())

  const couponIds = (expiredCouponRows || []).map((c: { id: string }) => c.id)
  if (couponIds.length === 0) return { updated: 0 }

  const chunk = 200
  let total = 0
  for (let i = 0; i < couponIds.length; i += chunk) {
    const slice = couponIds.slice(i, i + chunk)
    const { data: toExpire, error } = await client
      .from('user_coupons')
      .select('id')
      .in('coupon_id', slice)
      .eq('status', 'unused')

    if (error || !toExpire?.length) continue

    const ids = toExpire.map((u: { id: string }) => u.id)
    const { error: upErr } = await client
      .from('user_coupons')
      .update({ status: 'expired' })
      .in('id', ids)
      .eq('status', 'unused')

    if (!upErr) total += ids.length
  }

  return { updated: total }
}
