import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
import { canUpgradeToTier } from '@/lib/brandTierGrade'
import { formEncode, parsePayAppResponse, PAYAPP_API_URL } from '@/lib/payments/payappUtil'
const MIN_AMOUNT = 1000
type CartItemInput = { product_id?: string; qty?: number }
async function resolveOwnedTierPrice(
  client: ReturnType<typeof createClient>,
  companyId: string,
  ownerProfileId: string,
): Promise<number | null> {
  const { data: existingGrade } = await client
    .from('brand_owner_grades')
    .select('tier_package_id, payment_status')
    .eq('company_id', companyId)
    .eq('owner_id', ownerProfileId)
    .eq('origin_track', 'A')
    .maybeSingle()
  if (!existingGrade || existingGrade.payment_status !== 'paid') return null
  const ownedPackageId = existingGrade.tier_package_id ? String(existingGrade.tier_package_id) : null
  if (!ownedPackageId) return null
  const { data: ownedPkg } = await client
    .from('brand_tier_packages')
    .select('price, company_id')
    .eq('id', ownedPackageId)
    .maybeSingle()
  if (!ownedPkg?.price || String(ownedPkg.company_id) !== companyId) return null
  const price = Math.trunc(Number(ownedPkg.price))
  return price > 0 ? price : null
}
async function activateOwnerGrade(
  svc: NonNullable<ReturnType<typeof tryCreateServiceClient>>,
  companyId: string,
  ownerProfileId: string,
  tierPackageId: string,
  tierName: string,
  purchaseAmount: number,
) {
  const nowIso = new Date().toISOString()
  await svc.from('brand_owner_grades').upsert(
    {
      company_id: companyId,
      owner_id: ownerProfileId,
      origin_track: 'A',
      grade: tierName,
      tier_package_id: tierPackageId,
      purchase_amount: purchaseAmount,
      payment_status: 'paid',
      grade_purchased_at: nowIso,
      care_enabled: true,
    },
    { onConflict: 'company_id,owner_id,origin_track' },
  )
}
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, reason: 'not_logged_in' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const tierPackageId = typeof body?.tier_package_id === 'string' ? body.tier_package_id.trim() : ''
  const itemsInput: CartItemInput[] = Array.isArray(body?.items) ? body.items : []
  if (!tierPackageId) {
    return NextResponse.json({ ok: false, error: 'tier_package_id_required' }, { status: 400 })
  }
  if (itemsInput.length === 0) {
    return NextResponse.json({ ok: false, error: 'cart_empty' }, { status: 400 })
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
  const { data: profileRow } = await supabase.from('profiles').select('id').eq('auth_id', user.id).maybeSingle()
  if (!profileRow?.id) return NextResponse.json({ ok: false, error: 'profile_missing' }, { status: 400 })
  const ownerProfileId = String(profileRow.id)
  const { data: pkg } = await supabase
    .from('brand_tier_packages')
    .select('id, company_id, tier_name, price, is_active')
    .eq('id', tierPackageId)
    .eq('is_active', true)
    .maybeSingle()
  if (!pkg?.id || !pkg.company_id) {
    return NextResponse.json({ ok: false, error: 'package_not_found' }, { status: 404 })
  }
  const companyId = String(pkg.company_id)
  const minAmount = Math.trunc(Number(pkg.price))
  const currentPrice = await resolveOwnedTierPrice(supabase, companyId, ownerProfileId)
  if (!canUpgradeToTier(currentPrice, minAmount)) {
    return NextResponse.json({ ok: false, error: 'grade_downgrade_or_same_not_allowed' }, { status: 400 })
  }
  const { data: companyBrandRows } = await supabase.from('brands').select('id').eq('company_id', companyId)
  const companyBrandIds = (companyBrandRows || []).map((b: { id: string }) => b.id)
  const productIds = itemsInput
    .map((i) => (typeof i.product_id === 'string' ? i.product_id.trim() : ''))
    .filter(Boolean)
  const { data: productRows } = await supabase
    .from('brand_products')
    .select('id, brand_id, name, supply_price, status')
    .in('id', productIds.length ? productIds : ['00000000-0000-0000-0000-000000000000'])
  const productMap: Record<string, { brand_id: string; name: string; supply_price: number }> = {}
  for (const p of (productRows || []) as any[]) {
    if (p.status !== 'active') continue
    if (!companyBrandIds.includes(String(p.brand_id))) continue
    productMap[String(p.id)] = { brand_id: String(p.brand_id), name: String(p.name), supply_price: Math.trunc(Number(p.supply_price) || 0) }
  }
  const lineItems: Array<{ product_id: string; item_name: string; unit_price: number; qty: number; line_amount: number }> = []
  let total = 0
  for (const raw of itemsInput) {
    const pid = typeof raw.product_id === 'string' ? raw.product_id.trim() : ''
    const qty = Math.trunc(Number(raw.qty))
    if (!pid || !productMap[pid] || !Number.isFinite(qty) || qty < 1) continue
    const info = productMap[pid]
    const lineAmount = info.supply_price * qty
    lineItems.push({ product_id: pid, item_name: info.name, unit_price: info.supply_price, qty, line_amount: lineAmount })
    total += lineAmount
  }
  if (lineItems.length === 0) {
    return NextResponse.json({ ok: false, error: 'no_valid_items' }, { status: 400 })
  }
  if (total < minAmount || total < MIN_AMOUNT) {
    return NextResponse.json({ ok: false, error: 'below_minimum_amount', min_amount: minAmount, cart_total: total }, { status: 400 })
  }
  const svc = tryCreateServiceClient()
  if (!svc) return NextResponse.json({ ok: false, error: 'service_client_unavailable' }, { status: 500 })
  const { data: companyRow } = await svc
    .from('brand_companies')
    .select('id, name, payapp_active, payapp_user_id, payapp_key, payapp_linkval')
    .eq('id', companyId)
    .maybeSingle()
  if (!companyRow?.id) return NextResponse.json({ ok: false, error: 'company_not_found' }, { status: 404 })
  const nowIso = new Date().toISOString()
  const { data: order, error: orderErr } = await svc
    .from('brand_tier_orders')
    .insert({
      company_id: companyId,
      owner_id: ownerProfileId,
      tier_package_id: tierPackageId,
      amount: total,
      status: 'pending',
      created_at: nowIso,
    })
    .select('id')
    .single()
  if (orderErr || !order?.id) {
    return NextResponse.json({ ok: false, error: orderErr?.message || 'order_create_failed' }, { status: 500 })
  }
  const { error: itemsErr } = await svc.from('brand_tier_order_items').insert(
    lineItems.map((li) => ({
      order_id: order.id,
      product_id: li.product_id,
      item_name: li.item_name,
      unit_price: li.unit_price,
      qty: li.qty,
      line_amount: li.line_amount,
    })),
  )
  if (itemsErr) {
    return NextResponse.json({ ok: false, error: itemsErr.message }, { status: 500 })
  }
  const payappActive = Boolean((companyRow as { payapp_active?: boolean }).payapp_active)
  if (!payappActive) {
    const { data: intent, error: intentErr } = await svc
      .from('brand_payment_intents')
      .insert({
        company_id: companyId,
        owner_id: ownerProfileId,
        kind: 'tier',
        tier_package_id: tierPackageId,
        tier_order_id: order.id,
        amount: total,
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
    await svc.from('brand_tier_orders').update({ status: 'paid' }).eq('id', order.id)
    await activateOwnerGrade(svc, companyId, ownerProfileId, tierPackageId, String(pkg.tier_name), total)
    await svc.from('notifications').insert({
      user_id: userRow.id,
      type: 'promo',
      title: `${pkg.tier_name} 등급 체험 완료 💜`,
      body: `데모 모드로 ${pkg.tier_name} 등급이 활성화됐어요`,
      icon: '💜',
      is_read: false,
    } as any)
    return NextResponse.json({ ok: true, demo: true, order_id: order.id })
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
      company_id: companyId,
      owner_id: ownerProfileId,
      kind: 'tier',
      tier_package_id: tierPackageId,
      tier_order_id: order.id,
      amount: total,
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
    goodname: `${shopname} ${pkg.tier_name} 등급구매`,
    price: String(total),
    recvphone,
    memo: `brand_self_tier_cart ${pkg.tier_name}`,
    smsuse: 'n',
    reqaddr: '0',
    feedbackurl: `${base}/api/payments/brand-self/civasan/webhook`,
    returnurl: `${base}/dashboard/owner?brand_self_payment=done`,
    checkretry: 'y',
    skip_cstpage: 'y',
    var1: intent.id,
    var2: order.id,
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
    await svc.from('brand_payment_intents').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', intent.id)
    return NextResponse.json({ ok: false, error: parsed.errorMessage || 'payapp_failed' }, { status: 502 })
  }
  await svc.from('brand_payment_intents').update({ provider_trade_id: parsed.mul_no, updated_at: new Date().toISOString() }).eq('id', intent.id)
  return NextResponse.json({ ok: true, demo: false, order_id: order.id, pay_url: parsed.payurl, mul_no: parsed.mul_no })
}
