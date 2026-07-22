import type { SupabaseClient } from '@supabase/supabase-js'

type PaymentIntentRow = {
  id: string
  user_id: string | null
  target_id: string | null
  amount: number | null
  kind: string
}

export async function handleHqStockOrderComplete(
  intent: PaymentIntentRow,
  client: SupabaseClient,
): Promise<void> {
  if (!intent.target_id) return
  const { data: order } = await client
    .from('hq_stock_orders')
    .select('id, status, final_amount')
    .eq('id', intent.target_id)
    .maybeSingle()
  if (!order?.id) return
  if (order.status === '결제완료' || order.status === '배송완료' || order.status === '구매확정') return
  if (Number(order.final_amount) !== Number(intent.amount || 0)) {
    console.error('[hq_stock_order amount mismatch]', {
      order_id: intent.target_id,
      expected: intent.amount,
      actual: order.final_amount,
    })
    return
  }
  const nowIso = new Date().toISOString()
  await client
    .from('hq_stock_orders')
    .update({
      status: '결제완료',
      ordered_at: nowIso,
      payment_id: String(intent.id),
      updated_at: nowIso,
    })
    .eq('id', order.id)
    .eq('status', '결제대기')
}

export async function handleHqStockOrderCancel(
  intent: PaymentIntentRow,
  client: SupabaseClient,
): Promise<void> {
  if (!intent.target_id) return
  const nowIso = new Date().toISOString()
  await client
    .from('hq_stock_orders')
    .update({ status: '취소', updated_at: nowIso })
    .eq('id', intent.target_id)
    .neq('status', '취소')
}
