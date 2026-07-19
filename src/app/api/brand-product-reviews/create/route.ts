import { NextRequest, NextResponse } from 'next/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  const service = tryCreateAdminClient()
  if (!service) return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 500 })
  const { data: me } = await service.from('users').select('id').eq('auth_id', user.id).single()
  if (!me) return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 404 })
  const body = await req.json()
  const { order_id, brand_product_id, rating, content, images } = body
  if (!order_id || !brand_product_id || !rating) {
    return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 })
  }
  const { data: order } = await service
    .from('brand_product_orders')
    .select('id, customer_id, status, review_toast_rate, review_toast_paid, subtotal')
    .eq('id', order_id)
    .maybeSingle()
  if (!order || order.customer_id !== me.id) {
    return NextResponse.json({ ok: false, error: 'order_not_found' }, { status: 404 })
  }
  if (order.status !== '결제완료' && order.status !== '배송완료') {
    return NextResponse.json({ ok: false, error: 'order_not_eligible' }, { status: 400 })
  }
  const { data: item } = await service
    .from('brand_product_order_items')
    .select('id')
    .eq('order_id', order_id)
    .eq('brand_product_id', brand_product_id)
    .maybeSingle()
  if (!item) {
    return NextResponse.json({ ok: false, error: 'product_not_in_order' }, { status: 400 })
  }
  const { data: review, error } = await service
    .from('brand_product_reviews')
    .insert({
      brand_product_id, order_id, author_id: me.id,
      rating, content, images: images || [],
    })
    .select('id')
    .single()
  if (error || !review) {
    return NextResponse.json({ ok: false, error: 'review_already_exists' }, { status: 409 })
  }
  await service.rpc('increment_brand_product_review_stats', {
    pid: brand_product_id,
    r: rating,
  })
  let toastEarn = 0
  if (!order.review_toast_paid) {
    toastEarn = Math.floor(order.subtotal * order.review_toast_rate / 100)
    if (toastEarn > 0) {
      await service.from('toast_transactions').insert({
        user_id: me.id, amount: toastEarn, transaction_type: 'earn',
        source_type: 'brand_product_review', source_id: review.id, reference_id: order_id,
      })
      await service.rpc('increment_points', { user_id: me.id, amount: toastEarn })
    }
    await service.from('brand_product_orders').update({ review_toast_paid: true }).eq('id', order_id)
  }
  return NextResponse.json({ ok: true, review_id: review.id, toast_earned: toastEarn })
}
