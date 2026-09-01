import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

type TierGift = { product_id?: string; qty?: number }

/**
 * GET /api/owner/campaigns/[id]
 * 원장 소속: brand_owner_links(active) OR brand_owner_grades(origin_track A)
 * — resolveOwnersByGrades와 동일한 이중체크. RLS 우회(service role).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const campaignId = String(params?.id || '').trim()
  if (!campaignId) {
    return NextResponse.json({ ok: false, error: 'invalid_id', message: '캠페인 ID가 필요합니다' }, { status: 400 })
  }

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

  const [{ data: userRow }, { data: profileRow }] = await Promise.all([
    svc.from('users').select('id, role').eq('auth_id', user.id).maybeSingle(),
    svc.from('profiles').select('id').eq('auth_id', user.id).maybeSingle(),
  ])

  const ownerUserId = userRow?.id ? String(userRow.id) : ''
  const ownerProfileId = profileRow?.id ? String(profileRow.id) : ''
  if (!ownerUserId || !ownerProfileId) {
    return NextResponse.json({ ok: false, error: 'profile_missing', message: '프로필이 없습니다' }, { status: 400 })
  }

  const { data: campaign, error: campErr } = await svc
    .from('hq_forced_campaigns')
    .select(
      'id, company_id, title, description, image_url, badge_text, target_product_ids, start_at, end_at, target_grades, is_active, owner_id',
    )
    .eq('id', campaignId)
    .eq('is_active', true)
    .maybeSingle()

  if (campErr) {
    return NextResponse.json({ ok: false, error: 'query_failed', message: campErr.message }, { status: 500 })
  }
  if (!campaign?.id) {
    return NextResponse.json({ ok: false, error: 'not_found', message: '캠페인을 찾을 수 없습니다' }, { status: 404 })
  }

  const companyId = campaign.company_id ? String(campaign.company_id) : ''
  if (!companyId) {
    return NextResponse.json({ ok: false, error: 'invalid_campaign', message: '캠페인 회사 정보가 없습니다' }, { status: 400 })
  }

  // (a) brand_owner_links active for any brand under company
  const { data: brandRows } = await svc.from('brands').select('id').eq('company_id', companyId)
  const brandIds = (brandRows || []).map((b: { id: string }) => String(b.id)).filter(Boolean)

  let hasLink = false
  if (brandIds.length > 0) {
    const { data: linkRows } = await svc
      .from('brand_owner_links')
      .select('id')
      .eq('owner_id', ownerUserId)
      .eq('status', 'active')
      .in('brand_id', brandIds)
      .limit(1)
    hasLink = (linkRows || []).length > 0
  }

  // (b) brand_owner_grades row (origin_track A) — grades-only owners (e.g. 스킨파우더룸)
  let hasGrade = false
  if (!hasLink) {
    const { data: gradeRow } = await svc
      .from('brand_owner_grades')
      .select('owner_id')
      .eq('owner_id', ownerProfileId)
      .eq('company_id', companyId)
      .eq('origin_track', 'A')
      .limit(1)
      .maybeSingle()
    hasGrade = Boolean(gradeRow?.owner_id)
  }

  if (!hasLink && !hasGrade) {
    return NextResponse.json(
      { ok: false, error: 'forbidden', message: '이 캠페인에 접근할 권한이 없습니다' },
      { status: 403 },
    )
  }

  const { data: tierRows, error: tierErr } = await svc
    .from('hq_forced_campaign_tiers')
    .select('min_qty, min_amount, discount_pct, discount_amount, fixed_price, gifts, highlight_text')
    .eq('campaign_id', campaignId)

  if (tierErr) {
    return NextResponse.json({ ok: false, error: 'tiers_failed', message: tierErr.message }, { status: 500 })
  }

  const tiers = (tierRows || []).map((t: {
    min_qty: number | null
    min_amount: number | null
    discount_pct: number | null
    discount_amount: number | null
    fixed_price: number | null
    gifts: TierGift[] | null
    highlight_text: string | null
  }) => ({
    min_qty: Math.trunc(Number(t.min_qty) || 0),
    min_amount: t.min_amount == null ? null : Math.trunc(Number(t.min_amount) || 0),
    discount_pct: t.discount_pct,
    discount_amount: t.discount_amount,
    fixed_price: t.fixed_price,
    gifts: Array.isArray(t.gifts) ? t.gifts : [],
    highlight_text: t.highlight_text,
  }))

  const productIdSet = new Set<string>()
  for (const pid of (campaign.target_product_ids as string[] | null) || []) {
    if (pid) productIdSet.add(String(pid))
  }
  for (const t of tiers) {
    for (const g of t.gifts as TierGift[]) {
      if (g?.product_id) productIdSet.add(String(g.product_id))
    }
  }

  const products: Record<string, { name: string; supply_price: number; brand_id: string; thumb_img?: string | null }> = {}
  const productIds = Array.from(productIdSet)
  if (productIds.length > 0) {
    const { data: prodRows, error: prodErr } = await svc
      .from('brand_products')
      .select('id, brand_id, name, thumb_img, supply_price')
      .in('id', productIds)
    if (prodErr) {
      return NextResponse.json({ ok: false, error: 'products_failed', message: prodErr.message }, { status: 500 })
    }
    for (const p of (prodRows || []) as {
      id: string
      brand_id: string
      name: string
      thumb_img: string | null
      supply_price: number | null
    }[]) {
      products[String(p.id)] = {
        name: p.name || '',
        supply_price: Math.trunc(Number(p.supply_price) || 0),
        brand_id: String(p.brand_id),
        thumb_img: p.thumb_img ?? null,
      }
    }
  }

  const now = Date.now()
  const startAt = campaign.start_at ? new Date(String(campaign.start_at)).getTime() : 0
  const endAt = campaign.end_at ? new Date(String(campaign.end_at)).getTime() : 0
  const inPeriod = (!startAt || now >= startAt) && (!endAt || now <= endAt)
  const notStarted = startAt > 0 && now < startAt
  const expired = endAt > 0 && now > endAt

  return NextResponse.json({
    ok: true,
    campaign: {
      id: String(campaign.id),
      company_id: companyId,
      title: campaign.title ?? null,
      description: campaign.description ?? null,
      image_url: campaign.image_url ?? null,
      badge_text: campaign.badge_text ?? null,
      target_product_ids: (campaign.target_product_ids as string[] | null) || [],
      target_grades: (campaign.target_grades as string[] | null) || null,
      start_at: campaign.start_at,
      end_at: campaign.end_at,
      is_active: true,
      in_period: inPeriod,
      not_started: notStarted,
      expired,
      tiers,
    },
    products,
  })
}
