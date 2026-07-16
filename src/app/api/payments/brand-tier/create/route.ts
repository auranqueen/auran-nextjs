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

async function resolveOwnedTierPrice(
  supabase: ReturnType<typeof createClient>,
  brandId: string,
  ownerProfileId: string,
): Promise<number | null> {
  const { data: existingGrade } = await supabase
    .from('brand_owner_grades')
    .select('tier_package_id, payment_status')
    .eq('brand_id', brandId)
    .eq('owner_id', ownerProfileId)
    .maybeSingle()

  if (!existingGrade || existingGrade.payment_status !== 'paid') return null

  const ownedPackageId = existingGrade.tier_package_id
    ? String(existingGrade.tier_package_id)
    : null
  if (!ownedPackageId) return null

  const { data: ownedPkg } = await supabase
    .from('brand_tier_packages')
    .select('price, brand_id')
    .eq('id', ownedPackageId)
    .maybeSingle()

  if (!ownedPkg?.price || String(ownedPkg.brand_id) !== brandId) return null

  const price = Math.trunc(Number(ownedPkg.price))
  return price > 0 ? price : null
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, reason: 'not_logged_in' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const tierPackageId = typeof body?.tier_package_id === 'string' ? body.tier_package_id.trim() : ''
  if (!tierPackageId) {
    return NextResponse.json({ ok: false, error: 'tier_package_id_required' }, { status: 400 })
  }

  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('id, phone, name, role, origin_track')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (userErr || !userRow?.id) {
    return NextResponse.json({ ok: false, error: 'user_row_missing' }, { status: 400 })
  }
  if (userRow.role !== 'owner') {
    return NextResponse.json({ ok: false, error: 'owner_only' }, { status: 403 })
  }
  if (userRow.origin_track !== 'B') {
    return NextResponse.json({ ok: false, error: 'track_b_only' }, { status: 403 })
  }

  const { data: profileRow, error: profErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (profErr || !profileRow?.id) {
    return NextResponse.json({ ok: false, error: 'profile_row_missing' }, { status: 400 })
  }
  const ownerProfileId = String(profileRow.id)

  const { data: pkg, error: pkgErr } = await supabase
    .from('brand_tier_packages')
    .select(`
      id, brand_id, tier_name, price, is_active,
      brands!inner ( id, name, distribution_type )
    `)
    .eq('id', tierPackageId)
    .eq('is_active', true)
    .maybeSingle()

  if (pkgErr || !pkg?.id) {
    return NextResponse.json({ ok: false, error: 'package_not_found' }, { status: 404 })
  }

  const brand = (pkg as any).brands
  if (String(brand?.distribution_type) !== 'tier_contract') {
    return NextResponse.json({ ok: false, error: 'brand_not_tier_contract' }, { status: 403 })
  }

  const brandId = String(pkg.brand_id)
  const targetTier = String(pkg.tier_name)
  const targetPrice = Math.trunc(Number(pkg.price))

  const currentPrice = await resolveOwnedTierPrice(supabase, brandId, ownerProfileId)

  if (!canUpgradeToTier(currentPrice, targetPrice)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'grade_downgrade_or_same_not_allowed',
        current_price: currentPrice,
        target_price: targetPrice,
      },
      { status: 400 },
    )
  }

  const amount = targetPrice
  if (!Number.isFinite(amount) || amount < MIN_AMOUNT) {
    return NextResponse.json({ ok: false, error: 'invalid_package_price' }, { status: 400 })
  }

  const targetPayload = {
    tier_package_id: tierPackageId,
    brand_id: brandId,
    owner_profile_id: ownerProfileId,
    tier_name: targetTier,
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
      amount,
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
    goodname: `AURAN 브랜드 등급(${targetTier})`,
    price: String(amount),
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
