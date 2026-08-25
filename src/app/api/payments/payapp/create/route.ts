import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

const PAYAPP_API_URL = 'https://api.payapp.kr/oapi/apiLoad.html'

function mustEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

function formEncode(input: Record<string, string>) {
  return new URLSearchParams(input).toString()
}

function parsePayAppResponse(text: string): Record<string, string> {
  // PayApp returns querystring-like body: state=1&errorMessage=&mul_no=...&payurl=...
  const out: Record<string, string> = {}
  const trimmed = (text || '').trim()
  const qs = new URLSearchParams(trimmed)
  // Avoid downlevelIteration issues in Next build
  qs.forEach((v, k) => {
    out[k] = v
  })
  return out
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, reason: 'not_logged_in' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const kind = typeof body?.kind === 'string' ? body.kind : 'charge'
  const amount = Number(body?.amount)
  let targetId = typeof body?.target_id === 'string' ? body.target_id : null
  const scenePostId =
    typeof body?.scene_post_id === 'string' && body.scene_post_id.trim()
      ? body.scene_post_id.trim()
      : null

  // 오렌씬 CTA: booking은 target_id 말미에 scene_post_id를 붙여 웹훅→purchases 저장에 사용
  if (scenePostId && kind === 'booking') {
    targetId = targetId ? `${targetId}|${scenePostId}` : scenePostId
  }

  if (!Number.isFinite(amount) || amount < 1000) {
    return NextResponse.json({ ok: false, error: 'invalid_amount' }, { status: 400 })
  }

  async function attachScenePostToBrandOrders() {
    if (!scenePostId || kind !== 'brand_product_order' || !targetId) return
    const svc = tryCreateServiceClient()
    if (!svc) return
    await svc
      .from('brand_product_orders')
      .update({ source_scene_post_id: scenePostId })
      .eq('checkout_batch_id', targetId)
  }

  // Load my profile (for user_id and recvphone)
  const { data: p, error: perr } = await supabase
    .from('users')
    .select('id,phone,name')
    .eq('auth_id', user.id)
    .single()

  if (perr || !p?.id) return NextResponse.json({ ok: false, error: 'user_row_missing' }, { status: 400 })

  const base = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
  const returnurl = kind === 'order'
    ? `${base}/api/payments/payapp/return?order_id=${targetId}`
    : kind === 'membership_gift'
    ? `${base}/membership/gift/complete?gift_id=${targetId}`
    : kind === 'booking'
    ? `${base}/api/payments/payapp/return?booking=true&salon_id=${(targetId || '').split('|')[0]}`
    : kind === 'hq_stock_order'
    ? `${base}/dashboard/owner/hq-stock-orders?paid=1`
    : `${base}/api/payments/payapp/return`
  const sandbox = process.env.PAYAPP_SANDBOX === 'true' || process.env.PAYAPP_TEST_MODE === 'true'

  // 샌드박스: 실결제 없이 결제창 대신 바로 return URL로 이동 (개발/테스트용)
  if (sandbox) {
    const { data: intent, error: ierr } = await supabase
      .from('payment_intents')
      .insert({
        provider: 'payapp',
        kind,
        status: 'pending',
        user_id: p.id,
        target_id: targetId,
        amount: Math.trunc(amount),
        currency: 'KRW',
      })
      .select('id')
      .single()
    if (ierr || !intent?.id) return NextResponse.json({ ok: false, error: ierr?.message || 'intent_create_failed' }, { status: 500 })
    await attachScenePostToBrandOrders()
    return NextResponse.json({
      ok: true,
      intent_id: intent.id,
      pay_url: returnurl,
      mul_no: `sandbox-${intent.id}`,
      _sandbox: true,
    })
  }

  const userid = mustEnv('PAYAPP_USER_ID')
  const shopname = mustEnv('PAYAPP_SHOPNAME')
  const linkkey = mustEnv('PAYAPP_LINKKEY')
  const linkval = mustEnv('PAYAPP_LINKVAL')
  const feedbackurl = mustEnv('PAYAPP_FEEDBACK_URL')

  const phone =
    p?.phone ||
    user?.user_metadata?.phone ||
    user?.user_metadata?.kakao_account?.phone_number ||
    '01000000000'
  const recvphone = String(phone).replaceAll('-', '').trim() || '01000000000'

  // Create local intent first (pending)
  const { data: intent, error: ierr } = await supabase
    .from('payment_intents')
    .insert({
      provider: 'payapp',
      kind,
      status: 'pending',
      user_id: p.id,
      target_id: targetId,
      amount: Math.trunc(amount),
      currency: 'KRW',
    })
    .select('id')
    .single()

  if (ierr || !intent?.id) return NextResponse.json({ ok: false, error: ierr?.message || 'intent_create_failed' }, { status: 500 })

  // var1 carries our payment_intents.id for webhook correlation
  const postdata: Record<string, string> = {
    cmd: 'payrequest',
    userid,
    shopname,
    linkkey,
    linkval,
    goodname: kind === 'charge' ? 'AURAN 홀리스틱 멤버십'
      : kind === 'booking' ? `AURAN 시술 예약 결제`
      : `AURAN 결제(${kind})`,
    price: String(Math.trunc(amount)),
    recvphone,
    memo: `AURAN ${kind}`,
    // 공식 파라미터명은 smsuse (소문자 n). sms_flag/kakao_flag 는 무시되어 결제요청 알림이 나갈 수 있음.
    // https://payapp.kr/dev_center/dev_center01.html — 결제요청 SMS/알림톡(요청 단계) 발송 안 함.
    smsuse: 'n',
    reqaddr: '0',
    feedbackurl,
    returnurl,
    checkretry: 'y',
    skip_cstpage: 'y',
    var1: intent.id,
    var2: targetId || '',
    charset: 'utf-8',
  }

  const res = await fetch(PAYAPP_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
    body: formEncode(postdata),
    cache: 'no-store',
  })

  const text = await res.text()
  const parsed = parsePayAppResponse(text)

  if (parsed.state !== '1' || !parsed.mul_no || !parsed.payurl) {
    await supabase
      .from('payment_intents')
      .update({ status: 'failed', failed_at: new Date().toISOString() })
      .eq('id', intent.id)
    return NextResponse.json({ ok: false, error: parsed.errorMessage || 'payapp_request_failed', raw: text }, { status: 502 })
  }

  await supabase
    .from('payment_intents')
    .update({
      provider_trade_id: parsed.mul_no,
      pay_url: parsed.payurl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', intent.id)

  await attachScenePostToBrandOrders()

  return NextResponse.json({ ok: true, intent_id: intent.id, pay_url: parsed.payurl, mul_no: parsed.mul_no })
}

