import type { SupabaseClient } from '@supabase/supabase-js'

type PaymentIntentRow = {
  id: string
  user_id: string | null
  target_id: string | null
  amount: number | null
  kind: string
}

export async function handleBrandProductOrderComplete(
  intent: PaymentIntentRow,
  client: SupabaseClient,
): Promise<void> {
  if (!intent.target_id || !intent.user_id) return

  const { data: order } = await client
    .from('brand_product_orders')
    .select('id, customer_id, status, customer_toast_amount, final_amount')
    .eq('id', intent.target_id)
    .maybeSingle()
  if (order && order.status !== '결제완료') {
    await client
      .from('brand_product_orders')
      .update({ status: '결제완료', payment_id: String(intent.id), ordered_at: new Date().toISOString() })
      .eq('id', order.id)
    const toastEarn = Number(order.customer_toast_amount || 0)
    if (toastEarn > 0) {
      await client.from('toast_transactions').insert({
        user_id: order.customer_id,
        amount: toastEarn,
        transaction_type: 'earn',
        source_type: 'brand_product_order',
        source_id: order.id,
        reference_id: order.id,
      })
      const { error: ptErr } = await client.rpc('increment_points', {
        user_id: order.customer_id,
        amount: toastEarn,
      })
      if (ptErr) console.warn('[brand_product_order toast points]', ptErr)
      await client.from('notifications').insert({
        user_id: order.customer_id,
        type: 'toast',
        title: `${toastEarn.toLocaleString()}T 적립됐어요 🍞`,
        body: '제품 구매 완료 적립 토스트예요. 다음 주문에 사용해보세요!',
        link_url: '/wallet',
        is_read: false,
      })
    }
    await client.from('notifications').insert({
      user_id: order.customer_id,
      type: 'payment',
      title: '주문이 완료됐어요',
      body: `결제금액 ₩${Number(order.final_amount).toLocaleString()}`,
      link_url: '/my/orders',
      is_read: false,
    })
  }
}

export async function handleBrandProductOrderCancel(
  intent: PaymentIntentRow,
  client: SupabaseClient,
): Promise<void> {
  if (!intent.target_id) return

  await client
    .from('brand_product_orders')
    .update({ status: '취소' })
    .eq('id', intent.target_id)
    .neq('status', '취소')
}
