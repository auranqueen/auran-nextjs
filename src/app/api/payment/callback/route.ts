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
