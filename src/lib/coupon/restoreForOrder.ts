import { tryCreateServiceClient } from '@/lib/supabase/service'

/**
 * 결제 완료 후 주문 취소·환불 시 쿠폰을 다시 사용 가능 상태로 되돌립니다.
 * (service role 필요 — RLS 우회)
 */
export async function restoreUserCouponForOrder(orderId: string): Promise<void> {
  const client = tryCreateServiceClient()
  if (!client) return

  const { data: o } = await client.from('orders').select('user_coupon_id').eq('id', orderId).maybeSingle()
  const uid = o?.user_coupon_id
  if (!uid) return

  await client
    .from('user_coupons')
    .update({ status: 'unused', used_at: null, order_id: null })
    .eq('id', uid)
    .eq('status', 'used')
}