console.log('✅ payment/request called')
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const { product_id, quantity } = await req.json()

  const { data: product } = await supabase
    .from('products')
    .select('id, name, retail_price, original_price')
    .eq('id', product_id)
    .single()

  if (!product) return NextResponse.json({ error: '제품 없음' }, { status: 404 })

  const price = product.retail_price ?? product.original_price ?? 0
  const totalAmount = price * quantity

  const { data: order } = await supabase
    .from('orders')
    .insert({
      customer_id: user.id,
      total_amount: totalAmount,
      final_amount: totalAmount,
      status: 'pending',
    })
    .select()
    .single()

  if (!order) return NextResponse.json({ error: '주문 생성 실패' }, { status: 500 })

  const payappReturn = process.env.PAYAPP_RETURN_URL!
  const returnurl = payappReturn.includes('?')
    ? `${payappReturn}&order_id=${order.id}`
    : `${payappReturn}?order_id=${order.id}`

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

  const response = await fetch(`https://www.payapp.kr/kspay/webpayment.do?${params}`)
  const text = await response.text()

  return NextResponse.json({ payUrl: text, orderId: order.id })
}