import { NextRequest, NextResponse } from 'next/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
type BrandPaymentIntentRow = {
  id: string
  brand_id: string | null
  company_id: string | null
  owner_id: string
  tier_package_id: string | null
  tier_order_id: string | null
  invoice_id: string | null
  kind: string | null
  amount: number
  status: string
  provider_trade_id: string | null
  is_demo: boolean
}
type ServiceClient = NonNullable<ReturnType<typeof tryCreateServiceClient>>
async function readRawBody(req: NextRequest) {
  const buf = await req.arrayBuffer()
  return Buffer.from(buf).toString('utf8')
}
function parseForm(body: string): Record<string, string> {
  const out: Record<string, string> = {}
  new URLSearchParams(body).forEach((v, k) => {
    out[k] = v
  })
  return out
}
export async function POST(req: NextRequest) {
  const raw = await readRawBody(req)
  const data = parseForm(raw)
  const mulNo = data.mul_no || null
  const payState = data.pay_state || ''
  const intentId = data.var1 || null
  if (!mulNo && !intentId) {
    return new NextResponse('SUCCESS', { status: 200 })
  }
  const svc = tryCreateServiceClient()
  if (!svc) {
    return new NextResponse('SUCCESS', { status: 200 })
  }
  let intent: BrandPaymentIntentRow | null = null
  if (intentId) {
    const { data: found } = await svc
      .from('brand_payment_intents')
      .select('id, brand_id, company_id, owner_id, tier_package_id, tier_order_id, invoice_id, kind, amount, status, provider_trade_id, is_demo')
      .eq('id', intentId)
      .maybeSingle()
    intent = (found as BrandPaymentIntentRow | null) ?? null
  } else if (mulNo) {
    const { data: found } = await svc
      .from('brand_payment_intents')
      .select('id, brand_id, company_id, owner_id, tier_package_id, tier_order_id, invoice_id, kind, amount, status, provider_trade_id, is_demo')
      .eq('provider_trade_id', mulNo)
      .maybeSingle()
    intent = (found as BrandPaymentIntentRow | null) ?? null
  }
  if (!intent || !intent.company_id) {
    return new NextResponse('SUCCESS', { status: 200 })
  }
  const companyId = intent.company_id
  const { data: companyRow } = await svc
    .from('brand_companies')
    .select('payapp_user_id, payapp_key, payapp_linkval')
    .eq('id', companyId)
    .maybeSingle()
  const userid = String(companyRow?.payapp_user_id || '').trim()
  const linkkey = String(companyRow?.payapp_key || '').trim()
  const linkval = String(companyRow?.payapp_linkval || '').trim()
  const checkUser = data.userid === userid
  const checkKey = decodeURIComponent(data.linkkey?.trim() ?? '') === linkkey
  const checkVal = decodeURIComponent(data.linkval?.trim() ?? '') === linkval
  if (!checkUser || !checkKey || !checkVal) {
    return new NextResponse('SUCCESS', { status: 200 })
  }
  if (intent.status === 'paid') {
    return new NextResponse('SUCCESS', { status: 200 })
  }
  const price = Number(data.price)
  if (!Number.isFinite(price) || price !== Number(intent.amount)) {
    return new NextResponse('SUCCESS', { status: 200 })
  }
  const payStateStr = String(payState)
  if (payStateStr === '10') {
    return new NextResponse('SUCCESS', { status: 200 })
  }
  const isPaid = payStateStr === '4'
  const isCancelled = payStateStr === '9' || payStateStr === '64'
  const nowIso = new Date().toISOString()
  if (isCancelled) {
    await svc.from('brand_payment_intents').update({ status: 'cancelled', updated_at: nowIso }).eq('id', intent.id)
    if (intent.tier_order_id) {
      await svc.from('brand_tier_orders').update({ status: 'cancelled' }).eq('id', intent.tier_order_id)
    }
    return new NextResponse('SUCCESS', { status: 200 })
  }
  if (!isPaid) {
    return new NextResponse('SUCCESS', { status: 200 })
  }
  if (intent.kind === 'invoice' && intent.invoice_id) {
    await svc
      .from('brand_payment_intents')
      .update({ status: 'paid', provider_trade_id: mulNo || intent.provider_trade_id, updated_at: nowIso })
      .eq('id', intent.id)
    await svc
      .from('brand_billing_invoices')
      .update({ status: 'paid', paid_at: nowIso })
      .eq('id', intent.invoice_id)
      .eq('status', 'unpaid')
    return new NextResponse('SUCCESS', { status: 200 })
  }
  if (intent.kind === 'tier' && intent.tier_order_id) {
    const { data: order } = await svc
      .from('brand_tier_orders')
      .select('id, company_id, tier_package_id, amount, status')
      .eq('id', intent.tier_order_id)
      .maybeSingle()
    if (!order?.id || String(order.company_id) !== companyId || Number(order.amount) !== Number(intent.amount)) {
      return new NextResponse('SUCCESS', { status: 200 })
    }
    if (order.status === 'paid') {
      return new NextResponse('SUCCESS', { status: 200 })
    }
    const { data: pkg } = await svc
      .from('brand_tier_packages')
      .select('id, tier_name')
      .eq('id', order.tier_package_id)
      .maybeSingle()
    if (!pkg?.id) {
      return new NextResponse('SUCCESS', { status: 200 })
    }
    await svc
      .from('brand_payment_intents')
      .update({ status: 'paid', provider_trade_id: mulNo || intent.provider_trade_id, updated_at: nowIso })
      .eq('id', intent.id)
    await svc.from('brand_tier_orders').update({ status: 'paid' }).eq('id', order.id)
    const tierName = String(pkg.tier_name)
    await svc.from('brand_owner_grades').upsert(
      {
        company_id: companyId,
        owner_id: intent.owner_id,
        grade: tierName,
        tier_package_id: order.tier_package_id,
        purchase_amount: Number(order.amount),
        payment_status: 'paid',
        grade_purchased_at: nowIso,
        care_enabled: true,
      },
      { onConflict: 'company_id,owner_id' },
    )
    const { data: ownerProf } = await svc.from('profiles').select('auth_id').eq('id', intent.owner_id).maybeSingle()
    if (ownerProf?.auth_id) {
      const { data: ownerUser } = await svc.from('users').select('id').eq('auth_id', ownerProf.auth_id).maybeSingle()
      if (ownerUser?.id) {
        await svc.from('notifications').insert({
          user_id: ownerUser.id,
          type: 'promo',
          title: `${tierName} 등급 구매 완료 💜`,
          body: `${tierName} 등급이 활성화됐어요. 브랜드사 확인 후 발송될 예정이에요`,
          icon: '💜',
          is_read: false,
        } as any)
      }
    }
    return new NextResponse('SUCCESS', { status: 200 })
  }
  return new NextResponse('SUCCESS', { status: 200 })
}
