import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'
import { insertBrandOrder } from '@/lib/brand/insertBrandOrder'
import { resolveHqCampaignEffects, type HqForcedCampaign } from '@/lib/brand/hqForcedCampaignPromos'

function yyyymmddLocal(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function random4(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 4; i++) {
    s += chars[Math.floor(Math.random() * chars.length)]
  }
  return s
}

function makeOrderNo(): string {
  return `ORD-${yyyymmddLocal()}-${random4()}`
}

type CartBrandGroup = {
  brand_id: string
  profile_id: string
  owner_name?: string
  salon_name?: string
  grade?: string
  items: unknown[]
  total_qty?: number
  total_amount?: number
  promo_applied?: string | null
  promo?: string | null
  points_earned?: number
}

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

  const { data: profile } = await supabase.from('profiles').select('id').eq('auth_id', user.id).maybeSingle()
  if (!profile?.id) {
    return NextResponse.json({ ok: false, error: 'profile_missing', message: '프로필이 없습니다' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const cartItems = Array.isArray(body?.cartItems) ? (body.cartItems as CartBrandGroup[]) : null
  if (!cartItems || cartItems.length === 0) {
    return NextResponse.json({ ok: false, error: 'invalid_request', message: '잘못된 요청입니다' }, { status: 400 })
  }

  for (const g of cartItems) {
    if (!g?.brand_id || !g?.profile_id || !Array.isArray(g.items) || g.items.length === 0) {
      return NextResponse.json({ ok: false, error: 'invalid_request', message: '잘못된 요청입니다' }, { status: 400 })
    }
    if (g.profile_id !== profile.id) {
      return NextResponse.json({ ok: false, error: 'profile_mismatch', message: '프로필이 일치하지 않습니다' }, { status: 403 })
    }
  }

  // 서버 재검증: 전체 카트(모든 브랜드) 기준으로 활성 캠페인 재계산
  const brandIdsInCart = Array.from(new Set(cartItems.map((g: any) => g.brand_id)))
  let companyIdForCampaign: string | null = null
  if (brandIdsInCart.length > 0) {
    const { data: brandRow } = await svc.from('brands').select('company_id').eq('id', brandIdsInCart[0]).maybeSingle()
    companyIdForCampaign = brandRow?.company_id ? String(brandRow.company_id) : null
  }
  let serverDiscountTotal = 0
  if (companyIdForCampaign) {
    const { data: gradeRow } = await svc
      .from('brand_owner_grades')
      .select('grade')
      .eq('owner_id', profile.id)
      .eq('company_id', companyIdForCampaign)
      .eq('origin_track', 'A')
      .eq('payment_status', 'paid')
      .maybeSingle()
    const ownerGrade = String(gradeRow?.grade || '취급점')
    const { data: campaignRows } = await svc
      .from('hq_forced_campaigns')
      .select('id, company_id, target_product_ids, start_at, end_at, target_grades')
      .eq('company_id', companyIdForCampaign)
      .is('owner_id', null)
      .eq('is_active', true)
    const campaignRowsFiltered = (campaignRows || []).filter((r: { target_grades?: string[] | null }) =>
      !r.target_grades || r.target_grades.length === 0 || r.target_grades.includes(ownerGrade)
    )
    const campaignIds = campaignRowsFiltered.map((r: { id: string }) => r.id)
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
    const serverCampaigns = (campaignRowsFiltered as any[]).map((r) => ({ ...r, tiers: tiersByCampaign[String(r.id)] || [] })) as HqForcedCampaign[]
    const wholeCartForServer = cartItems.flatMap((g) =>
      (Array.isArray(g.items) ? g.items : []).map((i: any) => ({
        product_id: String(i.product_id || ''),
        qty: Math.trunc(Number(i.qty) || 0),
        unit_price: Math.trunc(Number(i.unit_price) || 0),
      }))
    )
    const effects = resolveHqCampaignEffects(wholeCartForServer, serverCampaigns)
    serverDiscountTotal = effects.discountTotal
  }
  const clientTotalAmount = cartItems.reduce((s: number, g: any) => s + Math.trunc(Number(g.total_amount) || 0), 0)
  const rawLineTotal = cartItems.reduce((s: number, g: any) => s + (g.items || []).reduce((s2: number, i: any) => s2 + Math.trunc(Number(i.line_amount) || 0), 0), 0)
  const expectedTotal = rawLineTotal - serverDiscountTotal
  if (Math.abs(expectedTotal - clientTotalAmount) > 10) {
    return NextResponse.json({ ok: false, error: 'amount_mismatch' }, { status: 400 })
  }

  const ownerName = String(cartItems[0]?.owner_name || '')
  const salonName = String(cartItems[0]?.salon_name || '')
  const totalAmount = clientTotalAmount

  let batchId: string | null = null
  let orderNo: string | null = null
  const maxAttempts = 8
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = makeOrderNo()
    const { data: batch, error: batchErr } = await svc
      .from('brand_order_batches')
      .insert({
        order_no: candidate,
        profile_id: profile.id,
        owner_name: ownerName,
        salon_name: salonName,
        total_amount: totalAmount,
        status: '승인대기',
      })
      .select('id, order_no')
      .single()

    if (!batchErr && batch?.id) {
      batchId = batch.id
      orderNo = batch.order_no
      break
    }
    const msg = String(batchErr?.message || '')
    const code = String((batchErr as { code?: string } | null)?.code || '')
    const isUnique = code === '23505' || /duplicate|unique/i.test(msg)
    if (!isUnique) {
      return NextResponse.json(
        { ok: false, error: 'batch_insert_failed', message: batchErr?.message || '배치 생성 실패' },
        { status: 500 },
      )
    }
  }

  if (!batchId || !orderNo) {
    return NextResponse.json(
      { ok: false, error: 'order_no_conflict', message: '주문번호 생성에 실패했습니다. 다시 시도해주세요' },
      { status: 500 },
    )
  }

  const orderIds: string[] = []
  for (const g of cartItems) {
    const promoApplied =
      g.promo_applied != null
        ? String(g.promo_applied)
        : g.promo != null
          ? String(g.promo)
          : null
    const result = await insertBrandOrder(svc, {
      brand_id: g.brand_id,
      profile_id: g.profile_id,
      owner_name: g.owner_name || ownerName,
      salon_name: g.salon_name || salonName,
      grade: g.grade || '',
      items: g.items,
      total_qty: g.total_qty,
      total_amount: g.total_amount,
      promo_applied: promoApplied,
      points_earned: g.points_earned,
      batch_id: batchId,
    })
    if (!result.ok) {
      await svc.from('brand_orders').delete().eq('batch_id', batchId)
      await svc.from('brand_order_batches').delete().eq('id', batchId)
      const status = result.error === 'unpaid_invoice' ? 403 : 500
      return NextResponse.json(
        { ok: false, error: result.error, message: result.message },
        { status },
      )
    }
    orderIds.push(result.order_id)
  }

  return NextResponse.json({
    ok: true,
    batch_id: batchId,
    order_no: orderNo,
    order_ids: orderIds,
  })
}
