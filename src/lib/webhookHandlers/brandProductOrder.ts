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
  const { data: orders } = await client
    .from('brand_product_orders')
    .select('id, customer_id, status, customer_toast_amount, final_amount')
    .eq('checkout_batch_id', intent.target_id)
  if (!orders || orders.length === 0) return
  const totalAmount = orders.reduce((sum, o) => sum + Number(o.final_amount || 0), 0)
  if (totalAmount !== Number(intent.amount || 0)) {
    console.error('[brand_product_order batch amount mismatch]', {
      batch_id: intent.target_id,
      expected: intent.amount,
      actual: totalAmount,
    })
    const { data: admins } = await client.from('users').select('id').in('role', ['admin', 'master'])
    if (admins && admins.length > 0) {
      await client.from('notifications').insert(
        admins.map(a => ({
          user_id: a.id,
          type: 'system',
          title: '[관리자] 트랙A 결제 금액 불일치',
          body: `batch_id: ${intent.target_id}, 기대금액: ${intent.amount}, 실제합계: ${totalAmount}`,
          link_url: '/admin',
          is_read: false,
        }))
      )
    }
    return
  }
  for (const order of orders) {
    if (order.status === '결제완료') continue
    try {
      await client
        .from('brand_product_orders')
        .update({ status: '결제완료', payment_id: String(intent.id), ordered_at: new Date().toISOString() })
        .eq('id', order.id)
      const { data: orderItemsForSales } = await client
        .from('brand_product_order_items')
        .select('brand_product_id, quantity')
        .eq('order_id', order.id)
      for (const item of orderItemsForSales || []) {
        await client.rpc('increment_brand_product_sales', {
          pid: item.brand_product_id,
          qty: item.quantity,
        })
      }
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
    } catch (e) {
      console.error('[brand_product_order individual processing failed]', { order_id: order.id, error: e })
      const { data: admins } = await client.from('users').select('id').in('role', ['admin', 'master'])
      if (admins && admins.length > 0) {
        await client.from('notifications').insert(
          admins.map(a => ({
            user_id: a.id,
            type: 'system',
            title: '[관리자] 트랙A 주문 처리 실패',
            body: `order_id: ${order.id}, batch_id: ${intent.target_id}`,
            link_url: '/admin',
            is_read: false,
          }))
        )
      }
    }
  }
}

export async function handleBrandProductOrderCancel(
  intent: PaymentIntentRow,
  client: SupabaseClient,
): Promise<void> {
  if (!intent.target_id) return
  const { data: ordersToCancel } = await client
    .from('brand_product_orders')
    .select('id, status')
    .eq('checkout_batch_id', intent.target_id)
    .neq('status', '취소')
  if (!ordersToCancel || ordersToCancel.length === 0) return
  for (const order of ordersToCancel) {
    if (order.status === '결제완료') {
      const { data: orderItemsForSales } = await client
        .from('brand_product_order_items')
        .select('brand_product_id, quantity')
        .eq('order_id', order.id)
      for (const item of orderItemsForSales || []) {
        await client.rpc('decrement_brand_product_sales', {
          pid: item.brand_product_id,
          qty: item.quantity,
        })
      }
    }
  }
  await client
    .from('brand_product_orders')
    .update({ status: '취소' })
    .eq('checkout_batch_id', intent.target_id)
    .neq('status', '취소')
}
