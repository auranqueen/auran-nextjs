import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canUpgradeToTier } from '@/lib/brandTierGrade'
const PAYAPP_API_URL = 'https://api.payapp.kr/oapi/apiLoad.html'
const MIN_AMOUNT = 1000
function mustEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}
function formEncode(input: Record<string, string>) {
  return new URLSearchParams(input).toString()
}
function parsePayAppResponse(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  new URLSearchParams((text || '').trim()).forEach((v, k) => {
    out[k] = v
  })
  return out
}
type CartItemInput = { product_id?: string; qty?: number }
async function resolveOwnedTierPrice(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  ownerProfileId: string,
): Promise<number | null> {
  const { data: existingGrade } = await supabase
    .from('brand_owner_grades')
    .select('tier_package_id, payment_status')
    .eq('company_id', companyId)
    .eq('owner_id', ownerProfileId)
    .eq('origin_track', 'B')
    .maybeSingle()
  if (!existingGrade || existingGrade.payment_status !== 'paid') return null
  const ownedPackageId = existingGrade.tier_package_id ? String(existingGrade.tier_package_id) : null
  if (!ownedPackageId) return null
  const { data: ownedPkg } = await supabase
    .from('brand_tier_packages')
    .select('price, company_id')
    .eq('id', ownedPackageId)
    .maybeSingle()
  if (!ownedPkg?.price || String(ownedPkg.company_id) !== companyId) return null
  const price = Math.trunc(Number(ownedPkg.price))
  return price > 0 ? price : null
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
  if (userRow.origin_track !== 'B') {
    return NextResponse.json({ ok: false, error: 'track_b_only' }, { status: 403 })
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
  const { data: tierContractBrand } = await supabase
    .from('brands')
    .select('id')
    .eq('company_id', companyId)
    .eq('distribution_type', 'tier_contract')
    .limit(1)
    .maybeSingle()
  if (!tierContractBrand?.id) {
    return NextResponse.json({ ok: false, error: 'company_not_tier_contract' }, { status: 403 })
  }
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
    .select('id, brand_id, name, supply_price, is_tier_catalog, status')
    .in('id', productIds.length ? productIds : ['00000000-0000-0000-0000-000000000000'])
  const productMap: Record<string, { name: string; supply_price: number }> = {}
  for (const p of (productRows || []) as any[]) {
    if (!p.is_tier_catalog || p.status !== 'active') continue
    if (!companyBrandIds.includes(String(p.brand_id))) continue
    productMap[String(p.id)] = { name: String(p.name), supply_price: Math.trunc(Number(p.supply_price) || 0) }
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
  const targetPayload = {
    tier_package_id: tierPackageId,
    company_id: companyId,
    owner_profile_id: ownerProfileId,
    tier_name: String(pkg.tier_name),
    items: lineItems,
  }
  const targetId = JSON.stringify(targetPayload)
  const kind = 'brand_tier_purchase'
  const base = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
  const returnurl = `${base}/dashboard/owner?badge_payment=done`
  const { data: intent, error: ierr } = await supabase
    .from('payment_intents')
    .insert({
      provider: 'payapp',
      kind,
      status: 'pending',
      user_id: userRow.id,
      target_id: targetId,
      amount: total,
      currency: 'KRW',
    })
    .select('id')
    .single()
  if (ierr || !intent?.id) {
    return NextResponse.json({ ok: false, error: ierr?.message || 'intent_create_failed' }, { status: 500 })
  }
  const phone =
    userRow.phone ||
    user.user_metadata?.phone ||
    user.user_metadata?.kakao_account?.phone_number ||
    '01000000000'
  const recvphone = String(phone).replaceAll('-', '').trim() || '01000000000'
  const postdata: Record<string, string> = {
    cmd: 'payrequest',
    userid: mustEnv('PAYAPP_USER_ID'),
    shopname: mustEnv('PAYAPP_SHOPNAME'),
    linkkey: mustEnv('PAYAPP_LINKKEY'),
    linkval: mustEnv('PAYAPP_LINKVAL'),
    goodname: `AURAN 브랜드 등급(${pkg.tier_name})`,
    price: String(total),
    recvphone,
    memo: `AURAN ${kind}`,
    smsuse: 'n',
    reqaddr: '0',
    feedbackurl: mustEnv('PAYAPP_FEEDBACK_URL'),
    returnurl,
    checkretry: 'y',
    skip_cstpage: 'y',
    var1: intent.id,
    var2: targetId,
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
    await supabase
      .from('payment_intents')
      .update({ status: 'failed', failed_at: new Date().toISOString() })
      .eq('id', intent.id)
    return NextResponse.json({ ok: false, error: parsed.errorMessage || 'payapp_request_failed' }, { status: 502 })
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
