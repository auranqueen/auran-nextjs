import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const id = typeof body?.id === 'string' ? body.id.trim() : null
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const badgeText = typeof body?.badge_text === 'string' ? body.badge_text.trim() : null
  const campaignType = typeof body?.campaign_type === 'string' ? body.campaign_type.trim() : ''
  const targetProductIds = Array.isArray(body?.target_product_ids) ? body.target_product_ids.map(String) : []
  const buyQty = body?.buy_qty != null ? Math.trunc(Number(body.buy_qty)) : null
  const bonusQty = body?.bonus_qty != null ? Math.trunc(Number(body.bonus_qty)) : null
  const giftProductId = typeof body?.gift_product_id === 'string' ? body.gift_product_id.trim() : null
  const discountPct = body?.discount_pct != null ? Number(body.discount_pct) : null
  const startAt = typeof body?.start_at === 'string' ? body.start_at : null
  const endAt = typeof body?.end_at === 'string' ? body.end_at : null
  const applyToMembers = Boolean(body?.apply_to_members)
  if (!title) return NextResponse.json({ ok: false, error: 'title_required' }, { status: 400 })
  if (!['bundle', 'gift', 'discount'].includes(campaignType)) {
    return NextResponse.json({ ok: false, error: 'invalid_campaign_type' }, { status: 400 })
  }
  if (targetProductIds.length === 0) {
    return NextResponse.json({ ok: false, error: 'no_products' }, { status: 400 })
  }
  if (!startAt || !endAt) {
    return NextResponse.json({ ok: false, error: 'dates_required' }, { status: 400 })
  }
  const { data: me } = await supabase.from('users').select('id, role').eq('auth_id', user.id).maybeSingle()
  if (!me?.id || me.role !== 'owner') {
    return NextResponse.json({ ok: false, error: 'owner_only' }, { status: 403 })
  }
  const { data: profile } = await supabase.from('profiles').select('id').eq('auth_id', user.id).maybeSingle()
  if (!profile?.id) {
    return NextResponse.json({ ok: false, error: 'profile_not_found' }, { status: 404 })
  }
  const svc = tryCreateServiceClient()
  const db = svc ?? supabase
  const { data: productRows } = await db
    .from('brand_products')
    .select('id, brand_id')
    .in('id', targetProductIds)
  if (!productRows || productRows.length !== targetProductIds.length) {
    return NextResponse.json({ ok: false, error: 'product_not_found' }, { status: 404 })
  }
  const brandIds = Array.from(new Set(productRows.map((p) => String(p.brand_id))))
  const { data: brandRows } = await db.from('brands').select('id, company_id').in('id', brandIds)
  const companyIds = Array.from(new Set((brandRows || []).map((b) => String(b.company_id))))
  if (companyIds.length !== 1) {
    return NextResponse.json({ ok: false, error: 'products_must_be_same_company' }, { status: 400 })
  }
  const companyId = companyIds[0]
  const { data: linkRow } = await db
    .from('brand_owner_links')
    .select('id')
    .eq('owner_id', me.id)
    .in('brand_id', brandIds)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  if (!linkRow?.id) {
    return NextResponse.json({ ok: false, error: 'not_linked_to_brand' }, { status: 403 })
  }
  const row: Record<string, unknown> = {
    company_id: companyId,
    owner_id: profile.id,
    title,
    badge_text: badgeText,
    campaign_type: campaignType,
    target_product_ids: targetProductIds,
    buy_qty: buyQty,
    bonus_qty: bonusQty,
    gift_product_id: giftProductId,
    discount_pct: discountPct,
    start_at: startAt,
    end_at: endAt,
    is_active: true,
    apply_to_members: applyToMembers,
  }
  if (id) {
    const { data: existing } = await db
      .from('hq_forced_campaigns')
      .select('owner_id')
      .eq('id', id)
      .maybeSingle()
    if (!existing || String(existing.owner_id) !== String(profile.id)) {
      return NextResponse.json({ ok: false, error: 'not_owner' }, { status: 403 })
    }
  }
  if (id) row.id = id
  const { data, error } = await db
    .from('hq_forced_campaigns')
    .upsert(row, { onConflict: 'id' })
    .select('id')
    .single()
  if (error || !data?.id) {
    return NextResponse.json({ ok: false, error: error?.message || 'save_failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, id: data.id })
}
