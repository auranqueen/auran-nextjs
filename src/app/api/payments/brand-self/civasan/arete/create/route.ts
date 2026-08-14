import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
import { formEncode, parsePayAppResponse, PAYAPP_API_URL } from '@/lib/payments/payappUtil'

const MIN_AMOUNT = 1000

async function markAreteInvoicePaid(
  svc: NonNullable<ReturnType<typeof tryCreateServiceClient>>,
  invoiceId: string,
) {
  const nowIso = new Date().toISOString()
  await svc
    .from('brand_arete_invoices')
    .update({ status: 'paid', paid_at: nowIso })
    .eq('id', invoiceId)
    .eq('status', 'unpaid')
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, reason: 'not_logged_in' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const invoiceId = typeof body?.arete_invoice_id === 'string' ? body.arete_invoice_id.trim() : ''
  if (!invoiceId) {
    return NextResponse.json({ ok: false, error: 'arete_invoice_id_required' }, { status: 400 })
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('id, phone, role, origin_track')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!userRow?.id || userRow.role !== 'owner') {
    return NextResponse.json({ ok: false, error: 'owner_only' }, { status: 403 })
  }
  if (userRow.origin_track !== 'A') {
    return NextResponse.json({ ok: false, error: 'track_a_only' }, { status: 403 })
  }

  const { data: profile } = await supabase.from('profiles').select('id').eq('auth_id', user.id).maybeSingle()
  if (!profile?.id) return NextResponse.json({ ok: false, error: 'profile_missing' }, { status: 400 })

  const { data: invoice } = await supabase
    .from('brand_arete_invoices')
    .select('id, company_id, owner_id, amount, status, billing_month')
    .eq('id', invoiceId)
    .eq('owner_id', profile.id)
    .maybeSingle()

  if (!invoice?.id || !invoice.company_id) {
    return NextResponse.json({ ok: false, error: 'invoice_not_found' }, { status: 404 })
  }
  if (invoice.status === 'paid') {
    return NextResponse.json({ ok: false, error: 'already_paid' }, { status: 400 })
  }

  const amount = Math.trunc(Number(invoice.amount))
  if (!Number.isFinite(amount) || amount < MIN_AMOUNT) {
    return NextResponse.json({ ok: false, error: 'invalid_invoice_amount' }, { status: 400 })
  }

  const svc = tryCreateServiceClient()
  if (!svc) return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 500 })

  const { data: companyRow } = await svc
    .from('brand_companies')
    .select('id, name, payapp_active, payapp_user_id, payapp_key, payapp_linkval')
    .eq('id', invoice.company_id)
    .maybeSingle()

  if (!companyRow?.id) return NextResponse.json({ ok: false, error: 'company_not_found' }, { status: 404 })

  const payappActive = Boolean((companyRow as { payapp_active?: boolean }).payapp_active)
  const nowIso = new Date().toISOString()
  const monthLabel = String(invoice.billing_month).slice(0, 7)

  if (!payappActive) {
    const { data: intent, error: intentErr } = await svc
      .from('brand_payment_intents')
      .insert({
        company_id: invoice.company_id,
        owner_id: profile.id,
        kind: 'arete',
        arete_invoice_id: invoiceId,
        tier_package_id: null,
        amount,
        status: 'paid',
        is_demo: true,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select('id')
      .single()

    if (intentErr || !intent?.id) {
      return NextResponse.json({ ok: false, error: intentErr?.message || 'intent_failed' }, { status: 500 })
    }

    await markAreteInvoicePaid(svc, invoiceId)
    return NextResponse.json({ ok: true, demo: true, intent_id: intent.id })
  }

  const userid = String((companyRow as { payapp_user_id?: string | null }).payapp_user_id || '').trim()
  const linkkey = String((companyRow as { payapp_key?: string | null }).payapp_key || '').trim()
  const linkval = String((companyRow as { payapp_linkval?: string | null }).payapp_linkval || '').trim()
  const shopname = String((companyRow as { name?: string | null }).name || '오렌').trim()

  if (!userid || !linkkey || !linkval) {
    return NextResponse.json({ ok: false, error: 'company_payapp_credentials_missing' }, { status: 500 })
  }

  const { data: intent, error: intentErr } = await svc
    .from('brand_payment_intents')
    .insert({
      company_id: invoice.company_id,
      owner_id: profile.id,
      kind: 'arete',
      arete_invoice_id: invoiceId,
      tier_package_id: null,
      amount,
      status: 'pending',
      is_demo: false,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select('id')
    .single()

  if (intentErr || !intent?.id) {
    return NextResponse.json({ ok: false, error: intentErr?.message || 'intent_failed' }, { status: 500 })
  }

  const base = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
  const phone = userRow.phone || user.user_metadata?.phone || '01000000000'
  const recvphone = String(phone).replaceAll('-', '').trim() || '01000000000'

  const postdata: Record<string, string> = {
    cmd: 'payrequest',
    userid,
    shopname,
    linkkey,
    linkval,
    goodname: `${shopname} ${monthLabel} 아레테 정기결제`,
    price: String(amount),
    recvphone,
    memo: `brand_self_arete ${monthLabel}`,
    smsuse: 'n',
    reqaddr: '0',
    feedbackurl: `${base}/api/payments/brand-self/civasan/webhook`,
    returnurl: `${base}/dashboard/owner/brand-orders?arete_paid=1`,
    checkretry: 'y',
    skip_cstpage: 'y',
    var1: intent.id,
    var2: invoiceId,
    charset: 'utf-8',
  }

  const res = await fetch(PAYAPP_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
    body: formEncode(postdata),
    cache: 'no-store',
  })

  const parsed = parsePayAppResponse(await res.text())
  if (parsed.state !== '1' || !parsed.mul_no || !parsed.payurl) {
    await svc.from('brand_payment_intents').update({ status: 'failed', updated_at: nowIso }).eq('id', intent.id)
    return NextResponse.json({ ok: false, error: parsed.errorMessage || 'payapp_failed' }, { status: 502 })
  }

  await svc
    .from('brand_payment_intents')
    .update({ provider_trade_id: parsed.mul_no, updated_at: nowIso })
    .eq('id', intent.id)

  return NextResponse.json({
    ok: true,
    demo: false,
    intent_id: intent.id,
    pay_url: parsed.payurl,
    mul_no: parsed.mul_no,
  })
}
