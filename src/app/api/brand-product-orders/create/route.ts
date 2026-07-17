import { NextRequest, NextResponse } from 'next/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
const REVIEW_TOAST_RATE = 5 // 시바산 본사정책 하드코딩, 수정 불가
const TRACK_A_FREE_SHIPPING_THRESHOLD = 50000
const TRACK_A_BASIC_SHIPPING_FEE = 3000
const TRACK_A_JEJU_EXTRA_FEE = 5000
const TRACK_A_ISLAND_EXTRA_FEE = 5000
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  const service = tryCreateAdminClient()
  if (!service) return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 500 })
  const { data: me } = await service.from('users').select('id').eq('auth_id', user.id).single()
  if (!me) return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 404 })
  const body = await req.json()
  const { salon_id, items, recipient_name, recipient_phone, address, address_detail } = body
  if (!salon_id || !Array.isArray(items) || items.length === 0 || !address) {
    return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 })
  }
  const { data: salon } = await service.from('salons').select('id, owner_id').eq('id', salon_id).single()
  if (!salon) return NextResponse.json({ ok: false, error: 'salon_not_found' }, { status: 404 })
  const { data: owner } = await service.from('users').select('id, origin_track').eq('id', salon.owner_id).single()
  if (!owner || owner.origin_track !== 'A') {
    return NextResponse.json({ ok: false, error: 'not_track_a_salon' }, { status: 403 })
  }
  const productIds = items.map((i: any) => i.brand_product_id)
  const { data: products } = await service
    .from('brand_products')
    .select('id, brand_id, name, consumer_price, customer_toast_rate, status')
    .in('id', productIds)
  if (!products || products.length !== productIds.length) {
    return NextResponse.json({ ok: false, error: 'product_not_found' }, { status: 404 })
  }
  if (products.some(p => p.status !== 'active')) {
    return NextResponse.json({ ok: false, error: 'product_not_active' }, { status: 400 })
  }
  const brandIds = Array.from(new Set(products.map(p => p.brand_id)))
  if (brandIds.length !== 1) {
    return NextResponse.json({ ok: false, error: 'multiple_brands_not_allowed' }, { status: 400 })
  }
  const brandId = brandIds[0]
  const { data: link } = await service
    .from('brand_owner_links')
    .select('id').eq('owner_id', owner.id).eq('brand_id', brandId).eq('status', 'active')
    .maybeSingle()
  if (!link) return NextResponse.json({ ok: false, error: 'brand_not_linked' }, { status: 403 })
  let subtotal = 0
  let totalCustomerToast = 0
  const orderItems = items.map((i: any) => {
    const p = products.find(pp => pp.id === i.brand_product_id)!
    const lineSubtotal = p.consumer_price * i.quantity
    const lineToast = Math.floor(lineSubtotal * p.customer_toast_rate / 100)
    subtotal += lineSubtotal
    totalCustomerToast += lineToast
    return {
      brand_product_id: p.id,
      product_name: p.name,
      consumer_price: p.consumer_price,
      quantity: i.quantity,
      subtotal: lineSubtotal,
      customer_toast_rate: p.customer_toast_rate,
      customer_toast_amount: lineToast,
    }
  })
  const basicFee = subtotal >= TRACK_A_FREE_SHIPPING_THRESHOLD ? 0 : TRACK_A_BASIC_SHIPPING_FEE
  let extraFee = 0
  if (address.includes('제주')) extraFee += TRACK_A_JEJU_EXTRA_FEE
  if (address.includes('울릉')) extraFee += TRACK_A_ISLAND_EXTRA_FEE
  const shippingFee = basicFee + extraFee
  const finalAmount = subtotal + shippingFee
  const platformFeeRate = 8.8
  const platformFee = Math.floor(finalAmount * platformFeeRate / 100)
  const ownerAmount = finalAmount - platformFee
  const orderNo = `BPO${Date.now()}`
  const { data: order, error } = await service
    .from('brand_product_orders')
    .insert({
      order_no: orderNo,
      customer_id: me.id,
      salon_id,
      brand_id: brandId,
      status: '결제대기',
      recipient_name, recipient_phone, address, address_detail,
      subtotal,
      shipping_fee: shippingFee,
      final_amount: finalAmount,
      platform_fee_rate: platformFeeRate,
      platform_fee: platformFee,
      owner_amount: ownerAmount,
      review_toast_rate: REVIEW_TOAST_RATE,
      customer_toast_amount: totalCustomerToast,
    })
    .select('id, order_no, final_amount')
    .single()
  if (error || !order) {
    return NextResponse.json({ ok: false, error: 'order_create_failed' }, { status: 500 })
  }
  await service.from('brand_product_order_items').insert(
    orderItems.map(oi => ({ ...oi, order_id: order.id }))
  )
  return NextResponse.json({ ok: true, order_id: order.id, order_no: order.order_no, final_amount: order.final_amount })
}
