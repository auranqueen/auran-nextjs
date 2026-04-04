import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const { product_id, quantity, prescription_owner_id } = await req.json()

  const { data: product } = await supabase
    .from('products')
    .select('id, name, retail_price')
    .eq('id', product_id)
    .single()

  if (!product) return NextResponse.json({ error: '제품 없음' }, { status: 404 })

  const price = product.retail_price ?? 0
  const totalAmount = price * quantity

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      customer_id: user.id,
      total_amount: totalAmount,
      final_amount: totalAmount,
      status: '주문확인',
      prescription_owner_id: prescription_owner_id || null,
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

  const returnurl = 'https://auran.kr/orders/complete'

  const postdata: Record<string, string> = {
    cmd: 'payrequest',
    userid: process.env.PAYAPP_USER_ID!,
    shopname: process.env.PAYAPP_SHOPNAME!,
    linkkey: process.env.PAYAPP_LINKKEY!,
    linkval: process.env.PAYAPP_LINKVAL!,
    goodname: product.name,
    price: String(Math.trunc(totalAmount)),
    recvphone: '01000000000',
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
  const parsed: Record<string, string> = {}
  new URLSearchParams((text || '').trim()).forEach((v, k) => { parsed[k] = v })

  if (parsed.state !== '1' || !parsed.mul_no || !parsed.payurl) {
    return NextResponse.json({ error: parsed.errorMessage || '결제 요청 실패' }, { status: 502 })
  }

  return NextResponse.json({ payUrl: parsed.payurl, orderId: order.id })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}