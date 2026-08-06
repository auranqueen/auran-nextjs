import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'
import { resolveHqCampaignEffects, type HqForcedCampaign } from '@/lib/brand/hqForcedCampaignPromos'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized', message: '로그인이 필요합니다' }, { status: 401 })
  }

  const svc = tryCreateAdminClient()
  if (!svc) {
    return NextResponse.json({ ok: false, error: 'service_unavailable', message: '서버 오류' }, { status: 500 })
  }

  const { data: userRow } = await svc
    .from('users')
    .select('id, origin_track, name, salon_name')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!userRow?.id || userRow.origin_track !== 'B') {
    return NextResponse.json({ ok: false, error: 'track_b_only', message: '트랙B 원장만 이용할 수 있어요' }, { status: 403 })
  }

  const { data: profile } = await supabase.from('profiles').select('id, full_name, owner_store_name').eq('auth_id', user.id).maybeSingle()
  if (!profile?.id) {
    return NextResponse.json({ ok: false, error: 'profile_missing', message: '프로필이 없습니다' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const brandId = typeof body?.brand_id === 'string' ? body.brand_id.trim() : ''
  const items = Array.isArray(body?.items) ? body.items : null
  const subtotal = Math.trunc(Number(body?.subtotal) || 0)
  const finalAmount = Math.trunc(Number(body?.final_amount) || 0)
  const ownerName =
    typeof body?.owner_name === 'string' && body.owner_name.trim()
      ? body.owner_name.trim()
      : String(profile.full_name || userRow.name || '원장님')
  const salonName =
    typeof body?.salon_name === 'string' && body.salon_name.trim()
      ? body.salon_name.trim()
      : String(profile.owner_store_name || userRow.salon_name || '')

  if (!brandId || !items || items.length === 0 || finalAmount < 1000) {
    return NextResponse.json({ ok: false, error: 'invalid_request', message: '잘못된 요청입니다' }, { status: 400 })
  }

  // 서버 재검증: 활성 캠페인 조회 → 할인 합계
  const { data: brandRow } = await svc.from('brands').select('company_id').eq('id', brandId).maybeSingle()
  const companyId = brandRow?.company_id ? String(brandRow.company_id) : null
  let serverDiscountTotal = 0
  if (companyId) {
    const { data: campaignRows } = await svc
      .from('hq_forced_campaigns')
      .select('id, company_id, target_product_ids, start_at, end_at')
      .eq('company_id', companyId)
      .is('owner_id', null)
      .eq('is_active', true)
    const campaignIds = (campaignRows || []).map((r: { id: string }) => r.id)
    const tiersByCampaign: Record<string, HqForcedCampaign['tiers']> = {}
    if (campaignIds.length > 0) {
      const { data: tierRows } = await svc
        .from('hq_forced_campaign_tiers')
        .select('campaign_id, min_qty, discount_pct, discount_amount, fixed_price, gifts, highlight_text')
        .in('campaign_id', campaignIds)
      for (const t of (tierRows || []) as any[]) {
        const cid = String(t.campaign_id)
        if (!tiersByCampaign[cid]) tiersByCampaign[cid] = []
        tiersByCampaign[cid]!.push({
          min_qty: t.min_qty, discount_pct: t.discount_pct, discount_amount: t.discount_amount,
          fixed_price: t.fixed_price, gifts: t.gifts ?? [], highlight_text: t.highlight_text,
        })
      }
    }
    const serverCampaigns = ((campaignRows || []) as any[]).map((r) => ({ ...r, tiers: tiersByCampaign[String(r.id)] || [] })) as HqForcedCampaign[]
    const cartForEffects = (items as any[]).map((i) => ({
      product_id: String(i.product_id || ''),
      qty: Math.trunc(Number(i.qty) || 0),
      unit_price: Math.trunc(Number(i.unit_price) || 0),
    }))
    const effects = resolveHqCampaignEffects(cartForEffects, serverCampaigns)
    serverDiscountTotal = effects.discountTotal
  }
  const expectedFinal = subtotal - serverDiscountTotal
  if (Math.abs(expectedFinal - finalAmount) > 10) {
    return NextResponse.json({ ok: false, error: 'amount_mismatch' }, { status: 400 })
  }

  const { data: order, error } = await svc
    .from('hq_stock_orders')
    .insert({
      brand_id: brandId,
      profile_id: profile.id,
      status: '결제대기',
      items,
      subtotal,
      final_amount: finalAmount,
      owner_name: ownerName,
      salon_name: salonName,
    })
    .select('id, final_amount, status')
    .single()

  if (error || !order?.id) {
    return NextResponse.json(
      { ok: false, error: 'insert_failed', message: error?.message || '발주 생성 실패' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    order_id: order.id,
    final_amount: order.final_amount,
    status: order.status,
  })
}
