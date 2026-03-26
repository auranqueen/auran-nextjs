import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const body = await req.formData()
  
  const orderId = body.get('orderid') as string
  const status = body.get('stat') as string
  const payId = body.get('payid') as string

  if (status === 'Y') {
    await supabase
      .from('orders')
      .update({ status: 'paid', pay_id: payId })
      .eq('id', orderId)

    // benefit-calculator로 포인트 적립
    const { data: benefitOrder } = await supabase
      .from('orders')
      .select('total_amount, customer_id')
      .eq('id', orderId)
      .single()

    if (benefitOrder) {
      const { data: settings } = await supabase
        .from('benefit_settings')
        .select('setting_key, setting_value')

      const settingsMap: Record<string, number> = {}
      settings?.forEach((s: any) => {
        settingsMap[s.setting_key] = Number(s.setting_value) || 0
      })

      const purchaseRate = settingsMap['purchase_point_rate'] ?? 3
      const pointsToAdd = Math.floor(
        (Number(benefitOrder.total_amount) || 0) * (purchaseRate / 100)
      )

      const { data: userRow } = await supabase
        .from('users')
        .select('points')
        .eq('id', benefitOrder.customer_id)
        .single()

      const currentPoint = userRow?.points ?? 0
      const newPoint = currentPoint + pointsToAdd

      await supabase
        .from('users')
        .update({ points: newPoint })
        .eq('id', benefitOrder.customer_id)

      await supabase.from('toast_transactions').insert({
        user_id: benefitOrder.customer_id,
        amount: pointsToAdd,
        transaction_type: 'purchase',
        source_type: 'headquarters',
        source_id: null,
        reference_id: orderId,
        balance_after: newPoint,
      })
    }

    const { data: orderData } = await supabase
      .from('orders')
      .select('total_amount, customer_id')
      .eq('id', orderId)
      .maybeSingle()

    if (orderData?.customer_id) {
      const pointsToAdd = Math.floor((Number(orderData.total_amount) || 0) * 0.05)
      if (pointsToAdd > 0) {
        await supabase.rpc('award_points', {
          p_user_id: orderData.customer_id,
          p_amount: pointsToAdd,
          p_description: '결제 완료 토스트 포인트(5%)',
          p_icon: '🍞',
          p_order_id: orderId,
        })
      }
    }
  }

  return NextResponse.json({
    success: true,
    redirectUrl: `/orders/complete?order_id=${orderId}`,
  })
}
