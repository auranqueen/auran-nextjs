console.log('✅ payment/request called')
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const { product_id, quantity } = await req.json()

  const { data: product, error } = await supabase
    .from('products')
    .select('id, name, retail_price')
    .eq('id', product_id)
    .single()

  console.log('product:', product)
  console.log('error:', error)

  if (!product) return NextResponse.json({ error: '제품 없음' }, { status: 404 })

  const price = product.retail_price ?? 0
  const totalAmount = price * quantity

  console.log('insert data:', {
    customer_id: user.id,
    total_amount: totalAmount,
    status: 'pending',
    items: [{ product_id, quantity, price }]
  })

  const { data: order, error: insertError } = await supabase
    .from('orders')
    .insert({
      customer_id: user.id,
      total_amount: totalAmount,
      final_amount: totalAmount,
      status: '주문확인',
    })
    .select()
    .single()

  console.log('insert error:', insertError)

  if (!order) return NextResponse.json({ error: '주문 생성 실패' }, { status: 500 })

  const returnurl = 'https://auran.kr/orders/complete'

  const params = new URLSearchParams({
    cmd: 'payrequest',
    userid: process.env.PAYAPP_USER_ID!,
    goodname: product.name,
    price: totalAmount.toString(),
    linkkey: process.env.PAYAPP_LINKKEY!,
    linkval: process.env.PAYAPP_LINKVAL!,
    shopname: process.env.PAYAPP_SHOPNAME!,
    recvphone: '',
    feedbackurl: process.env.PAYAPP_FEEDBACK_URL!,
    returnurl,
    orderid: order.id,
  })

  console.log('PayApp 호출 시작', params.toString())
  // fetch 호출
  const queryString = params
    .toString()
    .replaceAll(`linkkey=${process.env.PAYAPP_LINKKEY!}`, `linkkey=${encodeURIComponent(process.env.PAYAPP_LINKKEY!)}`)
    .replaceAll(`linkval=${process.env.PAYAPP_LINKVAL!}`, `linkval=${encodeURIComponent(process.env.PAYAPP_LINKVAL!)}`)
  const payUrl = `https://www.payapp.kr/kspay/webpayment.do?${queryString}`
  return NextResponse.json({ payUrl, orderId: order.id })
}