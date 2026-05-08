import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const { data: publicUser } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!publicUser?.id) return NextResponse.json({ error: 'user_row_missing' }, { status: 400 })

  const body = await req.json()
  const { product_id, quantity, prescription_owner_id, payment_method, total_amount: bodyTotal, final_amount: bodyFinal, recipient_name, recipient_phone, address, referrer_user_id } = body

  const { data: product } = await supabase
    .from('products')
    .select('id, name, retail_price')
    .eq('id', product_id)
    .single()

  if (!product) return NextResponse.json({ error: '제품 없음' }, { status: 404 })

  const price = product.retail_price ?? 0
  const lineTotal = price * quantity
  const useBodyAmounts = payment_method === 'bank_transfer' || payment_method === 'payapp'
  const totalAmount =
    useBodyAmounts && Number.isFinite(Number(bodyTotal)) && Number(bodyTotal) >= 0
      ? Math.floor(Number(bodyTotal))
      : lineTotal
  const finalAmount =
    useBodyAmounts && Number.isFinite(Number(bodyFinal)) && Number(bodyFinal) >= 0
      ? Math.floor(Number(bodyFinal))
      : totalAmount

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      customer_id: publicUser.id,
      total_amount: totalAmount,
      final_amount: finalAmount,
      shipping_fee: Math.max(0, Math.floor(Number(body.shipping_fee ?? 0))),
      grade_discount: Math.max(0, Math.floor(Number(body.grade_discount ?? 0))),
      coupon_discount: Math.max(0, Math.floor(Number(body.coupon_discount ?? 0))),
      subtotal: Math.max(0, Math.floor(Number(body.subtotal ?? 0))),
      status: payment_method === 'bank_transfer' ? '입금대기' : '주문확인',
      prescription_owner_id: prescription_owner_id || null,
      recipient_name: recipient_name || null,
      recipient_phone: recipient_phone || null,
      address: address || null,
      order_no: `ORD-${Date.now()}`,
      items: JSON.stringify([{
        product_id: product.id,
        product_name: product.name,
        price: product.retail_price,
        quantity: quantity
      }]),
    })
    .select()
    .single()

  if (!order) return NextResponse.json({ error: '주문 생성 실패', detail: orderError?.message, code: orderError?.code }, { status: 500 })

  const { tryCreateServiceClient } = await import('@/lib/supabase/service')
  const supabaseAdmin = tryCreateServiceClient() || supabase
  if (referrer_user_id) {
    await supabaseAdmin.from('share_logs').insert({
      sharer_user_id: referrer_user_id,
      product_id: product.id,
      channel: 'link',
      converted: true,
      converted_at: new Date().toISOString(),
    } as any)
  }

  if (payment_method === 'bank_transfer') {
    const orderNo = String((order as { order_no?: string }).order_no || '')
    const { tryCreateServiceClient } = await import('@/lib/supabase/service')
    const adminClient = tryCreateServiceClient() || supabase
    const { data: adminRow } = await adminClient.from('users').select('id').eq('role', 'admin').limit(1).maybeSingle()
    const adminUserId = (adminRow as { id?: string } | null)?.id
    if (adminUserId) {
      await adminClient.from('notifications').insert({
        user_id: adminUserId,
        type: 'payment',
        title: '무통장 입금 대기',
        body: `주문번호 ${orderNo} · ₩${finalAmount} 입금 확인 필요`,
        is_read: false,
      } as any)
    }
    return NextResponse.json({ ok: true, orderId: order.id, bankTransfer: true })
  }

  return NextResponse.json({ ok: true, orderId: order.id })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}