import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
  const targetId = typeof body?.target_id === 'string' ? body.target_id : null

  if (!Number.isFinite(amount) || amount < 1000) {
    return NextResponse.json({ ok: false, error: 'invalid_amount' }, { status: 400 })
  }

  // Load my profile (for user_id and recvphone)
  const { data: p, error: perr } = await supabase
    .from('users')
    .select('id,phone,name')
    .eq('auth_id', user.id)
    .single()

  if (perr || !p?.id) return NextResponse.json({ ok: false, error: 'user_row_missing' }, { status: 400 })

  const userid = mustEnv('PAYAPP_USER_ID')
  const shopname = mustEnv('PAYAPP_SHOPNAME')
  const linkkey = mustEnv('PAYAPP_LINKKEY')
  const linkval = mustEnv('PAYAPP_LINKVAL')
  const feedbackurl = mustEnv('PAYAPP_FEEDBACK_URL')
  const returnurl = process.env.PAYAPP_RETURN_URL || `${process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin}/wallet`

  const recvphone = (p.phone || '').replaceAll('-', '').trim()
  if (!recvphone) return NextResponse.json({ ok: false, error: 'missing_phone' }, { status: 400 })

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
    goodname: kind === 'charge' ? 'AURAN 충전' : `AURAN 결제(${kind})`,
    price: String(Math.trunc(amount)),
    recvphone,
    memo: `AURAN ${kind}`,
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

  return NextResponse.json({ ok: true, intent_id: intent.id, pay_url: parsed.payurl, mul_no: parsed.mul_no })
}

