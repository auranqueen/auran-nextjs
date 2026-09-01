import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'
import { insertBrandOrder } from '@/lib/brand/insertBrandOrder'
import { type HqForcedCampaign } from '@/lib/brand/hqForcedCampaignPromos'
import { computeCampaignPackagePricing } from '@/lib/brand/computeCampaignPackagePricing'

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
  const ownerNote =
    typeof body?.owner_note === 'string' && body.owner_note.trim()
      ? body.owner_note.trim()
      : null
  const packageCampaignId =
    typeof body?.package_campaign_id === 'string' && body.package_campaign_id.trim()
      ? body.package_campaign_id.trim()
      : null
  const packageSets = Math.trunc(Number(body?.package_sets) || 0)
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

  const clientTotalAmount = cartItems.reduce((s: number, g: any) => s + Math.trunc(Number(g.total_amount) || 0), 0)
  let appliedCampaignId: string | null = null

  if (packageCampaignId) {
    if (packageSets < 1) {
      return NextResponse.json({ ok: false, error: 'invalid_package_sets', message: '세트 수가 올바르지 않습니다' }, { status: 400 })
    }

    const { data: userRow } = await svc.from('users').select('id').eq('auth_id', user.id).maybeSingle()
    const ownerUserId = userRow?.id ? String(userRow.id) : ''
    if (!ownerUserId) {
      return NextResponse.json({ ok: false, error: 'profile_missing', message: '프로필이 없습니다' }, { status: 400 })
    }

    const { data: packageCampaign, error: packageCampErr } = await svc
      .from('hq_forced_campaigns')
      .select('id, company_id, target_product_ids, start_at, end_at')
      .eq('id', packageCampaignId)
      .maybeSingle()
    if (packageCampErr) {
      return NextResponse.json({ ok: false, error: 'query_failed', message: packageCampErr.message }, { status: 500 })
    }
    if (!packageCampaign?.id) {
      return NextResponse.json({ ok: false, error: 'campaign_not_found', message: '캠페인을 찾을 수 없습니다' }, { status: 404 })
    }

    const packageCompanyId = packageCampaign.company_id ? String(packageCampaign.company_id) : ''
    if (!packageCompanyId) {
      return NextResponse.json({ ok: false, error: 'invalid_campaign', message: '캠페인 회사 정보가 없습니다' }, { status: 400 })
    }

    const { data: brandRows } = await svc.from('brands').select('id').eq('company_id', packageCompanyId)
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

    let hasGrade = false
    if (!hasLink) {
      const { data: gradeRow } = await svc
        .from('brand_owner_grades')
        .select('owner_id')
        .eq('owner_id', profile.id)
        .eq('company_id', packageCompanyId)
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

    const { data: packageTierRows, error: packageTierErr } = await svc
      .from('hq_forced_campaign_tiers')
      .select('min_qty, min_amount, discount_pct, discount_amount, fixed_price, gifts, highlight_text')
      .eq('campaign_id', packageCampaignId)
    if (packageTierErr) {
      return NextResponse.json({ ok: false, error: 'tiers_failed', message: packageTierErr.message }, { status: 500 })
    }

    const packageTiers: NonNullable<HqForcedCampaign['tiers']> = (packageTierRows || []).map((t: {
      min_qty: number | null
      min_amount: number | null
      discount_pct: number | null
      discount_amount: number | null
      fixed_price: number | null
      gifts: { product_id?: string; qty?: number }[] | null
      highlight_text: string | null
    }) => ({
      min_qty: Math.trunc(Number(t.min_qty) || 0),
      min_amount: t.min_amount == null ? null : Math.trunc(Number(t.min_amount) || 0),
      discount_pct: t.discount_pct,
      discount_amount: t.discount_amount,
      fixed_price: t.fixed_price,
      gifts: Array.isArray(t.gifts)
        ? t.gifts.map((g) => ({
            product_id: String(g.product_id || ''),
            qty: Math.trunc(Number(g.qty) || 0),
          }))
        : [],
      highlight_text: t.highlight_text,
    }))

    const targetProductIds = ((packageCampaign.target_product_ids as string[] | null) || [])
      .map((id) => String(id))
      .filter(Boolean)
    const serverProductMap: Record<string, { supply_price: number }> = {}
    if (targetProductIds.length > 0) {
      const { data: prodRows, error: prodErr } = await svc
        .from('brand_products')
        .select('id, supply_price')
        .in('id', targetProductIds)
      if (prodErr) {
        return NextResponse.json({ ok: false, error: 'products_failed', message: prodErr.message }, { status: 500 })
      }
      for (const p of (prodRows || []) as { id: string; supply_price: number | null }[]) {
        serverProductMap[String(p.id)] = { supply_price: Math.trunc(Number(p.supply_price) || 0) }
      }
    }

    const pricing = computeCampaignPackagePricing(
      {
        id: String(packageCampaign.id),
        target_product_ids: targetProductIds,
        start_at: packageCampaign.start_at ? String(packageCampaign.start_at) : '',
        end_at: packageCampaign.end_at ? String(packageCampaign.end_at) : '',
        tiers: packageTiers,
      },
      serverProductMap,
      packageSets,
    )
    if (Math.abs(pricing.finalAmount - clientTotalAmount) > 10) {
      return NextResponse.json({ ok: false, error: 'amount_mismatch' }, { status: 400 })
    }
    appliedCampaignId = packageCampaignId
  } else {
    const rawLineTotal = cartItems.reduce((s: number, g: any) => s + (g.items || []).reduce((s2: number, i: any) => s2 + Math.trunc(Number(i.line_amount) || 0), 0), 0)
    const expectedTotal = rawLineTotal
    if (Math.abs(expectedTotal - clientTotalAmount) > 10) {
      return NextResponse.json({ ok: false, error: 'amount_mismatch' }, { status: 400 })
    }
  }

  const ownerName = String(cartItems[0]?.owner_name || '')
  const salonName = String(cartItems[0]?.salon_name || '')
  const totalAmount = clientTotalAmount

  let batchId: string | null = null
  let orderNo: string | null = null
  const maxAttempts = 8
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = makeOrderNo()
    const batchRow: Record<string, unknown> = {
      order_no: candidate,
      profile_id: profile.id,
      owner_name: ownerName,
      salon_name: salonName,
      total_amount: totalAmount,
      status: '승인대기',
      owner_note: ownerNote,
    }
    if (appliedCampaignId) {
      batchRow.campaign_id = appliedCampaignId
    }
    const { data: batch, error: batchErr } = await svc
      .from('brand_order_batches')
      .insert(batchRow)
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
      ...(appliedCampaignId ? { campaign_id: appliedCampaignId } : {}),
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
