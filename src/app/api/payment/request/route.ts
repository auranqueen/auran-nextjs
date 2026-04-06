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
  const { product_id, quantity, prescription_owner_id, payment_method, total_amount: bodyTotal, final_amount: bodyFinal } = body

  const { data: product } = await supabase
    .from('products')
    .select('id, name, retail_price')
    .eq('id', product_id)
    .single()

  if (!product) return NextResponse.json({ error: '제품 없음' }, { status: 404 })

  const price = product.retail_price ?? 0
  const lineTotal = price * quantity
  const totalAmount =
    payment_method === 'bank_transfer' && Number.isFinite(Number(bodyTotal)) && Number(bodyTotal) >= 0
      ? Math.floor(Number(bodyTotal))
      : lineTotal
  const finalAmount =
    payment_method === 'bank_transfer' && Number.isFinite(Number(bodyFinal)) && Number(bodyFinal) >= 0
      ? Math.floor(Number(bodyFinal))
      : totalAmount

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      customer_id: publicUser.id,
      total_amount: totalAmount,
      final_amount: finalAmount,
      status: payment_method === 'bank_transfer' ? '입금대기' : '주문확인',
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