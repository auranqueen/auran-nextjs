import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
import { canUpgradeToTier, computeTierUpgradeCharge } from '@/lib/brandTierGrade'
import { formEncode, parsePayAppResponse, PAYAPP_API_URL } from '@/lib/payments/payappUtil'

const MIN_AMOUNT = 1000

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
  paidAmount: number,
) {
  const nowIso = new Date().toISOString()
  await svc.from('brand_owner_grades').upsert(
    {
      company_id: companyId,
      owner_id: ownerProfileId,
      grade: tierName,
      tier_package_id: tierPackageId,
      purchase_amount: paidAmount,
      payment_status: 'paid',
      grade_purchased_at: nowIso,
      care_enabled: true,
    },
    { onConflict: 'company_id,owner_id' },
  )
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
  const tierPackageId =
    typeof body?.tier_package_id === 'string' ? body.tier_package_id.trim() : ''
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
  if (userRow.origin_track !== 'A') {
    return NextResponse.json({ ok: false, error: 'track_a_only' }, { status: 403 })
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
    .select('id, company_id, tier_name, price, is_active')
    .eq('id', tierPackageId)
    .eq('is_active', true)
    .maybeSingle()

  if (pkgErr || !pkg?.id || !pkg.company_id) {
    return NextResponse.json({ ok: false, error: 'package_not_found' }, { status: 404 })
  }

  const companyId = String(pkg.company_id)
  const tierName = String(pkg.tier_name)
  const targetPrice = Math.trunc(Number(pkg.price))
  const currentPrice = await resolveOwnedTierPrice(supabase, companyId, ownerProfileId)

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

  const chargeAmount = computeTierUpgradeCharge(currentPrice, targetPrice)
  if (
    chargeAmount == null ||
    !Number.isFinite(chargeAmount) ||
    chargeAmount < MIN_AMOUNT ||
    !Number.isFinite(targetPrice) ||
    targetPrice < MIN_AMOUNT
  ) {
    return NextResponse.json({ ok: false, error: 'invalid_package_price' }, { status: 400 })
  }

  const svc = tryCreateServiceClient()
  if (!svc) {
    return NextResponse.json({ ok: false, error: 'service_client_unavailable' }, { status: 500 })
  }

  const { data: companyRow, error: companyErr } = await svc
    .from('brand_companies')
    .select('id, name, payapp_active, payapp_user_id, payapp_key, payapp_linkval')
    .eq('id', companyId)
    .maybeSingle()

  if (companyErr || !companyRow?.id) {
    return NextResponse.json({ ok: false, error: 'company_not_found' }, { status: 404 })
  }

  const payappActive = Boolean((companyRow as { payapp_active?: boolean | null }).payapp_active)
  const nowIso = new Date().toISOString()

  if (!payappActive) {
    const { data: intent, error: intentErr } = await svc
      .from('brand_payment_intents')
      .insert({
        company_id: companyId,
        owner_id: ownerProfileId,
        kind: 'tier',
        tier_package_id: tierPackageId,
        amount: chargeAmount,
        status: 'paid',
        is_demo: true,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select('id')
      .single()

    if (intentErr || !intent?.id) {
      return NextResponse.json(
        { ok: false, error: intentErr?.message || 'intent_create_failed' },
        { status: 500 },
      )
    }

    await activateOwnerGrade(svc, companyId, ownerProfileId, tierPackageId, tierName, targetPrice)

    await svc.from('notifications').insert({
      user_id: userRow.id,
      type: 'promo',
      title: `${tierName} 등급 체험 완료 💜`,
      body: `데모 모드로 ${tierName} 등급이 활성화됐어요`,
      icon: '💜',
      is_read: false,
    } as any)

    return NextResponse.json({
      ok: true,
      demo: true,
      intent_id: intent.id,
      grade: tierName,
    })
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
      amount: chargeAmount,
      status: 'pending',
      is_demo: false,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select('id')
    .single()

  if (intentErr || !intent?.id) {
    return NextResponse.json(
      { ok: false, error: intentErr?.message || 'intent_create_failed' },
      { status: 500 },
    )
  }

  const base = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
  const feedbackurl = `${base}/api/payments/brand-self/civasan/webhook`
  const returnurl = `${base}/dashboard/owner?brand_self_payment=done`

  const phone =
    userRow.phone ||
    user.user_metadata?.phone ||
    user.user_metadata?.kakao_account?.phone_number ||
    '01000000000'
  const recvphone = String(phone).replaceAll('-', '').trim() || '01000000000'

  const postdata: Record<string, string> = {
    cmd: 'payrequest',
    userid,
    shopname,
    linkkey,
    linkval,
    goodname: `${shopname} 등급(${tierName})`,
    price: String(chargeAmount),
    recvphone,
    memo: `brand_self_tier ${tierName}`,
    smsuse: 'n',
    reqaddr: '0',
    feedbackurl,
    returnurl,
    checkretry: 'y',
    skip_cstpage: 'y',
    var1: intent.id,
    var2: tierPackageId,
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
    await svc
      .from('brand_payment_intents')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', intent.id)
    return NextResponse.json(
      { ok: false, error: parsed.errorMessage || 'payapp_request_failed' },
      { status: 502 },
    )
  }

  await svc
    .from('brand_payment_intents')
    .update({
      provider_trade_id: parsed.mul_no,
      updated_at: new Date().toISOString(),
    })
    .eq('id', intent.id)

  return NextResponse.json({
    ok: true,
    demo: false,
    intent_id: intent.id,
    pay_url: parsed.payurl,
    mul_no: parsed.mul_no,
  })
}
