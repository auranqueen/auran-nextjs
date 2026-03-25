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
    recvphone: '01000000000',
    feedbackurl: process.env.PAYAPP_FEEDBACK_URL!,
    returnurl,
    orderid: order.id,
  })

  console.log('PayApp 호출 시작', params.toString())
  // fetch 호출
  const postdata: Record<string, string> = {
    cmd: 'payrequest',
    userid: process.env.PAYAPP_USER_ID!,
    shopname: process.env.PAYAPP_SHOPNAME!,
    linkkey: process.env.PAYAPP_LINKKEY!,
    linkval: process.env.PAYAPP_LINKVAL!,
    goodname: product.name,
    price: String(Math.trunc(totalAmount)),
    recvphone: '',
    memo: 'AURAN order',
    smsuse: 'n',
    reqaddr: '0',
    feedbackurl: process.env.PAYAPP_FEEDBACK_URL!,
    returnurl,
    checkretry: 'y',
    skip_cstpage: 'y',
    var1: order.id,
    var2: order.id,
    charset: 'utf-8',
  }

  const response = await fetch('https://api.payapp.kr/oapi/apiLoad.html', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
    body: new URLSearchParams(postdata).toString(),
    cache: 'no-store',
  })

  const text = await response.text()
  console.log('PayApp 응답 status:', response.status)
  console.log('PayApp 응답 text:', text)

  const parsed: Record<string, string> = {}
  const qs = new URLSearchParams((text || '').trim())
  qs.forEach((v, k) => { parsed[k] = v })
  console.log('PayApp parsed:', parsed)

  if (parsed.state !== '1' || !parsed.mul_no || !parsed.payurl) {
    return NextResponse.json({ ok: false, error: parsed.errorMessage || 'payapp_request_failed', raw: text }, { status: 502 })
  }

  return NextResponse.json({ payUrl: parsed.payurl, orderId: order.id })
}